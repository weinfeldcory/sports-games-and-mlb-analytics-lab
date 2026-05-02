import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { AttendanceLog, Game, PlayerBattingSummary, PlayerPitchingSummary, Team, Venue } from "@mlb-attendance/domain";
import { PlaceholderPanel } from "../../components/common/PlaceholderPanel";
import { Screen } from "../../components/common/Screen";
import { SectionCard } from "../../components/common/SectionCard";
import { DropdownField, type DropdownOption } from "../../components/common/DropdownField";
import { formatBaseballInnings } from "../../lib/formatters";
import { useAppData } from "../../providers/AppDataProvider";
import { colors, spacing } from "../../styles/tokens";

type BatterSortKey =
  | "gamesSeen"
  | "atBatsSeen"
  | "hitsSeen"
  | "battingAverageSeen"
  | "homeRunsSeen"
  | "rbisSeen"
  | "walksSeen"
  | "strikeoutsSeenAtPlate";
type PitcherSortKey =
  | "appearances"
  | "strikeoutsSeen"
  | "inningsSeen"
  | "hitsAllowedSeen"
  | "runsAllowedSeen"
  | "eraSeen";
type SortDirection = "desc" | "asc";
type SplitKey = "season" | "opponent" | "stadium" | "weekday" | "favorite-side";

interface SplitSummary {
  key: string;
  label: string;
  games: number;
  wins: number;
  losses: number;
  hitsSeen: number;
  runsSeen: number;
  homeRunsSeen: number;
}

function formatWinPct(wins: number, losses: number) {
  const total = wins + losses;
  if (!total) {
    return ".000";
  }

  return `${(wins / total).toFixed(3).replace(/^0/, "")}`;
}

function formatAverage(value: number) {
  return value.toFixed(3).replace(/^0\./, ".");
}

function formatEra(value: number) {
  return value.toFixed(2);
}

function formatPitchingStatLine(params: {
  inningsPitched?: number;
  hitsAllowed?: number;
  runsAllowed?: number;
  earnedRunsAllowed?: number;
  walksAllowed?: number;
  strikeouts?: number;
  homeRunsAllowed?: number;
  pitchesThrown?: number;
  strikes?: number;
}) {
  const {
    inningsPitched,
    hitsAllowed,
    runsAllowed,
    earnedRunsAllowed,
    walksAllowed,
    strikeouts,
    homeRunsAllowed,
    pitchesThrown,
    strikes
  } = params;

  const segments = [
    inningsPitched !== undefined ? `${formatBaseballInnings(inningsPitched)} IP` : null,
    hitsAllowed !== undefined ? `${hitsAllowed} H` : null,
    runsAllowed !== undefined ? `${runsAllowed} R` : null,
    earnedRunsAllowed !== undefined ? `${earnedRunsAllowed} ER` : null,
    walksAllowed !== undefined ? `${walksAllowed} BB` : null,
    strikeouts !== undefined ? `${strikeouts} K` : null,
    homeRunsAllowed !== undefined ? `${homeRunsAllowed} HR` : null,
    pitchesThrown !== undefined
      ? strikes !== undefined
        ? `${pitchesThrown}-${strikes} P-S`
        : `${pitchesThrown} pitches`
      : null
  ].filter(Boolean);

  return segments.join(" • ");
}

function getWeekdayLabel(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/New_York"
  }).format(parsed);
}

