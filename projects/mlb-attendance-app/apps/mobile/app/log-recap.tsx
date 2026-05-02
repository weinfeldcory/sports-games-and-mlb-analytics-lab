import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../src/components/common/Screen";
import { PrimaryButton } from "../src/components/common/PrimaryButton";
import { SectionCard } from "../src/components/common/SectionCard";
import { useAppData } from "../src/providers/AppDataProvider";
import { useResponsiveLayout } from "../src/styles/responsive";
import { colors, spacing } from "../src/styles/tokens";
import { formatGameLabel } from "../src/lib/formatters";
import type { Game } from "@mlb-attendance/domain";

const milestoneTargets = [1, 5, 10, 20, 30, 50];

function getGameInsight(game: Game) {
  const topHitter = [...(game.battersUsed ?? [])].sort((left, right) => {
    if (right.homeRuns !== left.homeRuns) {
      return right.homeRuns - left.homeRuns;
    }
    if (right.hits !== left.hits) {
      return right.hits - left.hits;
    }
    return right.rbis - left.rbis;
  })[0];
  const topPitcher = [...(game.pitchersUsed ?? [])].sort((left, right) => {
    if ((right.strikeouts ?? 0) !== (left.strikeouts ?? 0)) {
      return (right.strikeouts ?? 0) - (left.strikeouts ?? 0);
    }
    return (right.inningsPitched ?? 0) - (left.inningsPitched ?? 0);
  })[0];

  if (topHitter && (topHitter.homeRuns > 0 || topHitter.hits > 0)) {
    return `${topHitter.playerName} finished ${topHitter.hits}-${topHitter.atBats}${topHitter.homeRuns ? ` with ${topHitter.homeRuns} HR` : ""}.`;
  }

  if (topPitcher && ((topPitcher.strikeouts ?? 0) > 0 || (topPitcher.inningsPitched ?? 0) > 0)) {
    return `${topPitcher.pitcherName} worked ${topPitcher.inningsPitched ?? 0} IP with ${topPitcher.strikeouts ?? 0} K.`;
  }

  return null;
}

function getMilestoneMessage(totalGames: number, stadiums: number) {
  const gameMilestone = milestoneTargets.includes(totalGames) ? `${totalGames} games logged` : null;
  const stadiumMilestone = [1, 5, 10, 20, 30].includes(stadiums) ? `${stadiums} stadiums visited` : null;

  if (gameMilestone && stadiumMilestone) {
    return `Milestone unlocked: ${gameMilestone} and ${stadiumMilestone}.`;
  }
  if (gameMilestone) {
    return `Milestone unlocked: ${gameMilestone}.`;
  }
  if (stadiumMilestone) {
    return `Milestone unlocked: ${stadiumMilestone}.`;
  }

  const nextGameTarget = milestoneTargets.find((target) => target > totalGames);
  if (!nextGameTarget) {
    return "Your ledger cleared every current game milestone.";
  }

  return `${nextGameTarget - totalGames} more ${nextGameTarget - totalGames === 1 ? "game" : "games"} until ${nextGameTarget} logged.`;
}

