import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Screen } from "../../components/common/Screen";
import { LabeledInput } from "../../components/common/LabeledInput";
import { PrimaryButton } from "../../components/common/PrimaryButton";
import { SectionCard } from "../../components/common/SectionCard";
import { useAppData } from "../../providers/AppDataProvider";
import { colors, spacing } from "../../styles/tokens";
import { formatGameLabel } from "../../lib/formatters";
import type { Game } from "@mlb-attendance/domain";

function buildGameNotes(game: Game) {
  const notes = [];

  if (game.walkOff) {
    notes.push("Walk-off finish");
  }
  if (game.innings && game.innings > 9) {
    notes.push(`${game.innings} innings`);
  }
  if (game.featuredPlayerHomeRun) {
    notes.push(`${game.featuredPlayerHomeRun} homer`);
  }

  return notes;
}

export function LogGameScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile, teams, venues, games, searchGames, addAttendanceLog } = useAppData();
  const isWide = width >= 1024;
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const venuesById = useMemo(() => new Map(venues.map((venue) => [venue.id, venue])), [venues]);
  const favoriteTeam = teams.find((team) => team.id === profile.favoriteTeamId);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [stadium, setStadium] = useState("");
  const [results, setResults] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [section, setSection] = useState("");
  const [row, setRow] = useState("");
  const [seatNumber, setSeatNumber] = useState("");
  const [memorableMoment, setMemorableMoment] = useState("");
  const [companion, setCompanion] = useState("");
  const [giveaway, setGiveaway] = useState("");
  const [weather, setWeather] = useState("");
  const [searchError, setSearchError] = useState("");
  const [seatError, setSeatError] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const selectedGameLabel = selectedGame ? formatGameLabel(selectedGame, teamsById, venuesById) : null;
  const latestSeason = useMemo(() => {
    const years = games
      .map((game) => Number(game.startDate.slice(0, 4)))
      .filter((year) => Number.isFinite(year));
    return years.length ? String(Math.max(...years)) : "";
  }, [games]);

  const quickFinds = [
    favoriteTeam ? { label: favoriteTeam.abbreviation, action: () => applyQuickSearch({ query: favoriteTeam.abbreviation }) } : null,
    latestSeason ? { label: latestSeason, action: () => applyQuickSearch({ date: latestSeason }) } : null,
    { label: "Recent games", action: () => applyQuickSearch({}) }
  ].filter(Boolean) as Array<{ label: string; action: () => void }>;

  async function handleSearch() {
    setIsSearching(true);
    setConfirmation(null);

    try {
      const trimmedQuery = query.trim();
      const trimmedDate = date.trim();
      const trimmedStadium = stadium.trim();
      const hasFilters = Boolean(trimmedQuery || trimmedDate || trimmedStadium);
      const matches = await searchGames({
        query: trimmedQuery,
        date: trimmedDate,
        stadium: trimmedStadium
      });
      const orderedMatches = [...matches].sort((left, right) => right.startDate.localeCompare(left.startDate));
      const visibleMatches = hasFilters ? orderedMatches : orderedMatches.slice(0, 12);

      setResults(visibleMatches);
      setSearchError(visibleMatches.length ? "" : "No games matched those filters. Try team, date, or stadium.");
      setSelectedGame(null);
    } finally {
      setIsSearching(false);
    }
  }

  async function applyQuickSearch(next: { query?: string; date?: string; stadium?: string }) {
    setQuery(next.query ?? "");
    setDate(next.date ?? "");
    setStadium(next.stadium ?? "");
    setConfirmation(null);
    setIsSearching(true);

    try {
      const matches = await searchGames(next);
      const orderedMatches = [...matches].sort((left, right) => right.startDate.localeCompare(left.startDate));
      const visibleMatches = next.query || next.date || next.stadium ? orderedMatches : orderedMatches.slice(0, 12);
      setResults(visibleMatches);
      setSelectedGame(null);
      setSearchError(visibleMatches.length ? "" : "No games matched that quick find. Try a manual search.");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSave() {
    if (!selectedGame) {
      setSearchError("Select a game before saving.");
      return;
    }

    if (!section.trim()) {
      setSeatError("Section is required. Row and seat can stay blank.");
      return;
    }

    setIsSaving(true);

    try {
      const savedLog = await addAttendanceLog({
        userId: profile.id,
        gameId: selectedGame.id,
        seat: {
          section,
          row,
          seatNumber
        },
        memorableMoment,
        companion,
        giveaway,
        weather
      });

      setSeatError("");
      setSearchError("");
      setConfirmation(
        `Saved ${savedLog.attendedOn} in section ${savedLog.seat.section}. You can review it in History and Stats now.`
      );
      setSelectedGame(null);
      setResults([]);
      setSection("");
      setRow("");
      setSeatNumber("");
      setMemorableMoment("");
      setCompanion("");
      setGiveaway("");
      setWeather("");
    } catch (error) {
      setConfirmation(null);
      setSearchError(error instanceof Error ? error.message : "We could not save that game.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen
      title="Log a Game"
      subtitle="Find the game fast, save it with just a seat section, and add the extra memory detail only if it helps."
    >
      <View style={[styles.topGrid, isWide ? styles.topGridWide : null]}>
        <SectionCard title="1. Find the Game Fast">
          <View style={styles.quickFindHeader}>
            <Text style={styles.helperText}>Start from a quick lane, then narrow only if you need to.</Text>
            <View style={styles.quickFindRow}>
              {quickFinds.map((quickFind) => (
                <Pressable key={quickFind.label} onPress={quickFind.action} style={styles.quickFindChip}>
                  <Text style={styles.quickFindChipText}>{quickFind.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={[styles.formGrid, isWide ? styles.formGridWide : null]}>
            <View style={styles.formColumn}>
              <LabeledInput
                label="Team or matchup"
                value={query}
                onChangeText={setQuery}
                placeholder="Yankees, Mets, Red Sox, BAL..."
              />
              <LabeledInput
                label="Date"
                value={date}
                onChangeText={setDate}
                placeholder="2025-07-20 or 2025"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.formColumn}>
              <LabeledInput
                label="Stadium"
                value={stadium}
                onChangeText={setStadium}
                placeholder="Fenway, Yankee Stadium..."
              />
              <View style={styles.searchMetaCard}>
                <Text style={styles.searchMetaLabel}>MLB catalog</Text>
                <Text style={styles.searchMetaValue}>{games.length} MLB finals ready to log</Text>
                <Text style={styles.searchMetaCopy}>No filter also works. We will show the most recent games first.</Text>
              </View>
            </View>
          </View>
          <PrimaryButton label={isSearching ? "Searching..." : "Search Games"} onPress={handleSearch} disabled={isSearching} />
          {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}
        </SectionCard>

        <SectionCard title="Selected Game">
          {selectedGame && selectedGameLabel ? (
            <>
              <Text style={styles.gameTitle}>{selectedGameLabel.title}</Text>
              <Text style={styles.gameSubtitle}>{selectedGameLabel.subtitle}</Text>
              <Text style={styles.gameSubtitle}>Final: {selectedGameLabel.score}</Text>
              <View style={styles.noteRow}>
                {buildGameNotes(selectedGame).map((note) => (
                  <View key={note} style={styles.notePill}>
                    <Text style={styles.notePillText}>{note}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.helperText}>
                Save with just the seat section now. You can add or edit the memory details later in History.
              </Text>
            </>
          ) : (
            <Text style={styles.helperText}>Use quick find or search, then choose one game and save it with only a seat section if you want speed.</Text>
          )}
        </SectionCard>
      </View>

      {results.length ? (
        <SectionCard title={`2. Select a Game (${results.length})`}>
          <Text style={styles.helperText}>
            Pick the exact game you attended. Most recent matching games show first.
          </Text>
          <View style={styles.resultsGrid}>
            {results.map((game) => {
              const label = formatGameLabel(game, teamsById, venuesById);
              const isSelected = selectedGame?.id === game.id;

              return (
                <Pressable
                  key={game.id}
                  onPress={() => {
                    setSelectedGame(game);
                    setSearchError("");
                    setConfirmation(null);
                  }}
                  style={[styles.gameOption, isSelected ? styles.gameOptionSelected : null]}
                >
                  <Text style={styles.gameTitle}>{label.title}</Text>
                  <Text style={styles.gameSubtitle}>{label.subtitle}</Text>
                  <Text style={styles.gameSubtitle}>Final: {label.score}</Text>
                </Pressable>
              );
            })}
          </View>
        </SectionCard>
      ) : null}

      <View style={[styles.bottomGrid, isWide ? styles.bottomGridWide : null]}>
        <View style={styles.formColumn}>
          <SectionCard title="3. Save It Fast">
            <Text style={styles.helperText}>
              Section is the only required field. Everything else is optional and can wait.
            </Text>
            <LabeledInput
              label="Section"
              value={section}
              onChangeText={setSection}
              placeholder="214A"
              autoCapitalize="characters"
              error={seatError}
            />
            <View style={[styles.formGrid, styles.formGridWide]}>
              <View style={styles.formColumn}>
                <LabeledInput
                  label="Row (optional)"
                  value={row}
                  onChangeText={setRow}
                  placeholder="5"
                  autoCapitalize="characters"
                />
              </View>
              <View style={styles.formColumn}>
                <LabeledInput
                  label="Seat (optional)"
                  value={seatNumber}
                  onChangeText={setSeatNumber}
                  placeholder="7"
                  autoCapitalize="characters"
                />
              </View>
            </View>
            <PrimaryButton
              label={isSaving ? "Saving..." : "Save Attendance Log"}
              onPress={handleSave}
              disabled={!selectedGame || isSaving}
            />
          </SectionCard>
        </View>

        <View style={styles.formColumn}>
          <SectionCard title="4. Add the Memory Now Or Later">
            <LabeledInput
              label="Memorable moment"
              value={memorableMoment}
              onChangeText={setMemorableMoment}
              placeholder="Judge hit one into the second deck."
              multiline
              numberOfLines={4}
            />
            <LabeledInput
              label="Who you went with"
              value={companion}
              onChangeText={setCompanion}
              placeholder="Dad, Sam, coworkers..."
            />
            <View style={[styles.formGrid, styles.formGridWide]}>
              <View style={styles.formColumn}>
                <LabeledInput
                  label="Giveaway"
                  value={giveaway}
                  onChangeText={setGiveaway}
                  placeholder="Bobblehead, jersey, cap..."
                />
              </View>
              <View style={styles.formColumn}>
                <LabeledInput
                  label="Weather"
                  value={weather}
                  onChangeText={setWeather}
                  placeholder="72F and clear"
                />
              </View>
            </View>
          </SectionCard>
        </View>
      </View>

      {confirmation ? (
        <SectionCard title="Saved">
          <Text style={styles.successText}>{confirmation}</Text>
          <PrimaryButton label="View History" onPress={() => router.push("/(tabs)/history")} />
        </SectionCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topGrid: {
    gap: spacing.lg
  },
  topGridWide: {
    flexDirection: "row",
    alignItems: "stretch"
  },
  bottomGrid: {
    gap: spacing.lg
  },
  bottomGridWide: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  formGrid: {
    gap: spacing.md
  },
  formGridWide: {
    flexDirection: "row"
  },
  formColumn: {
    flex: 1,
    gap: spacing.md
  },
  searchMetaCard: {
    backgroundColor: colors.slate050,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 14,
    padding: spacing.lg,
    gap: spacing.xs
  },
  searchMetaLabel: {
    fontSize: 12,
    color: colors.slate500,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  searchMetaValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy
  },
  searchMetaCopy: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.slate500
  },
  quickFindHeader: {
    gap: spacing.sm
  },
  quickFindRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  quickFindChip: {
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  quickFindChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy
  },
  helperText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.slate500
  },
  resultsGrid: {
    gap: spacing.md
  },
  gameOption: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.white
  },
  gameOptionSelected: {
    borderColor: colors.navy,
    backgroundColor: colors.slate100
  },
  gameTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.slate900
  },
  gameSubtitle: {
    fontSize: 14,
    color: colors.slate500
  },
  noteRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  notePill: {
    backgroundColor: colors.slate100,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  notePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy
  },
  errorText: {
    fontSize: 13,
    color: colors.red
  },
  successText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.slate700
  }
});
