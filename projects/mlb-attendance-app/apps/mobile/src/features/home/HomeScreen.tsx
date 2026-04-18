import { useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { calculatePersonalStats } from "@mlb-attendance/domain";
import { Screen } from "../../components/common/Screen";
import { PrimaryButton } from "../../components/common/PrimaryButton";
import { SectionCard } from "../../components/common/SectionCard";
import { useAppData } from "../../providers/AppDataProvider";
import { colors, spacing } from "../../styles/tokens";
import { formatGameLabel } from "../../lib/formatters";

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

  const followedFriends = useMemo(() => {
    const following = new Set(profile.followingIds ?? []);
    return friends
      .filter((friend) => following.has(friend.id))
      .map((friend) => {
        const logs = friendAttendanceLogs.filter((log) => log.userId === friend.id);
        const latestFriendLog = [...logs].sort((left, right) => right.attendedOn.localeCompare(left.attendedOn))[0];
        const latestFriendGame = latestFriendLog ? gamesById.get(latestFriendLog.gameId) : undefined;
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

        return { friend, latestFriendLog, latestFriendGame, friendStats };
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
              {isHydrated ? `${profile.displayName} • ${favoriteTeam?.name ?? "No favorite team set"} • ${persistenceStatus}` : "Loading your local record..."}
            </Text>
            <View style={styles.inlineActions}>
              <PrimaryButton label="Log Game" onPress={() => router.push("/(tabs)/log-game")} />
              <PrimaryButton label="Stats" onPress={() => router.push("/(tabs)/stats")} />
              <PrimaryButton label="History" onPress={() => router.push("/(tabs)/history")} />
            </View>
            {persistenceError ? <Text style={styles.errorText}>{persistenceError}</Text> : null}
            {persistenceStatus === "error" ? <PrimaryButton label="Retry Storage" onPress={retryHydration} /> : null}
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
              <Text style={styles.secondaryText}>No games logged yet.</Text>
            )}
          </SectionCard>
        </View>

        <View style={styles.sideColumn}>
          <SectionCard title="Teams Seen">
            <View style={styles.teamHeader}>
              <Text style={[styles.teamHeaderText, styles.teamNameCol]}>Team</Text>
              <Text style={styles.teamHeaderText}>G</Text>
              <Text style={styles.teamHeaderText}>W</Text>
              <Text style={styles.teamHeaderText}>L</Text>
            </View>
            {stats.teamSeenSummaries.map((team) => (
              <View key={team.teamId} style={styles.teamRow}>
                <Text style={[styles.friendName, styles.teamNameCol]}>{team.teamName}</Text>
                <Text style={styles.teamValue}>{team.gamesSeen}</Text>
                <Text style={styles.teamValue}>{team.winsSeen}</Text>
                <Text style={styles.teamValue}>{team.lossesSeen}</Text>
              </View>
            ))}
          </SectionCard>

          <SectionCard title="Friends">
            {followedFriends.length ? (
              followedFriends.slice(0, 3).map(({ friend, latestFriendLog, latestFriendGame, friendStats }) => (
                <View key={friend.id} style={styles.friendRow}>
                  <View style={styles.friendCopy}>
                    <Text style={styles.friendName}>{friend.displayName}</Text>
                    <Text style={styles.secondaryText}>
                      {friendStats.totalGamesAttended} games • {friendStats.totalHitsSeen} hits
                    </Text>
                    {latestFriendLog && latestFriendGame ? (
                      <Text style={styles.secondaryText}>
                        {latestFriendLog.attendedOn} • {formatGameLabel(latestFriendGame, teamsById, venuesById).title}
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
