import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../components/common/EmptyState";
import { FilterChip } from "../../components/common/FilterChip";
import { Screen } from "../../components/common/Screen";
import { LabeledInput } from "../../components/common/LabeledInput";
import { PrimaryButton } from "../../components/common/PrimaryButton";
import { SectionCard } from "../../components/common/SectionCard";
import { StatusPill } from "../../components/common/StatusPill";
import { useAppData } from "../../providers/AppDataProvider";
import { useResponsiveLayout } from "../../styles/responsive";
import { colors, radii, shadows, spacing } from "../../styles/tokens";
import { formatGameLabel } from "../../lib/formatters";
import type { Game } from "@mlb-attendance/domain";
import { MEMORY_CHIPS, applyMemoryChip } from "../history/gameDetailHelpers";
import { APP_DESIGN_PRINCIPLE, APP_NAME, APP_TAGLINE } from "../../config/brand";

type StatusTone = "idle" | "info" | "success" | "error";
type SeatRecallMode = "remember" | "unknown" | "later";

function buildGameBadges(game: Game, favoriteTeamId?: string) {
  const totalRuns = game.homeScore + game.awayScore;
  const badges = [];

  if (favoriteTeamId && (game.homeTeamId === favoriteTeamId || game.awayTeamId === favoriteTeamId)) {
    badges.push("Favorite team");
  }
  if (totalRuns >= 10) {
    badges.push("High scoring");
  }
  if ((game.innings ?? 0) > 9) {
    badges.push("Extra innings");
  }
  if (game.featuredPlayerHomeRun) {
    badges.push("Home run");
  }
  if (game.walkOff) {
    badges.push("Walk-off");
  }

  return badges;
}

function getTopBatterPreview(game: Game) {
  return [...(game.battersUsed ?? [])]
    .sort((left, right) => {
      if (right.homeRuns !== left.homeRuns) {
        return right.homeRuns - left.homeRuns;
      }
      if (right.hits !== left.hits) {
        return right.hits - left.hits;
      }
      return right.rbis - left.rbis;
    })[0];
}

function getTopPitcherPreview(game: Game) {
  return [...(game.pitchersUsed ?? [])]
    .sort((left, right) => {
      if ((right.strikeouts ?? 0) !== (left.strikeouts ?? 0)) {
        return (right.strikeouts ?? 0) - (left.strikeouts ?? 0);
      }
      return (right.inningsPitched ?? 0) - (left.inningsPitched ?? 0);
    })[0];
}

