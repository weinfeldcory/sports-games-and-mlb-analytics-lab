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
const easternTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/New_York"
});
const easternDayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "America/New_York"
});
const levelThresholds = [
  { title: "Rookie Scorer", points: 0 },
  { title: "Bleacher Regular", points: 12 },
  { title: "Road Tripper", points: 28 },
  { title: "Stadium Hunter", points: 50 },
  { title: "Homer Historian", points: 78 },
  { title: "Ledger Legend", points: 110 }
];

function getTopFriendStat(friendStats: ReturnType<typeof calculatePersonalStats>) {
  if (friendStats.playerBattingSummaries[0]?.homeRunsSeen) {
    return `${friendStats.playerBattingSummaries[0].playerName} ${friendStats.playerBattingSummaries[0].homeRunsSeen} HR seen`;
  }

  if (friendStats.playerPitchingSummaries[0]?.strikeoutsSeen) {
    return `${friendStats.playerPitchingSummaries[0].pitcherName} ${friendStats.playerPitchingSummaries[0].strikeoutsSeen} K seen`;
  }

  return `${friendStats.totalHitsSeen} hits seen`;
}

function getSortIndicator(active: boolean, direction: "asc" | "desc") {
  if (!active) {
    return "";
  }

  return direction === "asc" ? " ↑" : " ↓";
}

function getLevelProgress(stats: ReturnType<typeof calculatePersonalStats>) {
  const points = stats.totalGamesAttended + stats.uniqueStadiumsVisited * 4 + stats.witnessedHomeRuns * 3;
  const currentLevel = [...levelThresholds].reverse().find((level) => points >= level.points) ?? levelThresholds[0];
  const nextLevel = levelThresholds.find((level) => level.points > points) ?? null;
  const floor = currentLevel.points;
  const ceiling = nextLevel?.points ?? floor + 20;
  const progress = ceiling === floor ? 1 : Math.min(1, Math.max(0, (points - floor) / (ceiling - floor)));

  return {
    points,
    currentLevel,
    nextLevel,
    progress
  };
}

function buildAttendancePattern(games: Array<{ startDateTime?: string }>) {
  const patternMap = new Map<string, { label: string; sortValue: number; counts: number[] }>();

  games.forEach((game) => {
    if (!game.startDateTime) {
      return;
    }

    const parsed = new Date(game.startDateTime);
    if (Number.isNaN(parsed.getTime())) {
      return;
    }

    const timeLabel = easternTimeFormatter.format(parsed);
    const dayLabel = easternDayFormatter.format(parsed);
    const dayIndex = dayLabels.indexOf(dayLabel);
    const minutes = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: false,
        timeZone: "America/New_York"
      })
        .format(parsed)
        .replace(":", ".")
    );

    if (dayIndex >= 0) {
      const existing = patternMap.get(timeLabel);
      if (existing) {
        existing.counts[dayIndex] += 1;
      } else {
        const counts = dayLabels.map(() => 0);
        counts[dayIndex] = 1;
        patternMap.set(timeLabel, {
          label: timeLabel,
          sortValue: minutes,
          counts
        });
      }
    }
  });

  return [...patternMap.values()].sort((left, right) => left.sortValue - right.sortValue);
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
  const levelProgress = getLevelProgress(stats);
  const [teamSortKey, setTeamSortKey] = useState<"teamName" | "gamesSeen" | "winsSeen" | "lossesSeen" | "hitsSeen" | "runsSeen">("gamesSeen");
  const [teamSortDirection, setTeamSortDirection] = useState<"asc" | "desc">("desc");
  const attendedGames = useMemo(
    () => attendanceLogs.map((log) => gamesById.get(log.gameId)).filter((game): game is NonNullable<typeof game> => Boolean(game)),
    [attendanceLogs, gamesById]
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
      <View style={styles.topSummary}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Games</Text>
          <Text style={styles.summaryValue}>{stats.totalGamesAttended}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{favoriteTeam?.name ?? "Favorite Team"} Record</Text>
          <Text style={styles.summaryValue}>
            {stats.favoriteTeamSplit?.wins ?? stats.wins}-{stats.favoriteTeamSplit?.losses ?? stats.losses}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Hits Seen</Text>
          <Text style={styles.summaryValue}>{stats.totalHitsSeen}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Pitchers Seen</Text>
          <Text style={styles.summaryValue}>{stats.uniquePitchersSeen}</Text>
        </View>
      </View>

      <View style={[styles.grid, isWide ? styles.gridWide : null]}>
        <View style={styles.mainColumn}>
          <SectionCard title="Now">
            <Text style={styles.primaryText}>
              {isHydrated
                ? hasLogs
                  ? `${profile.displayName} • ${favoriteTeam?.name ?? "No favorite team set"} • ${persistenceStatus}`
                  : `${profile.displayName} • Log your first game to turn this into a real record.`
                : "Loading your local record..."}
            </Text>
            <View style={styles.inlineActions}>
              <PrimaryButton label={hasLogs ? "Log Game" : "Log First Game"} onPress={() => router.push("/(tabs)/log-game")} />
              <PrimaryButton label="Stats" onPress={() => router.push("/(tabs)/stats")} />
              <PrimaryButton label="History" onPress={() => router.push("/(tabs)/history")} />
            </View>
            {persistenceError ? <Text style={styles.errorText}>{persistenceError}</Text> : null}
            {persistenceStatus === "error" ? <PrimaryButton label="Retry Storage" onPress={retryHydration} /> : null}
          </SectionCard>

          <SectionCard title="Level Progress">
            {hasLogs ? (
              <View style={styles.levelStack}>
                <Text style={styles.primaryText}>{levelProgress.currentLevel.title}</Text>
                <Text style={styles.secondaryText}>
                  {levelProgress.points} ledger points from {stats.totalGamesAttended} games, {stats.uniqueStadiumsVisited} stadiums, and {stats.witnessedHomeRuns} home runs seen.
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${levelProgress.progress * 100}%` }]} />
                </View>
                <Text style={styles.secondaryText}>
                  {levelProgress.nextLevel
                    ? `${levelProgress.nextLevel.points - levelProgress.points} more points until ${levelProgress.nextLevel.title}.`
                    : "Top level reached. Keep padding the ledger."}
                </Text>
                <View style={styles.levelBreakdown}>
                  <View style={styles.levelPill}>
                    <Text style={styles.levelPillLabel}>Games</Text>
                    <Text style={styles.levelPillValue}>{stats.totalGamesAttended}</Text>
                  </View>
                  <View style={styles.levelPill}>
                    <Text style={styles.levelPillLabel}>Stadiums</Text>
                    <Text style={styles.levelPillValue}>{stats.uniqueStadiumsVisited}</Text>
                  </View>
                  <View style={styles.levelPill}>
                    <Text style={styles.levelPillLabel}>HR Seen</Text>
                    <Text style={styles.levelPillValue}>{stats.witnessedHomeRuns}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <PlaceholderPanel
                title="No level yet"
                body="Your custom level starts moving after the first logged game and climbs faster as you add new parks and witness more home runs."
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
  topSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  summaryCard: {
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
  summaryLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate500,
    fontWeight: "700"
  },
  summaryValue: {
    fontSize: 24,
    color: colors.navy,
    fontWeight: "800"
  },
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
    backgroundColor: colors.slate100,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.navy
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
    backgroundColor: colors.slate050,
    borderWidth: 1,
    borderColor: colors.slate200,
    gap: 2
  },
  levelPillLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate500,
    fontWeight: "700"
  },
  levelPillValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.navy
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