function buildSplitSummaries(params: {
  splitKey: SplitKey;
  attendanceLogs: AttendanceLog[];
  games: Game[];
  teams: Team[];
  venues: Venue[];
  favoriteTeamId?: string;
}): SplitSummary[] {
  const { splitKey, attendanceLogs, games, teams, venues, favoriteTeamId } = params;
  const gamesById = new Map(games.map((game) => [game.id, game]));
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const venuesById = new Map(venues.map((venue) => [venue.id, venue]));
  const splitMap = new Map<string, SplitSummary>();

  attendanceLogs.forEach((log) => {
    const game = gamesById.get(log.gameId);
    if (!game) {
      return;
    }

    let bucketKey = "";
    let label = "";

    switch (splitKey) {
      case "season":
        bucketKey = log.attendedOn.slice(0, 4);
        label = bucketKey || "Unknown season";
        break;
      case "opponent": {
        const opponentId = favoriteTeamId
          ? game.homeTeamId === favoriteTeamId
            ? game.awayTeamId
            : game.awayTeamId === favoriteTeamId
              ? game.homeTeamId
              : game.awayTeamId
          : game.awayTeamId;
        const opponent = teamsById.get(opponentId);
        bucketKey = opponentId;
        label = opponent ? `${opponent.city} ${opponent.name}` : "Unknown opponent";
        break;
      }
      case "stadium": {
        const venue = venuesById.get(game.venueId);
        bucketKey = game.venueId;
        label = venue ? venue.name : "Unknown venue";
        break;
      }
      case "weekday":
        bucketKey = getWeekdayLabel(log.attendedOn);
        label = bucketKey;
        break;
      case "favorite-side":
        if (!favoriteTeamId) {
          return;
        }

        if (game.homeTeamId === favoriteTeamId) {
          bucketKey = "favorite-home";
          label = "Favorite team at home";
        } else if (game.awayTeamId === favoriteTeamId) {
          bucketKey = "favorite-away";
          label = "Favorite team on the road";
        } else {
          bucketKey = "favorite-absent";
          label = "Games without favorite team";
        }
        break;
    }

    const existing = splitMap.get(bucketKey) ?? {
      key: bucketKey,
      label,
      games: 0,
      wins: 0,
      losses: 0,
      hitsSeen: 0,
      runsSeen: 0,
      homeRunsSeen: 0
    };

    existing.games += 1;
    existing.wins += log.witnessedEvents.some((event) => event.type === "team_win") ? 1 : 0;
    existing.losses += log.witnessedEvents.some((event) => event.type === "team_loss") ? 1 : 0;
    existing.hitsSeen += game.homeHits + game.awayHits;
    existing.runsSeen += game.homeScore + game.awayScore;
    existing.homeRunsSeen += game.battersUsed?.reduce((total, batter) => total + batter.homeRuns, 0) ?? 0;
    splitMap.set(bucketKey, existing);
  });

  return [...splitMap.values()].sort((left, right) => {
    if (right.games !== left.games) {
      return right.games - left.games;
    }

    return left.label.localeCompare(right.label);
  });
}

function sortNumeric<T>(
  rows: T[],
  key: keyof T & string,
  direction: SortDirection,
  fallback: keyof T & string,
  nameKey: keyof T & string
) {
  const factor = direction === "desc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const primary = ((right[key] as number) - (left[key] as number)) * factor;
    if (primary !== 0) {
      return primary;
    }

    const secondary = ((right[fallback] as number) - (left[fallback] as number)) * factor;
    if (secondary !== 0) {
      return secondary;
    }

    return String(left[nameKey]).localeCompare(String(right[nameKey]));
  });
}

function toggleSort<T extends string>(
  activeKey: T,
  nextKey: T,
  direction: SortDirection,
  setKey: (key: T) => void,
  setDirection: (value: SortDirection) => void
) {
  if (activeKey === nextKey) {
    setDirection(direction === "desc" ? "asc" : "desc");
    return;
  }

  setKey(nextKey);
  setDirection("desc");
}

function HeaderCell(props: {
  label: string;
  width?: number;
  align?: "left" | "right";
  active?: boolean;
  direction?: SortDirection;
  onPress?: () => void;
}) {
  const { label, width = 52, align = "right", active = false, direction = "desc", onPress } = props;

  if (!onPress) {
    return (
      <View style={[styles.headerCell, { width }, align === "left" ? styles.nameCol : null]}>
        <Text style={[styles.headerText, { textAlign: align }]}>{label}</Text>
      </View>
    );
  }

  return (
    <Pressable onPress={onPress} style={[styles.headerCell, { width }, align === "left" ? styles.nameCol : null]}>
      <Text style={[styles.headerText, active ? styles.headerTextActive : null, { textAlign: align }]}>
        {label} {active ? (direction === "desc" ? "↓" : "↑") : ""}
      </Text>
    </Pressable>
  );
}

function BatterRow({ player }: { player: PlayerBattingSummary }) {
  return (
    <View style={styles.tableRow}>
      <View style={styles.nameCol}>
        <Text style={styles.nameText}>{player.playerName}</Text>
        <Text style={styles.subText}>{[player.teams.join(", "), player.positions.join(", ")].filter(Boolean).join(" • ")}</Text>
      </View>
      <Text style={styles.cellText}>{player.gamesSeen}</Text>
      <Text style={styles.cellText}>{player.atBatsSeen}</Text>
      <Text style={styles.cellText}>{player.hitsSeen}</Text>
      <Text style={styles.cellText}>{formatAverage(player.battingAverageSeen)}</Text>
      <Text style={styles.cellText}>{player.homeRunsSeen}</Text>
      <Text style={styles.cellText}>{player.rbisSeen}</Text>
      <Text style={styles.cellText}>{player.walksSeen}</Text>
      <Text style={styles.cellText}>{player.strikeoutsSeenAtPlate}</Text>
    </View>
  );
}

