import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { calculatePersonalStats } from "@mlb-attendance/domain";
import { Screen } from "../../components/common/Screen";
import { PlaceholderPanel } from "../../components/common/PlaceholderPanel";
import { PrimaryButton } from "../../components/common/PrimaryButton";
import { SectionCard } from "../../components/common/SectionCard";
import { useAppData } from "../../providers/AppDataProvider";
import { colors, spacing } from "../../styles/tokens";
import { formatGameLabel } from "../../lib/formatters";

const SCORE_RULES = {
  game: 10,
  stadium: 40,
  homeRun: 3,
  extraInnings: 15,
  walkOff: 20,
  uniqueTeam: 5
} as const;

function getNextMilestone(totalGamesAttended: number) {
  const milestones = [1, 5, 10, 20, 30, 50];
  const nextTarget = milestones.find((milestone) => milestone > totalGamesAttended);

  if (!nextTarget) {
    return null;
  }

  return {
    target: nextTarget,
    remaining: nextTarget - totalGamesAttended
  };
}

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const easternDayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "America/New_York"
});
const levelThresholds = [
  { title: "Rookie Scorer", points: 0 },
  { title: "Bleacher Regular", points: 100 },
  { title: "Series Tracker", points: 250 },
  { title: "Road Tripper", points: 450 },
  { title: "Stadium Hunter", points: 700 },
  { title: "Homer Historian", points: 1000 },
  { title: "Pennant Chaser", points: 1400 },
  { title: "Ledger Legend", points: 1900 }
];

