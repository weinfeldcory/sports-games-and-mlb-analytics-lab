import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Screen } from "../../components/common/Screen";
import { LabeledInput } from "../../components/common/LabeledInput";
import { PrimaryButton } from "../../components/common/PrimaryButton";
import { SectionCard } from "../../components/common/SectionCard";
import { useAppData } from "../../providers/AppDataProvider";
import { colors, spacing } from "../../styles/tokens";
import { formatGameLabel } from "../../lib/formatters";
import type { AttendanceLog } from "@mlb-attendance/domain";

function createDraft(log: AttendanceLog) {
  return {
    section: log.seat.section,
    row: log.seat.row ?? "",
    seatNumber: log.seat.seatNumber ?? "",
    memorableMoment: log.memorableMoment ?? "",
    companion: log.companion ?? "",
    giveaway: log.giveaway ?? "",
    weather: log.weather ?? ""
  };
}

export function HistoryScreen() {
  const { width } = useWindowDimensions();
  const { attendanceLogs, games, teams, venues, updateAttendanceLog, deleteAttendanceLog } = useAppData();
  const isWide = width >= 1024;
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const venuesById = useMemo(() => new Map(venues.map((venue) => [venue.id, venue])), [venues]);
  const gamesById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games]);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState(createDraft(attendanceLogs[0] ?? {
    id: "",
    userId: "",
    gameId: "",
    venueId: "",
    attendedOn: "",
    seat: { section: "" },
    witnessedEvents: []
  }));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) {
      return attendanceLogs;
    }

    return attendanceLogs.filter((log) => {
      const game = gamesById.get(log.gameId);
      const homeTeam = game ? teamsById.get(game.homeTeamId) : undefined;
      const awayTeam = game ? teamsById.get(game.awayTeamId) : undefined;
      const venue = venuesById.get(log.venueId);
      const haystack = [
        log.attendedOn,
        log.seat.section,
        log.seat.row,
        log.seat.seatNumber,
        log.memorableMoment,
        log.companion,
        log.giveaway,
        log.weather,
        venue?.name,
        homeTeam?.name,
        awayTeam?.name,
        homeTeam?.abbreviation,
        awayTeam?.abbreviation
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [attendanceLogs, filter, gamesById, teamsById, venuesById]);

  function beginEditing(log: AttendanceLog) {
    setEditingLogId(log.id);
    setDraft(createDraft(log));
    setMessage(null);
    setError(null);
  }

  function cancelEditing() {
    setEditingLogId(null);
    setMessage(null);
    setError(null);
  }

  async function handleSave(logId: string) {
    if (!draft.section.trim()) {
      setError("Section is required.");
      return;
    }

    try {
      await updateAttendanceLog(logId, {
        seat: {
          section: draft.section,
          row: draft.row,
          seatNumber: draft.seatNumber
        },
        memorableMoment: draft.memorableMoment,
        companion: draft.companion,
        giveaway: draft.giveaway,
        weather: draft.weather
      });
      setEditingLogId(null);
      setError(null);
      setMessage("Attendance log updated.");
    } catch (updateError) {
      setMessage(null);
      setError(updateError instanceof Error ? updateError.message : "Could not update the attendance log.");
    }
  }

  async function handleDelete(logId: string) {
    try {
      await deleteAttendanceLog(logId);
      if (editingLogId === logId) {
        setEditingLogId(null);
      }
      setError(null);
      setMessage("Attendance log deleted.");
    } catch (deleteError) {
      setMessage(null);
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete the attendance log.");
    }
  }

  return (
    <Screen
      title="History"
      subtitle="Search, review, and edit the logbook behind your personal MLB attendance record."
    >
      <View style={[styles.summaryGrid, isWide ? styles.summaryGridWide : null]}>
        <SectionCard title="Search Logbook">
          <LabeledInput
            label="Filter by team, venue, date, seat, or note"
            value={filter}
            onChangeText={setFilter}
            placeholder="Yankees, Fenway, 2025-07, Judge..."
          />
          <Text style={styles.helperText}>
            Showing {filteredLogs.length} of {attendanceLogs.length} saved games.
          </Text>
        </SectionCard>

        <SectionCard title="Coverage">
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Games logged</Text>
            <Text style={styles.metricValue}>{attendanceLogs.length}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Stadiums visited</Text>
            <Text style={styles.metricValue}>{new Set(attendanceLogs.map((log) => log.venueId)).size}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Latest entry</Text>
            <Text style={styles.metricValue}>{attendanceLogs[0]?.attendedOn ?? "None"}</Text>
          </View>
        </SectionCard>
      </View>

      {message ? <Text style={styles.successText}>{message}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {filteredLogs.length ? (
        filteredLogs.map((log) => {
          const game = gamesById.get(log.gameId);
          if (!game) {
            return null;
          }

          const label = formatGameLabel(game, teamsById, venuesById);
          const isEditing = editingLogId === log.id;

          return (
            <SectionCard key={log.id} title={label.title}>
              <Text style={styles.subtitle}>{label.subtitle}</Text>
              <Text style={styles.score}>Final: {label.score}</Text>
              {isEditing ? (
                <>
                  <View style={[styles.formGrid, isWide ? styles.formGridWide : null]}>
                    <View style={styles.formColumn}>
                      <LabeledInput
                        label="Section"
                        value={draft.section}
                        onChangeText={(value) => setDraft((current) => ({ ...current, section: value }))}
                        placeholder="214A"
                        autoCapitalize="characters"
                      />
                      <LabeledInput
                        label="Row"
                        value={draft.row}
                        onChangeText={(value) => setDraft((current) => ({ ...current, row: value }))}
                        placeholder="5"
                        autoCapitalize="characters"
                      />
                      <LabeledInput
                        label="Seat"
                        value={draft.seatNumber}
                        onChangeText={(value) => setDraft((current) => ({ ...current, seatNumber: value }))}
                        placeholder="7"
                        autoCapitalize="characters"
                      />
                    </View>
                    <View style={styles.formColumn}>
                      <LabeledInput
                        label="Memorable moment"
                        value={draft.memorableMoment}
                        onChangeText={(value) => setDraft((current) => ({ ...current, memorableMoment: value }))}
                        placeholder="What stood out?"
                        multiline
                        numberOfLines={4}
                      />
                      <LabeledInput
                        label="Who you went with"
                        value={draft.companion}
                        onChangeText={(value) => setDraft((current) => ({ ...current, companion: value }))}
                        placeholder="Dad, Sam, coworkers..."
                      />
                      <LabeledInput
                        label="Giveaway"
                        value={draft.giveaway}
                        onChangeText={(value) => setDraft((current) => ({ ...current, giveaway: value }))}
                        placeholder="Bobblehead, jersey, cap..."
                      />
                      <LabeledInput
                        label="Weather"
                        value={draft.weather}
                        onChangeText={(value) => setDraft((current) => ({ ...current, weather: value }))}
                        placeholder="72F and clear"
                      />
                    </View>
                  </View>
                  <View style={styles.actionRow}>
                    <PrimaryButton label="Save Changes" onPress={() => handleSave(log.id)} />
                    <Pressable onPress={cancelEditing}>
                      <Text style={styles.linkText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.detail}>
                    Seat: {log.seat.section}
                    {log.seat.row ? ` • Row ${log.seat.row}` : ""}
                    {log.seat.seatNumber ? ` • Seat ${log.seat.seatNumber}` : ""}
                  </Text>
                  <View style={styles.metricGrid}>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricCardLabel}>Total Hits</Text>
                      <Text style={styles.metricCardValue}>{game.homeHits + game.awayHits}</Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricCardLabel}>Pitchers Used</Text>
                      <Text style={styles.metricCardValue}>{game.pitchersUsed?.length ?? 0}</Text>
                    </View>
                  </View>
                  {game.pitchersUsed?.length ? (
                    <View style={styles.pitcherList}>
                      {game.pitchersUsed.slice(0, 8).map((pitcher) => (
                        <View key={`${game.id}_${pitcher.pitcherName}`} style={styles.pitcherRow}>
                          <Text style={styles.pitcherName}>{pitcher.pitcherName}</Text>
                          <Text style={styles.pitcherMeta}>
                            {pitcher.role} • {pitcher.teamId.replace("team_", "").toUpperCase()} • {pitcher.inningsPitched?.toFixed(1) ?? "0.0"} IP
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {log.memorableMoment ? <Text style={styles.noteText}>{log.memorableMoment}</Text> : null}
                  {log.companion ? <Text style={styles.metaText}>With: {log.companion}</Text> : null}
                  {log.giveaway ? <Text style={styles.metaText}>Giveaway: {log.giveaway}</Text> : null}
                  {log.weather ? <Text style={styles.metaText}>Weather: {log.weather}</Text> : null}
                  <View style={styles.eventRow}>
                    {log.witnessedEvents.slice(0, 4).map((event) => (
                      <View key={event.id} style={styles.eventPill}>
                        <Text style={styles.eventLabel}>{event.label}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.actionRow}>
                    <Pressable onPress={() => beginEditing(log)}>
                      <Text style={styles.linkText}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => handleDelete(log.id)}>
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </SectionCard>
          );
        })
      ) : (
        <SectionCard title="No Matches">
          <Text style={styles.helperText}>No saved games matched that filter. Try a team name, venue, or a broader date fragment.</Text>
        </SectionCard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryGrid: {
    gap: spacing.lg
  },
  summaryGridWide: {
    flexDirection: "row"
  },
  helperText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.slate500
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  metricLabel: {
    fontSize: 14,
    color: colors.slate700
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy
  },
  subtitle: {
    fontSize: 14,
    color: colors.slate500
  },
  score: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.slate900
  },
  formGrid: {
    gap: spacing.md
  },
  formGridWide: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  formColumn: {
    flex: 1,
    gap: spacing.md
  },
  detail: {
    fontSize: 14,
    color: colors.slate700
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  metricCard: {
    minWidth: 140,
    backgroundColor: colors.slate050,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs
  },
  metricCardLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate500
  },
  metricCardValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.navy
  },
  pitcherList: {
    gap: spacing.sm
  },
  pitcherRow: {
    gap: spacing.xs
  },
  pitcherName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.slate900
  },
  pitcherMeta: {
    fontSize: 13,
    color: colors.slate500
  },
  noteText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.slate900
  },
  metaText: {
    fontSize: 14,
    color: colors.slate500
  },
  eventRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  eventPill: {
    backgroundColor: colors.slate100,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  eventLabel: {
    fontSize: 12,
    color: colors.navy
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.lg
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy
  },
  deleteText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.red
  },
  successText: {
    fontSize: 14,
    color: colors.green
  },
  errorText: {
    fontSize: 14,
    color: colors.red
  }
});