export default function LogRecapScreen() {
  const router = useRouter();
  const responsive = useResponsiveLayout();
  const { logId } = useLocalSearchParams<{ logId?: string }>();
  const { isHydrated, isAuthenticated, attendanceLogs, games, teams, venues, stats } = useAppData();
  const authRoute = "/auth" as Href;
  const gamesById = new Map(games.map((game) => [game.id, game]));
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const venuesById = new Map(venues.map((venue) => [venue.id, venue]));
  const log = typeof logId === "string" ? attendanceLogs.find((entry) => entry.id === logId) : attendanceLogs[0];
  const game = log ? gamesById.get(log.gameId) : undefined;
  const label = game ? formatGameLabel(game, teamsById, venuesById) : null;
  const gameInsight = game ? getGameInsight(game) : null;
  const isPlayerDataComplete = Boolean(game?.battersUsed?.length && game?.pitchersUsed?.length);

  if (isHydrated && !isAuthenticated) {
    return <Redirect href={authRoute} />;
  }

  if (!log || !game || !label) {
    return <Redirect href={"/(tabs)/history" as Href} />;
  }

  const recapInsights = [
    {
      label: "Total games",
      value: String(stats.totalGamesAttended),
      detail: `${stats.wins}-${stats.losses} overall in your ledger`
    },
    {
      label: "Stadiums",
      value: String(stats.uniqueStadiumsVisited),
      detail: `${getMilestoneMessage(stats.totalGamesAttended, stats.uniqueStadiumsVisited)}`
    },
    {
      label: "Record",
      value: stats.favoriteTeamSplit ? `${stats.favoriteTeamSplit.wins}-${stats.favoriteTeamSplit.losses}` : `${stats.wins}-${stats.losses}`,
      detail: stats.favoriteTeamSplit ? `${stats.favoriteTeamSplit.teamName} when you attend` : "Overall attended record"
    }
  ];
  const unlockCards = [
    game.walkOff ? "Walk-off added to your ledger." : null,
    game.featuredPlayerHomeRun ? `${game.featuredPlayerHomeRun} left the yard in this one.` : null,
    log.memorableMoment?.trim() ? "You also saved the story behind the box score." : null
  ].filter(Boolean) as string[];

  return (
    <Screen
      title="Game Added"
      subtitle="What that save just unlocked in your ledger."
    >
      <SectionCard title="You added this game">
        <View style={styles.heroCard}>
          <Text style={styles.successTitle}>Added to your MLB ledger</Text>
          <Text style={styles.primaryText}>{label.title}</Text>
          <Text style={styles.secondaryText}>{label.subtitle}</Text>
          <Text style={styles.secondaryText}>Final score: {label.score}</Text>
        </View>
      </SectionCard>

      <SectionCard title="What this unlocked">
        <View style={[styles.statGrid, responsive.isCompact ? styles.statGridCompact : null]}>
          {recapInsights.map((insight) => (
            <View key={insight.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{insight.label}</Text>
              <Text style={styles.statValue}>{insight.value}</Text>
              <Text style={styles.secondaryText}>{insight.detail}</Text>
            </View>
          ))}
        </View>
        {unlockCards.length ? (
          <View style={styles.unlockStack}>
            {unlockCards.slice(0, 2).map((card) => (
              <View key={card} style={styles.unlockCard}>
                <Text style={styles.primaryText}>{card}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </SectionCard>

      <View style={styles.grid}>
        <SectionCard title="Player Snapshot">
          {isPlayerDataComplete ? (
            <Text style={styles.primaryText}>{gameInsight ?? "Player data is attached, but this game did not produce one standout line yet."}</Text>
          ) : (
            <Text style={styles.secondaryText}>Player insights for this game are still being prepared. Your save is secure and the player layer will fill in as coverage catches up.</Text>
          )}
        </SectionCard>

        <SectionCard title="Next best action">
          <View style={styles.actionStack}>
            <PrimaryButton label="Log Another Game" onPress={() => router.push("/(tabs)/log-game" as Href)} />
            <PrimaryButton label="View Fan Résumé" variant="secondary" onPress={() => router.push("/(tabs)/stats" as Href)} />
            <PrimaryButton label="Open Game Detail" variant="secondary" onPress={() => router.push((`/logged-game/${log.id}`) as Href)} />
          </View>
        </SectionCard>
      </View>

      {log.memorableMoment ? (
        <SectionCard title="Memory Saved">
          <Text style={styles.primaryText}>{log.memorableMoment}</Text>
        </SectionCard>
      ) : null}

      <View style={styles.actionStack}>
        <PrimaryButton label="View Dashboard" onPress={() => router.push("/(tabs)" as Href)} />
        <PrimaryButton label="Add Details / Memory" variant="secondary" onPress={() => router.push((`/logged-game/${log.id}`) as Href)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: spacing.sm
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.green
  },
  primaryText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.slate900,
    fontWeight: "700"
  },
  secondaryText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.slate500
  },
  grid: {
    gap: spacing.lg
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  statGridCompact: {
    flexDirection: "column"
  },
  statCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: colors.slate050,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs
  },
  statLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate500,
    fontWeight: "700"
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.navy
  },
  actionStack: {
    gap: spacing.sm
  },
  unlockStack: {
    gap: spacing.sm
  },
  unlockCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    padding: spacing.md
  }
});