export function LogGameScreen() {
  const router = useRouter();
  const responsive = useResponsiveLayout();
  const { profile, teams, venues, games, searchGames, addAttendanceLog } = useAppData();
  const isWide = responsive.isWideDesktop;
  const isCompact = responsive.isCompact;
  const showStickySaveBar = responsive.isNarrow;
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
  const [seatRecallMode, setSeatRecallMode] = useState<SeatRecallMode>("later");
  const [memorableMoment, setMemorableMoment] = useState("");
  const [companion, setCompanion] = useState("");
  const [giveaway, setGiveaway] = useState("");
  const [weather, setWeather] = useState("");
  const [searchError, setSearchError] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchStatus, setSearchStatus] = useState<{ tone: StatusTone; message: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ tone: StatusTone; message: string } | null>(null);
  const selectedGameLabel = selectedGame ? formatGameLabel(selectedGame, teamsById, venuesById) : null;
  const seasonChips = useMemo(
    () =>
      [...new Set(games.map((game) => game.startDate.slice(0, 4)).filter(Boolean))]
        .sort((left, right) => Number(right) - Number(left))
        .slice(0, 3),
    [games]
  );
  const venueChips = useMemo(() => {
    const favoriteVenueIds = favoriteTeam
      ? [...new Set(games.filter((game) => game.homeTeamId === favoriteTeam.id).map((game) => game.venueId))]
      : [];
    const recentVenueIds = [...new Set(games.slice(0, 20).map((game) => game.venueId))];
    return [...new Set([...favoriteVenueIds, ...recentVenueIds])]
      .map((venueId) => venuesById.get(venueId))
      .filter((venue): venue is NonNullable<typeof venue> => Boolean(venue))
      .slice(0, 3);
  }, [favoriteTeam, games, venuesById]);
  const selectedTopBatter = useMemo(
    () => (selectedGame ? getTopBatterPreview(selectedGame) : undefined),
    [selectedGame]
  );
  const selectedTopPitcher = useMemo(
    () => (selectedGame ? getTopPitcherPreview(selectedGame) : undefined),
    [selectedGame]
  );

  const quickFinds: Array<{ label: string; action: () => Promise<void> }> = [
    ...(favoriteTeam
      ? [{ label: favoriteTeam.abbreviation, action: () => applyQuickSearch({ query: favoriteTeam.abbreviation }) }]
      : []),
    ...seasonChips.map((season) => ({ label: season, action: () => applyQuickSearch({ date: season }) })),
    ...venueChips.map((venue) => ({ label: venue.name, action: () => applyQuickSearch({ stadium: venue.name }) })),
    { label: "Recent games", action: () => applyQuickSearch({}) }
  ];

  async function handleSearch() {
    setIsSearching(true);
    setConfirmation(null);
    setSaveStatus(null);
    setSearchStatus({
      tone: "info",
      message: "Searching the MLB catalog now."
    });

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
      setSearchStatus(
        visibleMatches.length
          ? {
              tone: "success",
              message: `${visibleMatches.length} game${visibleMatches.length === 1 ? "" : "s"} ready to review.`
            }
          : {
              tone: "error",
              message: "No games matched that search."
            }
      );
      setSelectedGame(null);
      setSeatRecallMode("later");
    } catch {
      setSearchStatus({
        tone: "error",
        message: "Search failed. Try again."
      });
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
    setSaveStatus(null);
    setSearchStatus({
      tone: "info",
      message: "Searching the MLB catalog now."
    });

    try {
      const matches = await searchGames(next);
      const orderedMatches = [...matches].sort((left, right) => right.startDate.localeCompare(left.startDate));
      const visibleMatches = next.query || next.date || next.stadium ? orderedMatches : orderedMatches.slice(0, 12);
      setResults(visibleMatches);
      setSelectedGame(null);
      setSeatRecallMode("later");
      setSearchError(visibleMatches.length ? "" : "No games matched that quick find. Try a manual search.");
      setSearchStatus(
        visibleMatches.length
          ? {
              tone: "success",
              message: `${visibleMatches.length} game${visibleMatches.length === 1 ? "" : "s"} ready to review.`
            }
          : {
              tone: "error",
              message: "No games matched that quick find."
            }
      );
    } catch {
      setSearchStatus({
        tone: "error",
        message: "Search failed. Try again."
      });
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSave() {
    if (!selectedGame) {
      setSearchError("Select a game before saving.");
      setSaveStatus({
        tone: "error",
        message: "Choose a game before saving."
      });
      return;
    }

    setIsSaving(true);
    setSaveStatus({
      tone: "info",
      message: "Saving this game to your ledger now."
    });

    try {
      const savedLog = await addAttendanceLog({
        userId: profile.id,
        gameId: selectedGame.id,
        seat: {
          section: section.trim() || "Unknown",
          row,
          seatNumber
        },
        memorableMoment,
        companion,
        giveaway,
        weather
      });

      setSearchError("");
      setConfirmation(
        `Saved ${savedLog.attendedOn} in section ${savedLog.seat.section}. You can review it in History and Fan Résumé now.`
      );
      setSaveStatus({
        tone: "success",
        message: "Saved to your ledger."
      });
      setSelectedGame(null);
      setResults([]);
      setSection("");
      setRow("");
      setSeatNumber("");
      setSeatRecallMode("later");
      setMemorableMoment("");
      setCompanion("");
      setGiveaway("");
      setWeather("");
      router.push((`/log-recap?logId=${encodeURIComponent(savedLog.id)}`) as Href);
    } catch (error) {
      setConfirmation(null);
      const message = error instanceof Error ? error.message : "We could not save that game.";
      setSearchError(message);
      setSaveStatus({
        tone: "error",
        message
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen
      scrollable={false}
      title="Log a Game"
      subtitle={`${APP_NAME} is built to collect the night fast: find the matchup, confirm the memory, and save without getting trapped in a long form.`}
    >
      <View style={styles.screen}>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[styles.scrollContent, showStickySaveBar ? styles.scrollContentWithStickyBar : null]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stepRow}>
            <StatusPill label="Find" tone="info" />
            <StatusPill label="Confirm" tone={selectedGame ? "success" : "default"} />
            <StatusPill label="Save" tone={selectedGame ? "warning" : "default"} />
            <StatusPill label="Relive it later" tone="default" />
          </View>

          <SectionCard title="Find a game you attended" subtitle={APP_TAGLINE}>
            <View style={styles.searchHero}>
              <View style={styles.quickFindHeader}>
                <Text style={styles.heroSearchTitle}>Find a game you attended.</Text>
                <Text style={styles.helperText}>{APP_DESIGN_PRINCIPLE}</Text>
              </View>
              <View style={styles.quickFindRow}>
                {quickFinds.map((quickFind) => (
                  <FilterChip key={quickFind.label} label={quickFind.label} onPress={quickFind.action} />
                ))}
              </View>
              <View style={[styles.formGrid, isWide ? styles.formGridWide : null]}>
                <View style={[styles.formColumn, styles.searchLeadColumn]}>
                  <LabeledInput
                    label="Search MLB matchups"
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Yankees at Mets, Dodgers, Red Sox, BAL..."
                    returnKeyType="search"
                    onSubmitEditing={() => {
                      void handleSearch();
                    }}
                  />
                </View>
                <View style={styles.formColumn}>
                  <LabeledInput
                    label="Season or date"
                    value={date}
                    onChangeText={setDate}
                    placeholder="2025, 07/20/2025, or July 20, 2025"
                    autoCapitalize="none"
                    returnKeyType="search"
                    onSubmitEditing={() => {
                      void handleSearch();
                    }}
                  />
                </View>
                <View style={styles.formColumn}>
                  <LabeledInput
                    label="Venue"
                    value={stadium}
                    onChangeText={setStadium}
                    placeholder="Fenway Park, Yankee Stadium..."
                    returnKeyType="search"
                    onSubmitEditing={() => {
                      void handleSearch();
                    }}
                  />
                </View>
              </View>
              <View style={styles.searchActionRow}>
                <PrimaryButton label={isSearching ? "Searching..." : "Search Games"} onPress={handleSearch} disabled={isSearching} />
                <View style={styles.searchMetaCard}>
                  <Text style={styles.searchMetaLabel}>Catalog ready</Text>
                  <Text style={styles.searchMetaValue}>{games.length} MLB finals in the archive</Text>
                  <Text style={styles.searchMetaCopy}>No filter also works. FandomHub will show the most recent finals first.</Text>
                </View>
              </View>
              {searchStatus ? (
                <View style={[styles.statusCard, searchStatus.tone === "success" ? styles.statusCardSuccess : null, searchStatus.tone === "error" ? styles.statusCardError : null]}>
                  <Text style={[styles.statusText, searchStatus.tone === "success" ? styles.statusTextSuccess : null, searchStatus.tone === "error" ? styles.statusTextError : null]}>
                    {searchStatus.message}
                  </Text>
                </View>
              ) : null}
              {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}
            </View>
          </SectionCard>

          {results.length ? (
            <SectionCard title={`Search results (${results.length})`} subtitle="Visual cards make it easier to find the exact night fast.">
              <View style={[styles.resultsGrid, !isCompact ? styles.resultsGridWide : null]}>
                {results.map((game) => {
                  const label = formatGameLabel(game, teamsById, venuesById);
                  const isSelected = selectedGame?.id === game.id;
                  const badges = buildGameBadges(game, favoriteTeam?.id);

                  return (
                    <Pressable
                      key={game.id}
                      onPress={() => {
                        setSelectedGame(game);
                        setSearchError("");
                        setConfirmation(null);
                      }}
                      style={[styles.gameOption, !isCompact ? styles.gameOptionWide : null, isSelected ? styles.gameOptionSelected : null]}
                    >
                      <Text style={styles.gameTitle}>{label.title}</Text>
                      <Text style={styles.gameSubtitle}>{label.subtitle}</Text>
                      <Text style={styles.gameScore}>Final: {label.score}</Text>
                      <View style={styles.noteRow}>
                        {badges.map((badge) => (
                          <StatusPill key={`${game.id}_${badge}`} label={badge} tone={badge === "Favorite team" ? "success" : "default"} />
                        ))}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </SectionCard>
          ) : null}

          <View style={[styles.topGrid, isWide ? styles.topGridWide : null]}>
            <SectionCard title="This is the one" subtitle="Confirm the exact matchup before you save it to your ledger.">
              {selectedGame && selectedGameLabel ? (
                <View style={styles.selectedGameCard}>
                  <Text style={styles.confirmEyebrow}>This is the one</Text>
                  <Text style={styles.gameTitle}>{selectedGameLabel.title}</Text>
                  <Text style={styles.gameSubtitle}>{selectedGameLabel.subtitle}</Text>
                  <Text style={styles.gameScore}>Final: {selectedGameLabel.score}</Text>
                  <View style={styles.noteRow}>
                    {buildGameBadges(selectedGame, favoriteTeam?.id).map((badge) => (
                      <StatusPill key={badge} label={badge} tone={badge === "Favorite team" ? "success" : "info"} />
                    ))}
                  </View>
                  {selectedTopBatter ? (
                    <Text style={styles.helperText}>
                      Top hitter preview: {selectedTopBatter.playerName} with {selectedTopBatter.hits} hit{selectedTopBatter.hits === 1 ? "" : "s"}
                      {selectedTopBatter.homeRuns ? ` and ${selectedTopBatter.homeRuns} HR` : ""}.
                    </Text>
                  ) : null}
                  {selectedTopPitcher ? (
                    <Text style={styles.helperText}>
                      Pitching preview: {selectedTopPitcher.pitcherName} with {selectedTopPitcher.strikeouts ?? 0} strikeouts.
                    </Text>
                  ) : null}
                </View>
              ) : (
                <EmptyState
                  eyebrow="Select a matchup"
                  title="No game selected yet"
                  body="Use search or chips above, then pick the exact attended game before you save."
                />
              )}
            </SectionCard>

            <SectionCard title="Seat details are optional" subtitle="Capture what you remember now and leave the rest for later if needed.">
              <Text style={styles.helperText}>Game selection is the only thing required. If you skip everything here, FandomHub saves the seat as unknown.</Text>
              <View style={styles.quickFindRow}>
                <FilterChip
                  label="I remember my seat"
                  selected={seatRecallMode === "remember"}
                  onPress={() => setSeatRecallMode("remember")}
                />
                <FilterChip
                  label="I don't remember seat"
                  selected={seatRecallMode === "unknown"}
                  onPress={() => {
                    setSeatRecallMode("unknown");
                    setSection("Unknown");
                    setRow("");
                    setSeatNumber("");
                  }}
                />
                <FilterChip
                  label="Add later"
                  selected={seatRecallMode === "later"}
                  onPress={() => {
                    setSeatRecallMode("later");
                    setSection("");
                    setRow("");
                    setSeatNumber("");
                  }}
                />
              </View>
              <LabeledInput
                label="Section"
                value={section}
                onChangeText={(value) => {
                  setSection(value);
                  setSeatRecallMode("remember");
                }}
                placeholder="214A"
                autoCapitalize="characters"
              />
              <View style={[styles.formGrid, styles.formGridWide]}>
                <View style={styles.formColumn}>
                  <LabeledInput
                    label="Row (optional)"
                    value={row}
                    onChangeText={(value) => {
                      setRow(value);
                      setSeatRecallMode("remember");
                    }}
                    placeholder="5"
                    autoCapitalize="characters"
                  />
                </View>
                <View style={styles.formColumn}>
                  <LabeledInput
                    label="Seat (optional)"
                    value={seatNumber}
                    onChangeText={(value) => {
                      setSeatNumber(value);
                      setSeatRecallMode("remember");
                    }}
                    placeholder="7"
                    autoCapitalize="characters"
                  />
                </View>
              </View>
              {!showStickySaveBar ? (
                <PrimaryButton
                  label={isSaving ? "Saving..." : "Save Game"}
                  onPress={handleSave}
                  disabled={!selectedGame || isSaving}
                />
              ) : null}
              {saveStatus ? (
                <View style={[styles.statusCard, saveStatus.tone === "success" ? styles.statusCardSuccess : null, saveStatus.tone === "error" ? styles.statusCardError : null]}>
                  <Text style={[styles.statusText, saveStatus.tone === "success" ? styles.statusTextSuccess : null, saveStatus.tone === "error" ? styles.statusTextError : null]}>
                    {saveStatus.message}
                  </Text>
                </View>
              ) : null}
            </SectionCard>
          </View>

          <SectionCard title="Add a memory if you want" subtitle="These details make the save feel richer later, but every field can be skipped.">
            <Text style={styles.helperText}>
              A quick line now makes the game feel personal later. Skip everything if you just want the save in your ledger.
            </Text>
            <LabeledInput
              label="What do you remember most?"
              value={memorableMoment}
              onChangeText={setMemorableMoment}
              placeholder="Big play, rivalry feel, birthday trip, or whatever still sticks."
              multiline
              numberOfLines={4}
            />
            <Text style={styles.helperText}>Quick memory sparks</Text>
            <View style={styles.memoryChipRow}>
              {MEMORY_CHIPS.map((chip) => (
                <FilterChip
                  key={chip}
                  label={chip}
                  onPress={() => setMemorableMoment((current) => applyMemoryChip(current, chip))}
                />
              ))}
            </View>
            <LabeledInput
              label="Who did you go with?"
              value={companion}
              onChangeText={setCompanion}
              placeholder="Friend, family, date, coworkers..."
            />
            <View style={[styles.formGrid, styles.formGridWide]}>
              <View style={styles.formColumn}>
                <LabeledInput
                  label="Giveaway or souvenir"
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
                  placeholder="Warm, cold, rain delay..."
                />
              </View>
            </View>
            <Pressable
              onPress={() => {
                setMemorableMoment("");
                setCompanion("");
                setGiveaway("");
                setWeather("");
              }}
            >
              <Text style={styles.skipText}>Skip for now</Text>
            </Pressable>
          </SectionCard>

          {confirmation ? (
            <SectionCard title="Saved" subtitle="Your log is in the ledger and ready for review.">
              <Text style={styles.successText}>{confirmation}</Text>
              <PrimaryButton label="View History" onPress={() => router.push("/(tabs)/history")} />
            </SectionCard>
          ) : null}
        </ScrollView>

        {showStickySaveBar ? (
          <View style={styles.stickySaveBar}>
            <View style={styles.stickySaveCopy}>
              <Text style={styles.stickySaveTitle}>{selectedGameLabel ? "Ready to save" : "Choose a game first"}</Text>
              <Text style={styles.stickySaveMeta}>
                {selectedGameLabel ? selectedGameLabel.title : "Search and tap the exact game you attended."}
              </Text>
            </View>
            <PrimaryButton
              label={isSaving ? "Saving..." : "Save Game"}
              onPress={handleSave}
              disabled={!selectedGame || isSaving}
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  scrollArea: {
    flex: 1
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.xl
  },
  scrollContentWithStickyBar: {
    paddingBottom: 132
  },
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
  searchLeadColumn: {
    flex: 1.4
  },
  searchHero: {
    gap: spacing.md
  },
  heroSearchTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    color: colors.text
  },
  searchActionRow: {
    gap: spacing.md
  },
  searchMetaCard: {
    backgroundColor: colors.surfaceAccent,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: radii.lg,
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
  memoryChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  stepRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  skipText: {
    fontSize: 14,
    fontWeight: "600",
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
  resultsGridWide: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  gameOption: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.surfaceRaised,
    ...shadows.card
  },
  gameOptionWide: {
    width: "48%"
  },
  gameOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAccent,
    transform: [{ translateY: -1 }]
  },
  confirmEyebrow: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontWeight: "800",
    color: colors.clay
  },
  gameTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.text
  },
  gameSubtitle: {
    fontSize: 14,
    color: colors.textMuted
  },
  gameScore: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primary
  },
  noteRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  selectedGameCard: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceAccent,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    padding: spacing.lg
  },
  errorText: {
    fontSize: 13,
    color: colors.danger
  },
  statusCard: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  statusCardSuccess: {
    borderColor: colors.info,
    backgroundColor: colors.surfaceAccent
  },
  statusCardError: {
    borderColor: colors.danger,
    backgroundColor: colors.surfaceDanger
  },
  statusText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted
  },
  statusTextSuccess: {
    color: colors.primary
  },
  statusTextError: {
    color: colors.danger
  },
  successText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted
  },
  stickySaveBar: {
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    backgroundColor: "rgba(255, 251, 244, 0.98)",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm
  },
  stickySaveCopy: {
    gap: 2
  },
  stickySaveTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.primary
  },
  stickySaveMeta: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted
  }
});