function getWeekStart(input: string) {
  const parsed = new Date(`${input}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const day = parsed.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - diffToMonday);
  parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
}

function getAttendanceWeekStreak(logs: Array<{ attendedOn: string }>) {
  const uniqueWeeks = [...new Set(logs.map((log) => getWeekStart(log.attendedOn)?.toISOString().slice(0, 10)).filter(Boolean))].sort();
  if (!uniqueWeeks.length) {
    return {
      currentWeeks: 0,
      bestWeeks: 0
    };
  }

  let bestWeeks = 1;
  let runningWeeks = 1;

  for (let index = 1; index < uniqueWeeks.length; index += 1) {
    const previous = new Date(`${uniqueWeeks[index - 1]}T00:00:00Z`);
    const current = new Date(`${uniqueWeeks[index]}T00:00:00Z`);
    const diffDays = Math.round((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 7) {
      runningWeeks += 1;
      bestWeeks = Math.max(bestWeeks, runningWeeks);
    } else {
      runningWeeks = 1;
    }
  }

  let currentWeeks = 1;
  for (let index = uniqueWeeks.length - 1; index > 0; index -= 1) {
    const previous = new Date(`${uniqueWeeks[index - 1]}T00:00:00Z`);
    const current = new Date(`${uniqueWeeks[index]}T00:00:00Z`);
    const diffDays = Math.round((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 7) {
      currentWeeks += 1;
      continue;
    }

    break;
  }

  return {
    currentWeeks,
    bestWeeks
  };
}

function getStreakBonus(bestWeeks: number) {
  if (bestWeeks >= 10) {
    return 60;
  }
  if (bestWeeks >= 6) {
    return 30;
  }
  if (bestWeeks >= 3) {
    return 15;
  }

  return 0;
}

function getTopFriendStat(friendStats: ReturnType<typeof calculatePersonalStats>) {
  if (friendStats.playerBattingSummaries[0]?.homeRunsSeen) {
    return `${friendStats.playerBattingSummaries[0].playerName} ${friendStats.playerBattingSummaries[0].homeRunsSeen} HR seen`;
  }

  if (friendStats.playerPitchingSummaries[0]?.strikeoutsSeen) {
    return `${friendStats.playerPitchingSummaries[0].pitcherName} ${friendStats.playerPitchingSummaries[0].strikeoutsSeen} K seen`;
  }

  return `${friendStats.totalHitsSeen} hits seen`;
}

function getNextAction(params: {
  hasLogs: boolean;
  favoriteTeamId?: string;
  persistenceStatus: "idle" | "loading" | "saving" | "saved" | "error";
}) {
  const { hasLogs, favoriteTeamId, persistenceStatus } = params;

  if (persistenceStatus === "error") {
    return {
      label: "Retry Storage",
      route: null as string | null,
      summary: "Storage needs attention before the ledger feels safe."
    };
  }

  if (!hasLogs) {
    return {
      label: "Log First Game",
      route: "/(tabs)/log-game",
      summary: "Your first save unlocks stats, progress, and a real home dashboard."
    };
  }

  if (!favoriteTeamId) {
    return {
      label: "Set Favorite Team",
      route: "/(tabs)/profile",
      summary: "Favorite-team splits and cleaner comparisons unlock once this is set."
    };
  }

  return {
    label: "Backfill Another Game",
    route: "/(tabs)/log-game",
    summary: "The fastest way to deepen the ledger now is to add another attended game."
  };
}

function getSortIndicator(active: boolean, direction: "asc" | "desc") {
  if (!active) {
    return "";
  }

  return direction === "asc" ? " ↑" : " ↓";
}

function getPersistenceSummary(status: "idle" | "loading" | "saving" | "saved" | "error") {
  switch (status) {
    case "loading":
      return "Loading your saved local record.";
    case "saving":
      return "Saving your latest ledger changes now.";
    case "saved":
      return "Your latest ledger changes are stored locally.";
    case "error":
      return "Storage needs attention before this record feels safe.";
    case "idle":
    default:
      return "Your local ledger is ready for the next update.";
  }
}

function buildLevelProgress(params: {
  stats: ReturnType<typeof calculatePersonalStats>;
  attendedGames: Array<{ innings?: number; walkOff?: boolean }>;
  attendanceLogs: Array<{ attendedOn: string }>;
}) {
  const { stats, attendedGames, attendanceLogs } = params;
  const extraInningsGames = attendedGames.filter((game) => (game.innings ?? 0) > 9).length;
  const walkOffGames = attendedGames.filter((game) => Boolean(game.walkOff)).length;
  const uniqueTeamsSeen = stats.teamSeenSummaries.length;
  const streaks = getAttendanceWeekStreak(attendanceLogs);
  const streakBonus = getStreakBonus(streaks.bestWeeks);
  const counts = {
    games: stats.totalGamesAttended,
    stadiums: stats.uniqueStadiumsVisited,
    homeRuns: stats.witnessedHomeRuns,
    extraInnings: extraInningsGames,
    walkOffs: walkOffGames,
    uniqueTeams: uniqueTeamsSeen,
    bestStreakWeeks: streaks.bestWeeks
  };
  const pointBreakdown = {
    games: counts.games * SCORE_RULES.game,
    stadiums: counts.stadiums * SCORE_RULES.stadium,
    homeRuns: counts.homeRuns * SCORE_RULES.homeRun,
    extraInnings: counts.extraInnings * SCORE_RULES.extraInnings,
    walkOffs: counts.walkOffs * SCORE_RULES.walkOff,
    uniqueTeams: counts.uniqueTeams * SCORE_RULES.uniqueTeam,
    streakBonus
  };
  const points = Object.values(pointBreakdown).reduce((total, value) => total + value, 0);
  const currentLevel = [...levelThresholds].reverse().find((level) => points >= level.points) ?? levelThresholds[0];
  const nextLevel = levelThresholds.find((level) => level.points > points) ?? null;
  const floor = currentLevel.points;
  const ceiling = nextLevel?.points ?? floor + 300;
  const progress = ceiling === floor ? 1 : Math.min(1, Math.max(0, (points - floor) / (ceiling - floor)));

  return {
    points,
    currentLevel,
    nextLevel,
    progress,
    counts,
    pointBreakdown,
    streaks
  };
}

function buildAttendancePattern(games: Array<{ startDateTime?: string }>) {
  const patternBuckets = [
    { key: "day", label: "1-4 PM", sortValue: 13 },
    { key: "late", label: "4-7 PM", sortValue: 16 },
    { key: "night", label: "7-10 PM", sortValue: 19 }
  ] as const;
  type PatternBucketKey = (typeof patternBuckets)[number]["key"];
  const patternMap = new Map(
    patternBuckets.map((bucket) => [
      bucket.key,
      {
        label: bucket.label,
        sortValue: bucket.sortValue,
        counts: dayLabels.map(() => 0)
      }
    ])
  );

  games.forEach((game) => {
    if (!game.startDateTime) {
      return;
    }

    const parsed = new Date(game.startDateTime);
    if (Number.isNaN(parsed.getTime())) {
      return;
    }

    const dayLabel = easternDayFormatter.format(parsed);
    const dayIndex = dayLabels.indexOf(dayLabel);
    const easternHour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: "America/New_York"
      }).format(parsed)
    );

    if (dayIndex >= 0) {
      let bucketKey: PatternBucketKey = "night";

      if (easternHour < 16) {
        bucketKey = "day";
      } else if (easternHour < 19) {
        bucketKey = "late";
      }

      const existing = patternMap.get(bucketKey);
      if (existing) {
        existing.counts[dayIndex] += 1;
      }
    }
  });

  return [...patternMap.values()]
    .filter((bucket) => bucket.counts.some((count) => count > 0))
    .sort((left, right) => left.sortValue - right.sortValue);
}

function getPatternColor(count: number, maxCount: number) {
  if (!count || !maxCount) {
    return colors.slate050;
  }

  const ratio = count / maxCount;
  if (ratio >= 0.75) {
    return colors.navy;
  }
  if (ratio >= 0.4) {
    return colors.sky;
  }
  return colors.slate200;
}

export function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
    attendanceLogs,
    friendAttendanceLogs,
    friends,
    games,
    teams,
    venues,
    stats,
    profile,
    persistenceStatus,
    persistenceError,
    isHydrated,
    retryHydration,
    toggleFollowFriend
  } = useAppData();
  const isWide = width >= 1080;
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const venuesById = useMemo(() => new Map(venues.map((venue) => [venue.id, venue])), [venues]);
  const gamesById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games]);
  const latestLog = attendanceLogs[0];
  const latestGame = latestLog ? gamesById.get(latestLog.gameId) : undefined;
  const latestGameLabel = latestGame ? formatGameLabel(latestGame, teamsById, venuesById) : undefined;
  const favoriteTeam = teams.find((team) => team.id === profile.favoriteTeamId);
  const hasLogs = attendanceLogs.length > 0;
  const nextMilestone = getNextMilestone(stats.totalGamesAttended);
  const nextAction = getNextAction({
    hasLogs,
    favoriteTeamId: profile.favoriteTeamId,
    persistenceStatus
  });
  const [teamSortKey, setTeamSortKey] = useState<"teamName" | "gamesSeen" | "winsSeen" | "lossesSeen" | "hitsSeen" | "runsSeen">("gamesSeen");
  const [teamSortDirection, setTeamSortDirection] = useState<"asc" | "desc">("desc");
  const attendedGames = useMemo(
    () => attendanceLogs.map((log) => gamesById.get(log.gameId)).filter((game): game is NonNullable<typeof game> => Boolean(game)),
    [attendanceLogs, gamesById]
  );
  const levelProgress = useMemo(
    () =>
      buildLevelProgress({
        stats,
        attendedGames,
        attendanceLogs
      }),
    [attendanceLogs, attendedGames, stats]
  );
  const attendancePattern = useMemo(() => buildAttendancePattern(attendedGames), [attendedGames]);
  const maxPatternCount = Math.max(0, ...attendancePattern.flatMap((bucket) => bucket.counts));
  const hasTimedGames = attendedGames.some((game) => Boolean(game.startDateTime));
  const sortedTeamSummaries = useMemo(() => {
    const directionFactor = teamSortDirection === "asc" ? 1 : -1;
    return [...stats.teamSeenSummaries].sort((left, right) => {
      if (teamSortKey === "teamName") {
        return left.teamName.localeCompare(right.teamName) * directionFactor;
      }

      const primary = (left[teamSortKey] - right[teamSortKey]) * directionFactor;
      if (primary !== 0) {
        return primary;
      }

      return left.teamName.localeCompare(right.teamName);
    });
  }, [stats.teamSeenSummaries, teamSortDirection, teamSortKey]);

  function toggleTeamSort(nextKey: typeof teamSortKey) {
    if (teamSortKey === nextKey) {
      setTeamSortDirection((current) => current === "desc" ? "asc" : "desc");
      return;
    }

    setTeamSortKey(nextKey);
    setTeamSortDirection(nextKey === "teamName" ? "asc" : "desc");
  }

  const followedFriends = useMemo(() => {
    const following = new Set(profile.followingIds ?? []);
    return friends
      .filter((friend) => following.has(friend.id))
      .map((friend) => {
        const logs = friendAttendanceLogs.filter((log) => log.userId === friend.id);
        const latestFriendLog = [...logs].sort((left, right) => right.attendedOn.localeCompare(left.attendedOn))[0];
        const latestFriendGame = latestFriendLog ? gamesById.get(latestFriendLog.gameId) : undefined;
        const favoriteTeam = teams.find((team) => team.id === friend.favoriteTeamId);
        const friendStats = calculatePersonalStats({
          user: {
            id: friend.id,
            displayName: friend.displayName,
            favoriteTeamId: friend.favoriteTeamId
          },
          attendanceLogs: logs,
          games,
          teams,
          venues
        });

        return { friend, latestFriendLog, latestFriendGame, favoriteTeam, friendStats };
      });
  }, [friendAttendanceLogs, friends, games, gamesById, profile.followingIds, teams, venues]);

  const suggestedFriends = friends.filter((friend) => !(profile.followingIds ?? []).includes(friend.id)).slice(0, 2);

  return (
    <Screen
      title="Ballpark Ledger"
      subtitle="A compact view of your real attendance history, the next useful action, and the friend or player detail worth checking."
    >
      <View style={styles.ledgerHero}>
        {isHydrated ? (
          <View style={styles.heroStack}>
            <View style={[styles.heroRow, isWide ? styles.heroRowWide : null]}>
              <View style={styles.heroLead}>
                <Text style={styles.heroEyebrow}>{profile.displayName}</Text>
                <Text style={styles.heroTitle}>{hasLogs ? levelProgress.currentLevel.title : "Start Your Ledger"}</Text>
                <Text style={styles.heroBody}>
                  {hasLogs
                    ? `${stats.totalGamesAttended} games logged, ${stats.uniqueStadiumsVisited} stadiums visited, and ${stats.witnessedHomeRuns} home runs seen in person.`
                    : "Log your first attended game to turn this into a durable baseball record with stats, progress, and memory detail."}
                </Text>
                <View style={styles.heroActionRow}>
                  {nextAction.route ? (
                    <PrimaryButton label={nextAction.label} onPress={() => router.push(nextAction.route as never)} />
                  ) : (
                    <PrimaryButton label={nextAction.label} onPress={retryHydration} />
                  )}
                  <View style={styles.heroActionCopy}>
                    <Text style={styles.heroActionLabel}>Next Best Action</Text>
                    <Text style={styles.heroActionText}>{nextAction.summary}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.heroRail}>
                <View style={styles.heroStatusBlock}>
                  <Text style={styles.heroStatusLabel}>Favorite Team</Text>
                  <Text style={styles.heroStatusValue}>{favoriteTeam?.name ?? "Not set yet"}</Text>
                  <Text style={styles.heroStatusMeta}>
                    {favoriteTeam
                      ? `${stats.favoriteTeamSplit?.wins ?? stats.wins}-${stats.favoriteTeamSplit?.losses ?? stats.losses} in-person record`
                      : "Set this in Profile for cleaner splits."}
                  </Text>
                </View>
                <View style={styles.heroStatusBlock}>
                  <Text style={styles.heroStatusLabel}>Storage</Text>
                  <Text style={styles.heroStatusValue}>{persistenceStatus}</Text>
                  <Text style={styles.heroStatusMeta}>{getPersistenceSummary(persistenceStatus)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.heroMetrics}>
              <View style={styles.heroMetricCard}>
                <Text style={styles.heroMetricLabel}>Games</Text>
                <Text style={styles.heroMetricValue}>{stats.totalGamesAttended}</Text>
              </View>
              <View style={styles.heroMetricCard}>
                <Text style={styles.heroMetricLabel}>{favoriteTeam?.name ?? "Favorite Team"} Record</Text>
                <Text style={styles.heroMetricValue}>
                  {stats.favoriteTeamSplit?.wins ?? stats.wins}-{stats.favoriteTeamSplit?.losses ?? stats.losses}
                </Text>
              </View>
              <View style={styles.heroMetricCard}>
                <Text style={styles.heroMetricLabel}>Hits Seen</Text>
                <Text style={styles.heroMetricValue}>{stats.totalHitsSeen}</Text>
              </View>
              <View style={styles.heroMetricCard}>
                <Text style={styles.heroMetricLabel}>Pitchers Seen</Text>
                <Text style={styles.heroMetricValue}>{stats.uniquePitchersSeen}</Text>
              </View>
            </View>

            {hasLogs ? (
              <View style={[styles.heroLowerGrid, isWide ? styles.heroLowerGridWide : null]}>
                <View style={styles.heroSubPanel}>
                  <Text style={styles.heroSubLabel}>Level Progress</Text>
                  <Text style={styles.heroSubTitle}>{levelProgress.points} total points</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${levelProgress.progress * 100}%` }]} />
                  </View>
                  <Text style={styles.heroSubText}>
                    {levelProgress.nextLevel
                      ? `${levelProgress.nextLevel.points - levelProgress.points} more points until ${levelProgress.nextLevel.title}.`
                      : "Top level reached. Keep padding the ledger."}
                  </Text>
                  <Text style={styles.heroSubText}>
                    Best streak: {levelProgress.streaks.bestWeeks} weeks
                    {levelProgress.pointBreakdown.streakBonus
                      ? ` • ${levelProgress.pointBreakdown.streakBonus} bonus points`
                      : " • no streak bonus yet"}
                  </Text>
                  <View style={styles.levelBreakdown}>
                    <View style={styles.levelPill}>
                      <Text style={styles.levelPillLabel}>Games</Text>
                      <Text style={styles.levelPillValue}>{levelProgress.counts.games}</Text>
                    </View>
                    <View style={styles.levelPill}>
                      <Text style={styles.levelPillLabel}>Stadiums</Text>
                      <Text style={styles.levelPillValue}>{levelProgress.counts.stadiums}</Text>
                    </View>
                    <View style={styles.levelPill}>
                      <Text style={styles.levelPillLabel}>HR Seen</Text>
                      <Text style={styles.levelPillValue}>{levelProgress.counts.homeRuns}</Text>
                    </View>
                    <View style={styles.levelPill}>
                      <Text style={styles.levelPillLabel}>Walk-Offs</Text>
                      <Text style={styles.levelPillValue}>{levelProgress.counts.walkOffs}</Text>
                    </View>
                    <View style={styles.levelPill}>
                      <Text style={styles.levelPillLabel}>Extra Inn.</Text>
                      <Text style={styles.levelPillValue}>{levelProgress.counts.extraInnings}</Text>
                    </View>
                    <View style={styles.levelPill}>
                      <Text style={styles.levelPillLabel}>Unique Teams</Text>
                      <Text style={styles.levelPillValue}>{levelProgress.counts.uniqueTeams}</Text>
                    </View>
                    <View style={styles.levelPill}>
                      <Text style={styles.levelPillLabel}>Best Streak</Text>
                      <Text style={styles.levelPillValue}>{levelProgress.counts.bestStreakWeeks}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.heroSubPanel}>
                  <Text style={styles.heroSubLabel}>Ledger Health</Text>
                  <Text style={styles.heroSubTitle}>
                    {nextMilestone
                      ? `${nextMilestone.remaining} more ${nextMilestone.remaining === 1 ? "game" : "games"} until ${nextMilestone.target}.`
                      : "Current milestone ladder cleared."}
                  </Text>
                  <Text style={styles.heroSubText}>
                    {stats.uniqueStadiumsVisited} stadiums visited and {stats.uniqueSectionsSatIn} seating sections tracked.
                  </Text>
                  <Text style={styles.heroSubText}>
                    Score: {SCORE_RULES.game}/game, {SCORE_RULES.stadium}/stadium, {SCORE_RULES.uniqueTeam}/team, {SCORE_RULES.homeRun}/HR, {SCORE_RULES.extraInnings}/extra-inning game, {SCORE_RULES.walkOff}/walk-off.
                  </Text>
                  <Text style={styles.heroSubText}>
                    {favoriteTeam
                      ? `${favoriteTeam.name} appears in ${stats.favoriteTeamSplit?.gamesAttended ?? 0} games in your ledger.`
                      : "Set a favorite team in Profile to unlock cleaner team-specific comparisons."}
                  </Text>
                  <View style={styles.inlineActions}>
                    <PrimaryButton label="Stats" onPress={() => router.push("/(tabs)/stats")} />
                    <PrimaryButton label="History" onPress={() => router.push("/(tabs)/history")} />
                    <PrimaryButton label="Profile" onPress={() => router.push("/(tabs)/profile")} />
                  </View>
                </View>
              </View>
            ) : null}

            {persistenceError ? <Text style={styles.errorText}>{persistenceError}</Text> : null}
          </View>
        ) : (
          <Text style={styles.primaryText}>Loading your local record...</Text>
        )}
      </View>

      <View style={[styles.grid, isWide ? styles.gridWide : null]}>
        <View style={styles.mainColumn}>
          <SectionCard title="Latest Game">
            {latestGame && latestGameLabel ? (
              <View style={styles.compactStack}>
                <Text style={styles.primaryText}>{latestGameLabel.title}</Text>
                <Text style={styles.secondaryText}>{latestGameLabel.subtitle} • Final {latestGameLabel.score}</Text>
                <View style={styles.inlineMetrics}>
                  <Text style={styles.metricChip}>Hits {latestGame.homeHits + latestGame.awayHits}</Text>
                  <Text style={styles.metricChip}>Pitchers {latestGame.pitchersUsed?.length ?? 0}</Text>
                  <Text style={styles.metricChip}>Batters {latestGame.battersUsed?.length ?? 0}</Text>
                </View>
                <Text style={styles.secondaryText}>
                  {stats.playerBattingSummaries[0]
                    ? `Top hitter seen: ${stats.playerBattingSummaries[0].playerName} (${stats.playerBattingSummaries[0].homeRunsSeen} HR seen)`
                    : "No player summary available yet."}
                </Text>
                {latestLog.memorableMoment ? <Text style={styles.noteText}>{latestLog.memorableMoment}</Text> : null}
              </View>
            ) : (
              <PlaceholderPanel
                title="No saved games yet"
                body="Your latest attended game will show up here after the first successful save, along with the scoreline, quick box-score context, and your memory note."
                actionLabel="Log First Game"
                onAction={() => router.push("/(tabs)/log-game")}
              />
            )}
          </SectionCard>

          <SectionCard title="Momentum">
            {hasLogs ? (
              <View style={styles.compactStack}>
                <Text style={styles.primaryText}>
                  {nextMilestone
                    ? `${nextMilestone.remaining} more ${nextMilestone.remaining === 1 ? "game" : "games"} until ${nextMilestone.target} logged.`
                    : "You cleared every current milestone. Keep stacking games."}
                </Text>
                <Text style={styles.secondaryText}>
                  {stats.uniqueStadiumsVisited} stadiums visited • {stats.uniqueSectionsSatIn} unique seating sections tracked
                </Text>
                <Text style={styles.secondaryText}>
                  {favoriteTeam
                    ? `${favoriteTeam.name} games in your ledger: ${stats.favoriteTeamSplit?.gamesAttended ?? 0}.`
                    : "Set a favorite team in Profile to unlock cleaner team-specific splits."}
                </Text>
              </View>
            ) : (
              <PlaceholderPanel
                title="Start the ledger"
                body="Search for the matchup you attended, save the seat details, and the home screen will start tracking milestones and derived stats from that first log onward."
                actionLabel="Open Log Game"
                onAction={() => router.push("/(tabs)/log-game")}
              />
            )}
          </SectionCard>

          <SectionCard title="When You Go">
            {hasTimedGames ? (
              <View style={styles.patternWrap}>
                <View style={styles.patternHeader}>
                  <Text style={[styles.patternHeaderText, styles.patternLabelCol]}>Time</Text>
                  {dayLabels.map((day) => (
                    <Text key={day} style={styles.patternHeaderText}>{day}</Text>
                  ))}
                </View>
                {attendancePattern.map((bucket) => (
                  <View key={bucket.label} style={styles.patternRow}>
                    <Text style={[styles.patternRowLabel, styles.patternLabelCol]}>{bucket.label}</Text>
                    {bucket.counts.map((count, index) => {
                      const backgroundColor = getPatternColor(count, maxPatternCount);
                      return (
                        <View key={`${bucket.label}_${dayLabels[index]}`} style={[styles.patternCell, { backgroundColor }]}>
                          <Text style={[styles.patternCellText, backgroundColor === colors.navy ? styles.patternCellTextInverse : null]}>
                            {count || ""}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
                <Text style={styles.secondaryText}>Heat map of exact first-pitch times by day of week, shown in Eastern Time.</Text>
              </View>
            ) : (
              <PlaceholderPanel
                title="No first-pitch pattern yet"
                body="This graph turns on once the saved game data includes start times, so it can group your attendance by exact first-pitch times."
              />
            )}
          </SectionCard>
        </View>

        <View style={styles.sideColumn}>
          <SectionCard title="Teams Seen">
            {stats.teamSeenSummaries.length ? (
              <>
                <View style={styles.teamHeader}>
                  <Pressable onPress={() => toggleTeamSort("teamName")} style={[styles.teamHeaderPressable, styles.teamNameCol]}>
                    <Text style={[styles.teamHeaderText, styles.teamNameCol]}>Team{getSortIndicator(teamSortKey === "teamName", teamSortDirection)}</Text>
                  </Pressable>
                  <Pressable onPress={() => toggleTeamSort("gamesSeen")} style={styles.teamHeaderPressable}>
                    <Text style={styles.teamHeaderText}>G{getSortIndicator(teamSortKey === "gamesSeen", teamSortDirection)}</Text>
                  </Pressable>
                  <Pressable onPress={() => toggleTeamSort("winsSeen")} style={styles.teamHeaderPressable}>
                    <Text style={styles.teamHeaderText}>W{getSortIndicator(teamSortKey === "winsSeen", teamSortDirection)}</Text>
                  </Pressable>
                  <Pressable onPress={() => toggleTeamSort("lossesSeen")} style={styles.teamHeaderPressable}>
                    <Text style={styles.teamHeaderText}>L{getSortIndicator(teamSortKey === "lossesSeen", teamSortDirection)}</Text>
                  </Pressable>
                  <Pressable onPress={() => toggleTeamSort("hitsSeen")} style={styles.teamHeaderPressable}>
                    <Text style={styles.teamHeaderText}>H{getSortIndicator(teamSortKey === "hitsSeen", teamSortDirection)}</Text>
                  </Pressable>
                  <Pressable onPress={() => toggleTeamSort("runsSeen")} style={styles.teamHeaderPressable}>
                    <Text style={styles.teamHeaderText}>R{getSortIndicator(teamSortKey === "runsSeen", teamSortDirection)}</Text>
                  </Pressable>
                </View>
                {sortedTeamSummaries.map((team) => (
                  <View key={team.teamId} style={styles.teamRow}>
                    <Text style={[styles.friendName, styles.teamNameCol]}>{team.teamName}</Text>
                    <Text style={styles.teamValue}>{team.gamesSeen}</Text>
                    <Text style={styles.teamValue}>{team.winsSeen}</Text>
                    <Text style={styles.teamValue}>{team.lossesSeen}</Text>
                    <Text style={styles.teamValue}>{team.hitsSeen}</Text>
                    <Text style={styles.teamValue}>{team.runsSeen}</Text>
                  </View>
                ))}
              </>
            ) : (
              <PlaceholderPanel
                title="No team splits yet"
                body="Once you log a game, this panel will track how often you’ve seen each club along with the in-person wins, losses, hits, and runs."
              />
            )}
          </SectionCard>

          <SectionCard title="Friends">
            {followedFriends.length ? (
              followedFriends.slice(0, 3).map(({ friend, latestFriendLog, latestFriendGame, favoriteTeam, friendStats }) => (
                <View key={friend.id} style={styles.friendRow}>
                  <View style={styles.friendCopy}>
                    <Text style={styles.friendName}>{friend.displayName}</Text>
                    <Text style={styles.secondaryText}>
                      {friendStats.totalGamesAttended} games • {favoriteTeam?.name ?? "No favorite team"}
                    </Text>
                    <Text style={styles.secondaryText}>
                      Favorite-team record: {friendStats.favoriteTeamSplit
                        ? `${friendStats.favoriteTeamSplit.wins}-${friendStats.favoriteTeamSplit.losses}`
                        : `${friendStats.wins}-${friendStats.losses}`}
                    </Text>
                    <Text style={styles.secondaryText}>Top stat: {getTopFriendStat(friendStats)}</Text>
                    {latestFriendLog && latestFriendGame ? (
                      <Text style={styles.secondaryText}>
                        Last game: {latestFriendLog.attendedOn} • {formatGameLabel(latestFriendGame, teamsById, venuesById).title}
                      </Text>
                    ) : null}
                  </View>
                  <PrimaryButton label="Unfollow" onPress={() => toggleFollowFriend(friend.id)} />
                </View>
              ))
            ) : (
              <Text style={styles.secondaryText}>Follow friends to keep this panel useful.</Text>
            )}
          </SectionCard>

          <SectionCard title="Suggested">
            {suggestedFriends.length ? (
              suggestedFriends.map((friend) => (
                <View key={friend.id} style={styles.friendRow}>
                  <View style={styles.friendCopy}>
                    <Text style={styles.friendName}>{friend.displayName}</Text>
                    <Text style={styles.secondaryText}>{friend.bio}</Text>
                  </View>
                  <PrimaryButton label="Follow" onPress={() => toggleFollowFriend(friend.id)} />
                </View>
              ))
            ) : (
              <Text style={styles.secondaryText}>You’re already following everyone in the current seed set.</Text>
            )}
          </SectionCard>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.md
  },
  gridWide: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  mainColumn: {
    flex: 1.15,
    gap: spacing.md
  },
  sideColumn: {
    flex: 0.85,
    gap: spacing.md
  },
  compactStack: {
    gap: spacing.xs
  },
  ledgerHero: {
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: 28,
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: "rgba(255,253,248,0.12)",
    shadowColor: colors.navy,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5
  },
  heroStack: {
    gap: spacing.md
  },
  heroRow: {
    gap: spacing.lg
  },
  heroRowWide: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch"
  },
  heroLead: {
    flex: 1.3,
    gap: spacing.md
  },
  heroRail: {
    flex: 0.8,
    gap: spacing.md
  },
  heroActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md
  },
  heroActionCopy: {
    flex: 1,
    gap: spacing.xs
  },
  heroActionLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.amber,
    fontWeight: "700"
  },
  heroActionText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.slate050
  },
  heroEyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.amber,
    fontWeight: "700"
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    color: colors.white
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.slate050
  },
  heroStatusBlock: {
    minWidth: 140,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: "rgba(255,253,248,0.12)",
    gap: 4
  },
  heroStatusLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate100,
    fontWeight: "700"
  },
  heroStatusValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white
  },
  heroStatusMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.slate100
  },
  heroMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  heroMetricCard: {
    flexGrow: 1,
    minWidth: 150,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,253,248,0.12)",
    backgroundColor: "rgba(255,253,248,0.08)",
    gap: 2
  },
  heroMetricLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate100,
    fontWeight: "700"
  },
  heroMetricValue: {
    fontSize: 24,
    color: colors.white,
    fontWeight: "800"
  },
  heroLowerGrid: {
    gap: spacing.md
  },
  heroLowerGridWide: {
    flexDirection: "row"
  },
  heroSubPanel: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: "rgba(255,253,248,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,253,248,0.12)"
  },
  heroSubLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.amber,
    fontWeight: "700"
  },
  heroSubTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: colors.white
  },
  heroSubText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.slate100
  },
  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  inlineMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  metricChip: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy,
    backgroundColor: colors.slate050,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden"
  },
  teamHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200
  },
  teamHeaderText: {
    width: 32,
    textAlign: "right",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate500,
    fontWeight: "700"
  },
  teamHeaderPressable: {
    width: 32
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100
  },
  teamNameCol: {
    flex: 1,
    width: "auto",
    textAlign: "left"
  },
  teamValue: {
    width: 32,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy
  },
  friendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    paddingTop: spacing.sm
  },
  friendCopy: {
    flex: 1,
    gap: 2
  },
  friendName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.slate900
  },
  primaryText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.slate900
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.slate700
  },
  levelStack: {
    gap: spacing.sm
  },
  progressTrack: {
    width: "100%",
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,253,248,0.12)",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.amber
  },
  levelBreakdown: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  levelPill: {
    minWidth: 110,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    backgroundColor: "rgba(255,253,248,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,253,248,0.12)",
    gap: 2
  },
  levelPillLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate100,
    fontWeight: "700"
  },
  levelPillValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.white
  },
  patternWrap: {
    gap: spacing.sm
  },
  patternHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  patternHeaderText: {
    width: 36,
    textAlign: "center",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate500,
    fontWeight: "700"
  },
  patternLabelCol: {
    flex: 1,
    width: "auto",
    textAlign: "left"
  },
  patternRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  patternRowLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.slate700
  },
  patternCell: {
    width: 36,
    minHeight: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.slate200
  },
  patternCellText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.slate700
  },
  patternCellTextInverse: {
    color: colors.white
  },
  secondaryText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.slate500
  },
  errorText: {
    fontSize: 13,
    color: colors.red
  }
});