function PitcherRow({ pitcher }: { pitcher: PlayerPitchingSummary }) {
  return (
    <View style={styles.tableRow}>
      <View style={styles.nameCol}>
        <Text style={styles.nameText}>{pitcher.pitcherName}</Text>
        <Text style={styles.subText}>{[pitcher.teams.join(", "), pitcher.roles.join(", ")].filter(Boolean).join(" • ")}</Text>
      </View>
      <Text style={styles.cellText}>{pitcher.appearances}</Text>
      <Text style={styles.cellText}>{pitcher.strikeoutsSeen}</Text>
      <Text style={styles.cellText}>{formatBaseballInnings(pitcher.inningsSeen)}</Text>
      <Text style={styles.cellText}>{pitcher.hitsAllowedSeen}</Text>
      <Text style={styles.cellText}>{pitcher.runsAllowedSeen}</Text>
      <Text style={styles.cellText}>{formatEra(pitcher.eraSeen)}</Text>
    </View>
  );
}

export function StatsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { stats, attendanceLogs, games, teams, venues, profile } = useAppData();
  const isWide = width >= 1080;
  const [batterSortKey, setBatterSortKey] = useState<BatterSortKey>("homeRunsSeen");
  const [batterSortDirection, setBatterSortDirection] = useState<SortDirection>("desc");
  const [pitcherSortKey, setPitcherSortKey] = useState<PitcherSortKey>("strikeoutsSeen");
  const [pitcherSortDirection, setPitcherSortDirection] = useState<SortDirection>("desc");
  const [minBatterGames, setMinBatterGames] = useState(0);
  const [minBatterAtBats, setMinBatterAtBats] = useState(0);
  const [minPitcherAppearances, setMinPitcherAppearances] = useState(0);
  const [minPitcherInnings, setMinPitcherInnings] = useState(0);
  const [batterTeamFilter, setBatterTeamFilter] = useState("all");
  const [batterPositionFilter, setBatterPositionFilter] = useState("all");
  const [pitcherTeamFilter, setPitcherTeamFilter] = useState("all");
  const [pitcherRoleFilter, setPitcherRoleFilter] = useState("all");
  const [splitKey, setSplitKey] = useState<SplitKey>("season");
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  const batterGameOptions = useMemo<Array<DropdownOption<number>>>(() => {
    const values = [0, ...new Set(stats.playerBattingSummaries.map((player) => player.gamesSeen).sort((left, right) => left - right))];
    return values.map((value) => ({
      value,
      label: value === 0 ? "All games" : `${value}+ games`
    }));
  }, [stats.playerBattingSummaries]);

  const batterAbOptions = useMemo<Array<DropdownOption<number>>>(() => {
    const values = [0, ...new Set(stats.playerBattingSummaries.map((player) => player.atBatsSeen).sort((left, right) => left - right))];
    return values.map((value) => ({
      value,
      label: value === 0 ? "All at-bats" : `${value}+ AB`
    }));
  }, [stats.playerBattingSummaries]);

  const pitcherAppearanceOptions = useMemo<Array<DropdownOption<number>>>(() => {
    const values = [0, ...new Set(stats.playerPitchingSummaries.map((pitcher) => pitcher.appearances).sort((left, right) => left - right))];
    return values.map((value) => ({
      value,
      label: value === 0 ? "All appearances" : `${value}+ appearances`
    }));
  }, [stats.playerPitchingSummaries]);

  const pitcherInningOptions = useMemo<Array<DropdownOption<number>>>(() => {
    const values = [0, ...new Set(stats.playerPitchingSummaries.map((pitcher) => pitcher.inningsSeen).sort((left, right) => left - right))];
    return values.map((value) => ({
      value,
      label: value === 0 ? "All innings" : `${formatBaseballInnings(value)}+ IP`
    }));
  }, [stats.playerPitchingSummaries]);

  const batterTeamOptions = useMemo<Array<DropdownOption<string>>>(() => {
    const teams = [...new Set(stats.playerBattingSummaries.flatMap((player) => player.teams))].sort((left, right) => left.localeCompare(right));
    return [{ label: "All teams", value: "all" }, ...teams.map((team) => ({ label: team, value: team }))];
  }, [stats.playerBattingSummaries]);

  const batterPositionOptions = useMemo<Array<DropdownOption<string>>>(() => {
    const positions = [...new Set(stats.playerBattingSummaries.flatMap((player) => player.positions))].sort((left, right) => left.localeCompare(right));
    return [{ label: "All positions", value: "all" }, ...positions.map((position) => ({ label: position, value: position }))];
  }, [stats.playerBattingSummaries]);

  const pitcherTeamOptions = useMemo<Array<DropdownOption<string>>>(() => {
    const teams = [...new Set(stats.playerPitchingSummaries.flatMap((pitcher) => pitcher.teams))].sort((left, right) => left.localeCompare(right));
    return [{ label: "All teams", value: "all" }, ...teams.map((team) => ({ label: team, value: team }))];
  }, [stats.playerPitchingSummaries]);

  const pitcherRoleOptions = useMemo<Array<DropdownOption<string>>>(() => {
    const roles = [...new Set(stats.playerPitchingSummaries.flatMap((pitcher) => pitcher.roles))].sort((left, right) => left.localeCompare(right));
    return [{ label: "All roles", value: "all" }, ...roles.map((role) => ({ label: role, value: role }))];
  }, [stats.playerPitchingSummaries]);

  const filteredBatters = useMemo(() => {
    return stats.playerBattingSummaries.filter(
      (player) =>
        player.gamesSeen >= minBatterGames &&
        player.atBatsSeen >= minBatterAtBats &&
        (batterTeamFilter === "all" || player.teams.includes(batterTeamFilter)) &&
        (batterPositionFilter === "all" || player.positions.includes(batterPositionFilter))
    );
  }, [batterPositionFilter, batterTeamFilter, minBatterAtBats, minBatterGames, stats.playerBattingSummaries]);

  const filteredPitchers = useMemo(() => {
    return stats.playerPitchingSummaries.filter(
      (pitcher) =>
        pitcher.appearances >= minPitcherAppearances &&
        pitcher.inningsSeen >= minPitcherInnings &&
        (pitcherTeamFilter === "all" || pitcher.teams.includes(pitcherTeamFilter)) &&
        (pitcherRoleFilter === "all" || pitcher.roles.includes(pitcherRoleFilter))
    );
  }, [minPitcherAppearances, minPitcherInnings, pitcherRoleFilter, pitcherTeamFilter, stats.playerPitchingSummaries]);

  const sortedBatters = useMemo(() => {
    return sortNumeric(filteredBatters, batterSortKey, batterSortDirection, "hitsSeen", "playerName");
  }, [batterSortDirection, batterSortKey, filteredBatters]);

  const sortedPitchers = useMemo(() => {
    return sortNumeric(filteredPitchers, pitcherSortKey, pitcherSortDirection, "strikeoutsSeen", "pitcherName");
  }, [filteredPitchers, pitcherSortDirection, pitcherSortKey]);

  const splitOptions: Array<DropdownOption<SplitKey>> = [
    { label: "Season", value: "season" },
    { label: "Opponent", value: "opponent" },
    { label: "Stadium", value: "stadium" },
    { label: "Weekday", value: "weekday" },
    { label: "Favorite team home/away", value: "favorite-side" }
  ];

  const splitSummaries = useMemo(() => {
    return buildSplitSummaries({
      splitKey,
      attendanceLogs,
      games,
      teams,
      venues,
      favoriteTeamId: profile.favoriteTeamId
    });
  }, [attendanceLogs, games, profile.favoriteTeamId, splitKey, teams, venues]);

  const topSplitSummaries = splitSummaries.slice(0, 3);
  const gamesById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games]);
  const venuesById = useMemo(() => new Map(venues.map((venue) => [venue.id, venue])), [venues]);

  const summaryCards = useMemo(() => {
    const topBatter = stats.playerBattingSummaries[0];
    const topPitcher = stats.playerPitchingSummaries[0];
    const topTeam = stats.teamSeenSummaries[0];
    const topStart = stats.topPitchingGamePerformances[0];
    const topStartGame = topStart ? gamesById.get(topStart.gameId) : undefined;
    const topStartVenue = topStart ? venuesById.get(topStart.venueId) : undefined;

    return [
      {
        label: "Best Opposing Bat Seen",
        value: topBatter ? topBatter.playerName : "No batter data",
        details: topBatter
          ? `${topBatter.homeRunsSeen} HR • ${topBatter.hitsSeen} hits • ${topBatter.gamesSeen} games`
          : "Save games with batter lines to unlock this."
      },
      {
        label: "Best Starting Pitching Performance You Saw",
        value: topStart ? topStart.pitcherName : "No start data",
        details: topStart
          ? [
              `${topStart.opponentTeamName} • ${topStart.startDate}${topStartVenue ? ` • ${topStartVenue.name}` : ""}`,
              topStartGame ? `Final score ${topStartGame.awayScore}-${topStartGame.homeScore}` : null,
              `Game Score ${topStart.gameScore}`,
              formatPitchingStatLine({
                inningsPitched: topStart.inningsPitched,
                hitsAllowed: topStart.hitsAllowed,
                runsAllowed: topStart.runsAllowed,
                earnedRunsAllowed: topStart.earnedRunsAllowed,
                walksAllowed: topStart.walksAllowed,
                strikeouts: topStart.strikeouts,
                homeRunsAllowed: topStart.homeRunsAllowed,
                pitchesThrown: topStart.pitchesThrown,
                strikes: topStart.strikes
              }),
              "Ranked by Game Score: outs and strikeouts increase the score; hits, walks, runs, and home runs lower it."
            ].filter(Boolean)
          : "Save games with pitcher lines to unlock this."
      },
      {
        label: "Most-Seen Team",
        value: topTeam ? topTeam.teamName : "No team data",
        details: topTeam
          ? `${topTeam.gamesSeen} games • ${topTeam.winsSeen}-${topTeam.lossesSeen} seen • ${topTeam.runsSeen} runs`
          : "Log games to build team coverage."
      },
      {
        label: "Pitcher Seen Most",
        value: topPitcher ? topPitcher.pitcherName : "No pitcher data",
        details: topPitcher
          ? [
              `Ranked by innings pitched in games you logged.`,
              `${formatBaseballInnings(topPitcher.inningsSeen)} innings watched • ${topPitcher.appearances} appearances`,
              `${topPitcher.strikeoutsSeen} strikeouts watched`
            ]
          : "Save games with pitcher lines to unlock this."
      }
    ];
  }, [gamesById, stats.playerBattingSummaries, stats.playerPitchingSummaries, stats.teamSeenSummaries, stats.topPitchingGamePerformances, venuesById]);

  const favoriteTeamLabel = stats.favoriteTeamSplit?.teamName ?? "Favorite Team";
  const hasAnyStats = stats.totalGamesAttended > 0;
  const hasFilteredBatters = sortedBatters.length > 0;
  const hasFilteredPitchers = sortedPitchers.length > 0;

  return (
    <Screen
      title="Deep Stats"
      subtitle="Every hitter, pitcher, and team you’ve seen, with header sorting, minimum filters, and rate stats for faster scanning."
    >
      <View style={styles.topBar}>
        <View style={styles.topStat}>
          <Text style={styles.topStatLabel}>{favoriteTeamLabel} Record</Text>
          <Text style={styles.topStatValue}>
            {stats.favoriteTeamSplit?.wins ?? stats.wins}-{stats.favoriteTeamSplit?.losses ?? stats.losses}
          </Text>
          <Text style={styles.topStatMeta}>{formatWinPct(stats.favoriteTeamSplit?.wins ?? stats.wins, stats.favoriteTeamSplit?.losses ?? stats.losses)} win pct</Text>
        </View>
        <View style={styles.topStat}>
          <Text style={styles.topStatLabel}>Hits Seen</Text>
          <Text style={styles.topStatValue}>{stats.totalHitsSeen}</Text>
          <Text style={styles.topStatMeta}>{formatAverage(stats.averageHitsPerGame)} per game</Text>
        </View>
        <View style={styles.topStat}>
          <Text style={styles.topStatLabel}>Home Runs Seen</Text>
          <Text style={styles.topStatValue}>{stats.witnessedHomeRuns}</Text>
          <Text style={styles.topStatMeta}>{stats.totalGamesAttended} games logged</Text>
        </View>
        <View style={styles.topStat}>
          <Text style={styles.topStatLabel}>Pitchers Seen</Text>
          <Text style={styles.topStatValue}>{stats.uniquePitchersSeen}</Text>
          <Text style={styles.topStatMeta}>{sortedPitchers.length} match current table filters</Text>
        </View>
      </View>
      <View style={[styles.layout, isWide ? styles.layoutWide : null]}>
        <View style={styles.mainColumn}>
          <SectionCard title="What Stands Out">
            {hasAnyStats ? (
              <View style={styles.summaryCardGrid}>
                {summaryCards.map((card) => (
                  <View key={card.label} style={styles.summaryCard}>
                    <Text style={styles.summaryCardLabel}>{card.label}</Text>
                    <Text style={styles.summaryCardValue}>{card.value}</Text>
                    {(Array.isArray(card.details) ? card.details : [card.details]).map((detail) => (
                      <Text key={`${card.label}_${detail}`} style={styles.summaryCardMeta}>{detail}</Text>
                    ))}
                  </View>
                ))}
              </View>
            ) : (
              <PlaceholderPanel
                title="No standout stats yet"
                body="As soon as you save games, this section will summarize the most interesting player and team signals from your personal attendance history."
                actionLabel="Log First Game"
                onAction={() => router.push("/(tabs)/log-game")}
              />
            )}
          </SectionCard>

          <SectionCard title="Split View">
            {hasAnyStats ? (
              <>
                <View style={styles.splitHeader}>
                  <DropdownField
                    label="Split by"
                    options={splitOptions}
                    value={splitKey}
                    onChange={(value) => {
                      setSplitKey(value);
                      setOpenFilter(null);
                    }}
                    isOpen={openFilter === "split-key"}
                    onToggle={() => setOpenFilter((current) => current === "split-key" ? null : "split-key")}
                    minWidth={220}
                  />
                  <Text style={styles.splitHelper}>
                    Quick ledger slices so you can answer where, when, and against whom your record is strongest.
                  </Text>
                </View>
                {topSplitSummaries.length ? (
                  <View style={styles.splitGrid}>
                    {topSplitSummaries.map((split) => (
                      <View key={split.key} style={styles.splitCard}>
                        <Text style={styles.splitCardLabel}>{split.label}</Text>
                        <Text style={styles.splitCardValue}>{split.games} games</Text>
                        <Text style={styles.splitCardMeta}>
                          {split.wins}-{split.losses} record • {split.hitsSeen} hits seen
                        </Text>
                        <Text style={styles.splitCardMeta}>
                          {split.runsSeen} runs seen • {split.homeRunsSeen} HR seen
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <PlaceholderPanel
                    title="This split is not available yet"
                    body={splitKey === "favorite-side"
                      ? "Set a favorite team first, then this view can compare home and road attendance."
                      : "Save more games to populate this split."}
                    actionLabel={splitKey === "favorite-side" ? "Open Profile" : "Log Game"}
                    onAction={() => router.push(splitKey === "favorite-side" ? "/(tabs)/profile" : "/(tabs)/log-game")}
                  />
                )}
              </>
            ) : (
              <PlaceholderPanel
                title="No split data yet"
                body="Split views turn on after your saved ledger has enough games to compare by season, stadium, weekday, or opponent."
                actionLabel="Log First Game"
                onAction={() => router.push("/(tabs)/log-game")}
              />
            )}
          </SectionCard>

          <SectionCard title="Hitters Seen">
            {hasAnyStats ? (
              <>
                <View style={styles.filtersBlock}>
                  <DropdownField
                    label="Min games"
                    options={batterGameOptions}
                    value={minBatterGames}
                    onChange={(value) => {
                      setMinBatterGames(value);
                      setOpenFilter(null);
                    }}
                    isOpen={openFilter === "batter-games"}
                    onToggle={() => setOpenFilter((current) => current === "batter-games" ? null : "batter-games")}
                  />
                  <DropdownField
                    label="Min AB"
                    options={batterAbOptions}
                    value={minBatterAtBats}
                    onChange={(value) => {
                      setMinBatterAtBats(value);
                      setOpenFilter(null);
                    }}
                    isOpen={openFilter === "batter-abs"}
                    onToggle={() => setOpenFilter((current) => current === "batter-abs" ? null : "batter-abs")}
                  />
                  <DropdownField
                    label="Team"
                    options={batterTeamOptions}
                    value={batterTeamFilter}
                    onChange={(value) => {
                      setBatterTeamFilter(value);
                      setOpenFilter(null);
                    }}
                    isOpen={openFilter === "batter-team"}
                    onToggle={() => setOpenFilter((current) => current === "batter-team" ? null : "batter-team")}
                  />
                  <DropdownField
                    label="Position"
                    options={batterPositionOptions}
                    value={batterPositionFilter}
                    onChange={(value) => {
                      setBatterPositionFilter(value);
                      setOpenFilter(null);
                    }}
                    isOpen={openFilter === "batter-position"}
                    onToggle={() => setOpenFilter((current) => current === "batter-position" ? null : "batter-position")}
                  />
                </View>
                {hasFilteredBatters ? (
                  <>
                    <View style={styles.tableHeader}>
                      <HeaderCell label="Player" align="left" />
                      <HeaderCell
                        label="G"
                        active={batterSortKey === "gamesSeen"}
                        direction={batterSortDirection}
                        onPress={() => toggleSort(batterSortKey, "gamesSeen", batterSortDirection, setBatterSortKey, setBatterSortDirection)}
                      />
                      <HeaderCell
                        label="AB"
                        active={batterSortKey === "atBatsSeen"}
                        direction={batterSortDirection}
                        onPress={() => toggleSort(batterSortKey, "atBatsSeen", batterSortDirection, setBatterSortKey, setBatterSortDirection)}
                      />
                      <HeaderCell
                        label="H"
                        active={batterSortKey === "hitsSeen"}
                        direction={batterSortDirection}
                        onPress={() => toggleSort(batterSortKey, "hitsSeen", batterSortDirection, setBatterSortKey, setBatterSortDirection)}
                      />
                      <HeaderCell
                        label="AVG"
                        active={batterSortKey === "battingAverageSeen"}
                        direction={batterSortDirection}
                        onPress={() => toggleSort(batterSortKey, "battingAverageSeen", batterSortDirection, setBatterSortKey, setBatterSortDirection)}
                      />
                      <HeaderCell
                        label="HR"
                        active={batterSortKey === "homeRunsSeen"}
                        direction={batterSortDirection}
                        onPress={() => toggleSort(batterSortKey, "homeRunsSeen", batterSortDirection, setBatterSortKey, setBatterSortDirection)}
                      />
                      <HeaderCell
                        label="RBI"
                        active={batterSortKey === "rbisSeen"}
                        direction={batterSortDirection}
                        onPress={() => toggleSort(batterSortKey, "rbisSeen", batterSortDirection, setBatterSortKey, setBatterSortDirection)}
                      />
                      <HeaderCell
                        label="BB"
                        active={batterSortKey === "walksSeen"}
                        direction={batterSortDirection}
                        onPress={() => toggleSort(batterSortKey, "walksSeen", batterSortDirection, setBatterSortKey, setBatterSortDirection)}
                      />
                      <HeaderCell
                        label="K"
                        active={batterSortKey === "strikeoutsSeenAtPlate"}
                        direction={batterSortDirection}
                        onPress={() =>
                          toggleSort(
                            batterSortKey,
                            "strikeoutsSeenAtPlate",
                            batterSortDirection,
                            setBatterSortKey,
                            setBatterSortDirection
                          )
                        }
                      />
                    </View>
                    {sortedBatters.map((player) => (
                      <BatterRow key={player.playerName} player={player} />
                    ))}
                  </>
                ) : (
                  <PlaceholderPanel
                    title="No hitters match these filters"
                    body="Your current games, at-bats, team, and position filters narrowed the hitter table down to zero rows. Relax one or more filters to bring players back."
                    actionLabel="Show All Hitters"
                    onAction={() => {
                      setMinBatterGames(0);
                      setMinBatterAtBats(0);
                      setBatterTeamFilter("all");
                      setBatterPositionFilter("all");
                    }}
                  />
                )}
              </>
            ) : (
              <PlaceholderPanel
                title="No hitter data yet"
                body="Player batting summaries appear after you log games with attached box-score data."
                actionLabel="Log First Game"
                onAction={() => router.push("/(tabs)/log-game")}
              />
            )}
          </SectionCard>

          <SectionCard title="Pitchers Seen">
            {hasAnyStats ? (
              <>
                <View style={styles.filtersBlock}>
                  <DropdownField
                    label="Min apps"
                    options={pitcherAppearanceOptions}
                    value={minPitcherAppearances}
                    onChange={(value) => {
                      setMinPitcherAppearances(value);
                      setOpenFilter(null);
                    }}
                    isOpen={openFilter === "pitcher-apps"}
                    onToggle={() => setOpenFilter((current) => current === "pitcher-apps" ? null : "pitcher-apps")}
                  />
                  <DropdownField
                    label="Min IP"
                    options={pitcherInningOptions}
                    value={minPitcherInnings}
                    onChange={(value) => {
                      setMinPitcherInnings(value);
                      setOpenFilter(null);
                    }}
                    isOpen={openFilter === "pitcher-ip"}
                    onToggle={() => setOpenFilter((current) => current === "pitcher-ip" ? null : "pitcher-ip")}
                  />
                  <DropdownField
                    label="Team"
                    options={pitcherTeamOptions}
                    value={pitcherTeamFilter}
                    onChange={(value) => {
                      setPitcherTeamFilter(value);
                      setOpenFilter(null);
                    }}
                    isOpen={openFilter === "pitcher-team"}
                    onToggle={() => setOpenFilter((current) => current === "pitcher-team" ? null : "pitcher-team")}
                  />
                  <DropdownField
                    label="Role"
                    options={pitcherRoleOptions}
                    value={pitcherRoleFilter}
                    onChange={(value) => {
                      setPitcherRoleFilter(value);
                      setOpenFilter(null);
                    }}
                    isOpen={openFilter === "pitcher-role"}
                    onToggle={() => setOpenFilter((current) => current === "pitcher-role" ? null : "pitcher-role")}
                  />
                </View>
                {hasFilteredPitchers ? (
                  <>
                    <View style={styles.tableHeader}>
                      <HeaderCell label="Pitcher" align="left" />
                      <HeaderCell
                        label="Apps"
                        active={pitcherSortKey === "appearances"}
                        direction={pitcherSortDirection}
                        onPress={() =>
                          toggleSort(pitcherSortKey, "appearances", pitcherSortDirection, setPitcherSortKey, setPitcherSortDirection)
                        }
                      />
                      <HeaderCell
                        label="K"
                        active={pitcherSortKey === "strikeoutsSeen"}
                        direction={pitcherSortDirection}
                        onPress={() =>
                          toggleSort(
                            pitcherSortKey,
                            "strikeoutsSeen",
                            pitcherSortDirection,
                            setPitcherSortKey,
                            setPitcherSortDirection
                          )
                        }
                      />
                      <HeaderCell
                        label="IP"
                        active={pitcherSortKey === "inningsSeen"}
                        direction={pitcherSortDirection}
                        onPress={() =>
                          toggleSort(pitcherSortKey, "inningsSeen", pitcherSortDirection, setPitcherSortKey, setPitcherSortDirection)
                        }
                      />
                      <HeaderCell
                        label="H"
                        active={pitcherSortKey === "hitsAllowedSeen"}
                        direction={pitcherSortDirection}
                        onPress={() =>
                          toggleSort(
                            pitcherSortKey,
                            "hitsAllowedSeen",
                            pitcherSortDirection,
                            setPitcherSortKey,
                            setPitcherSortDirection
                          )
                        }
                      />
                      <HeaderCell
                        label="R"
                        active={pitcherSortKey === "runsAllowedSeen"}
                        direction={pitcherSortDirection}
                        onPress={() =>
                          toggleSort(
                            pitcherSortKey,
                            "runsAllowedSeen",
                            pitcherSortDirection,
                            setPitcherSortKey,
                            setPitcherSortDirection
                          )
                        }
                      />
                      <HeaderCell
                        label="ERA"
                        active={pitcherSortKey === "eraSeen"}
                        direction={pitcherSortDirection}
                        onPress={() => toggleSort(pitcherSortKey, "eraSeen", pitcherSortDirection, setPitcherSortKey, setPitcherSortDirection)}
                      />
                    </View>
                    {sortedPitchers.map((pitcher) => (
                      <PitcherRow key={pitcher.pitcherName} pitcher={pitcher} />
                    ))}
                  </>
                ) : (
                  <PlaceholderPanel
                    title="No pitchers match these filters"
                    body="The current appearances, innings, team, and role filters narrowed the pitching table down to zero rows. Reset them to see the full list."
                    actionLabel="Show All Pitchers"
                    onAction={() => {
                      setMinPitcherAppearances(0);
                      setMinPitcherInnings(0);
                      setPitcherTeamFilter("all");
                      setPitcherRoleFilter("all");
                    }}
                  />
                )}
              </>
            ) : (
              <PlaceholderPanel
                title="No pitcher data yet"
                body="Pitcher summaries start once you’ve saved games with attached pitching appearances."
                actionLabel="Log First Game"
                onAction={() => router.push("/(tabs)/log-game")}
              />
            )}
          </SectionCard>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  topStat: {
    flexGrow: 1,
    minWidth: 130,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2
  },
  topStatLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate500,
    fontWeight: "700"
  },
  topStatValue: {
    fontSize: 24,
    color: colors.navy,
    fontWeight: "800"
  },
  topStatMeta: {
    fontSize: 12,
    color: colors.slate500,
    lineHeight: 17
  },
  layout: {
    gap: spacing.md
  },
  layoutWide: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  mainColumn: {
    flex: 1,
    gap: spacing.md
  },
  summaryCardGrid: {
    gap: spacing.sm
  },
  summaryCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.slate050,
    borderWidth: 1,
    borderColor: colors.slate200
  },
  summaryCardLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate500,
    fontWeight: "700"
  },
  summaryCardValue: {
    fontSize: 18,
    lineHeight: 23,
    color: colors.slate900,
    fontWeight: "800"
  },
  summaryCardMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.slate700
  },
  splitHeader: {
    gap: spacing.sm
  },
  splitHelper: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.slate500
  },
  splitGrid: {
    gap: spacing.sm
  },
  splitCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200
  },
  splitCardLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate500,
    fontWeight: "700"
  },
  splitCardValue: {
    fontSize: 18,
    lineHeight: 22,
    color: colors.navy,
    fontWeight: "800"
  },
  splitCardMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.slate700
  },
  filtersBlock: {
    gap: spacing.sm
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200
  },
  headerCell: {
    justifyContent: "center"
  },
  headerText: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate500,
    fontWeight: "700"
  },
  headerTextActive: {
    color: colors.navy
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100
  },
  nameCol: {
    flex: 1
  },
  nameText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.slate900
  },
  subText: {
    fontSize: 11,
    color: colors.slate500
  },
  cellText: {
    width: 52,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy
  }
});
