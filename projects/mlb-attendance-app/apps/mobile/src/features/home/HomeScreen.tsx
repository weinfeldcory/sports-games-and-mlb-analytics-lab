import { useMemo, useState } from "react";
import { ScrollView, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { calculatePersonalStats, type Game } from "@mlb-attendance/domain";
import { EmptyState } from "../../components/common/EmptyState";
import { HeroCard } from "../../components/common/HeroCard";
import { InsightCard } from "../../components/common/InsightCard";
import { MetricCard } from "../../components/common/MetricCard";
import { Screen } from "../../components/common/Screen";
import { PlaceholderPanel } from "../../components/common/PlaceholderPanel";
import { PrimaryButton } from "../../components/common/PrimaryButton";
import { SectionCard } from "../../components/common/SectionCard";
import { StatusPill } from "../../components/common/StatusPill";
import { useAppData } from "../../providers/AppDataProvider";
import { useResponsiveLayout } from "../../styles/responsive";
import { colors, radii, shadows, spacing } from "../../styles/tokens";
import { formatGameLabel } from "../../lib/formatters";
import { APP_NAME } from "../../config/brand";

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

function getTopInsights(stats: ReturnType<typeof calculatePersonalStats>, favoriteTeamName?: string) {
  return [
    {
      label: "Current pace",
      value: `${stats.totalGamesAttended} games and ${stats.uniqueStadiumsVisited} stadiums`,
      detail: favoriteTeamName
        ? `${favoriteTeamName} shows up in ${stats.favoriteTeamSplit?.gamesAttended ?? 0} of them.`
        : "Set a favorite team to unlock cleaner record splits."
    },
    {
      label: "Best hitter seen",
      value: stats.playerBattingSummaries[0]
        ? `${stats.playerBattingSummaries[0].playerName}`
        : "Still building",
      detail: stats.playerBattingSummaries[0]
        ? `${stats.playerBattingSummaries[0].homeRunsSeen} HR seen • ${stats.playerBattingSummaries[0].hitsSeen} hits`
        : "Player insights turn on as your logged games deepen."
    },
    {
      label: "Pitching trail",
      value: stats.playerPitchingSummaries[0]
        ? `${stats.playerPitchingSummaries[0].pitcherName}`
        : "Still building",
      detail: stats.playerPitchingSummaries[0]
        ? `${stats.playerPitchingSummaries[0].strikeoutsSeen} K seen • ${stats.uniquePitchersSeen} unique pitchers`
        : "Pitcher summaries appear as soon as box-score data is attached."
    }
  ];
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

function buildLevelJourney(points: number) {
  const topThreshold = levelThresholds[levelThresholds.length - 1]?.points ?? 0;
  const topProgress = topThreshold > 0 ? Math.min(1, points / topThreshold) : 0;

  return {
    topProgress,
    levels: levelThresholds.map((level, index) => {
      const nextLevel = levelThresholds[index + 1];
      const status = points >= level.points
        ? nextLevel && points < nextLevel.points
          ? "current"
          : "completed"
        : "upcoming";

      return {
        ...level,
        status
      };
    })
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

function buildGameNotes(game: { walkOff?: boolean; innings?: number; featuredPlayerHomeRun?: string | null }) {
  const notes = [];

  if (game.walkOff) {
    notes.push("Walk-off");
  }
  if (game.innings && game.innings > 9) {
    notes.push(`${game.innings} innings`);
  }
  if (game.featuredPlayerHomeRun) {
    notes.push(`${game.featuredPlayerHomeRun} HR`);
  }

  return notes;
}

interface LedgerPrompt {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  actionLabel: string;
  route: Href;
}

interface InsightCardItem {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  actionLabel: string;
  route: Href;
}

interface LedgerQualitySummary {
  score: number;
  memoryCoverage: number;
  seatCoverage: number;
  detailsCoverage: number;
  missingMemoryCount: number;
  missingSeatCount: number;
  missingDetailsCount: number;
}

function isMemoryMissing(log: { memorableMoment?: string }) {
  return !log.memorableMoment?.trim();
}

function isSeatDetailsMissing(log: { seat: { section: string; row?: string; seatNumber?: string } }) {
  return (
    !log.seat.section.trim()
    || log.seat.section.trim().toLowerCase() === "unknown"
    || !log.seat.row?.trim()
    || !log.seat.seatNumber?.trim()
  );
}

function hasExtraDetail(log: { companion?: string; giveaway?: string; weather?: string }) {
  return Boolean(log.companion?.trim() || log.giveaway?.trim() || log.weather?.trim());
}

function toPercent(value: number) {
  return Math.round(value * 100);
}

function buildLedgerQualitySummary(params: {
  attendanceLogs: Array<{
    memorableMoment?: string;
    seat: { section: string; row?: string; seatNumber?: string };
    companion?: string;
    giveaway?: string;
    weather?: string;
  }>;
  favoriteTeamId?: string;
}) {
  const totalLogs = params.attendanceLogs.length;
  const missingMemoryCount = params.attendanceLogs.filter(isMemoryMissing).length;
  const missingSeatCount = params.attendanceLogs.filter(isSeatDetailsMissing).length;
  const missingDetailsCount = params.attendanceLogs.filter((log) => !hasExtraDetail(log)).length;
  const memoryCoverage = totalLogs ? (totalLogs - missingMemoryCount) / totalLogs : 0;
  const seatCoverage = totalLogs ? (totalLogs - missingSeatCount) / totalLogs : 0;
  const detailsCoverage = totalLogs ? (totalLogs - missingDetailsCount) / totalLogs : 0;
  const gamesPoints = Math.min(25, Math.round((Math.min(totalLogs, 10) / 10) * 25));
  const memoryPoints = Math.round(memoryCoverage * 25);
  const seatPoints = Math.round(seatCoverage * 20);
  const detailsPoints = Math.round(detailsCoverage * 15);
  const favoriteTeamPoints = params.favoriteTeamId ? 15 : 0;

  return {
    score: gamesPoints + memoryPoints + seatPoints + detailsPoints + favoriteTeamPoints,
    memoryCoverage,
    seatCoverage,
    detailsCoverage,
    missingMemoryCount,
    missingSeatCount,
    missingDetailsCount
  } satisfies LedgerQualitySummary;
}

function buildLedgerPrompts(params: {
  attendanceLogs: Array<{
    id: string;
    gameId: string;
    memorableMoment?: string;
    seat: { section: string; row?: string; seatNumber?: string };
    companion?: string;
    giveaway?: string;
    weather?: string;
  }>;
  stats: ReturnType<typeof calculatePersonalStats>;
  favoriteTeamName?: string;
  latestLogId?: string;
  latestGameTitle?: string;
  hasFriends: boolean;
  storageMode: "local" | "hosted";
}) {
  const {
    attendanceLogs,
    stats,
    favoriteTeamName,
    latestLogId,
    latestGameTitle,
    hasFriends,
    storageMode
  } = params;

  if (!attendanceLogs.length) {
    return [
      {
        key: "first-game",
        eyebrow: "Start here",
        title: favoriteTeamName ? `Log your first ${favoriteTeamName} game` : "Log your first MLB game",
        body: favoriteTeamName
          ? `Start the ledger with a ${favoriteTeamName} game and unlock your personal fan trail.`
          : "Your first logged game unlocks progress, memories, and the rest of your baseball identity.",
        actionLabel: "Log First Game",
        route: "/(tabs)/log-game" as Href
      }
    ] satisfies LedgerPrompt[];
  }

  const prompts: Array<LedgerPrompt & { rank: number }> = [];
  const missingMemoryLog = attendanceLogs.find(isMemoryMissing);
  const missingSeatLog = attendanceLogs.find(isSeatDetailsMissing);

  if (attendanceLogs.length <= 2) {
    prompts.push({
      key: "log-another",
      eyebrow: "Keep momentum",
      title: favoriteTeamName ? `Log another ${favoriteTeamName} game` : "Log another game",
      body: "Two or three games is when the ledger starts feeling like your real baseball record instead of a first save.",
      actionLabel: "Log Another Game",
      route: "/(tabs)/log-game" as Href,
      rank: 100
    });
  }

  if (missingMemoryLog) {
    prompts.push({
      key: "add-memory",
      eyebrow: "Complete a memory",
      title: "Add a memory before it fades",
      body: "One quick note turns a saved box score into a revisitable baseball story.",
      actionLabel: "Add Memory",
      route: (`/logged-game/${missingMemoryLog.id}`) as Href,
      rank: attendanceLogs.length >= 3 ? 96 : 88
    });
  }

  if (missingSeatLog) {
    prompts.push({
      key: "add-seat",
      eyebrow: "Clean up details",
      title: "Fill in seat details",
      body: "Seat row and number make the memory page feel more complete later.",
      actionLabel: "Add Seat Details",
      route: (`/logged-game/${missingSeatLog.id}`) as Href,
      rank: 84
    });
  }

  if (favoriteTeamName) {
    prompts.push({
      key: "favorite-team",
      eyebrow: "Favorite team",
      title: `Keep building your ${favoriteTeamName} record`,
      body: stats.favoriteTeamSplit
        ? `You have ${stats.favoriteTeamSplit.gamesAttended} ${favoriteTeamName} games in the ledger so far.`
        : `No ${favoriteTeamName} game is in the ledger yet.`,
      actionLabel: "Log Favorite-Team Game",
      route: "/(tabs)/log-game" as Href,
      rank: 80
    });
  }

  if (attendanceLogs.length >= 3) {
    prompts.push({
      key: "fan-resume",
      eyebrow: "Identity page",
      title: "Open your Fan Résumé",
      body: "Your stats page is strongest once a few games, teams, and stadiums are already in the ledger.",
      actionLabel: "View Fan Résumé",
      route: "/(tabs)/stats" as Href,
      rank: 92
    });
  }

  if (latestLogId) {
    prompts.push({
      key: "latest-game",
      eyebrow: "Revisit",
      title: latestGameTitle ? `Revisit ${latestGameTitle}` : "Revisit your latest logged game",
      body: "Open the saved game page to add details, relive the box score, or clean up the memory layer.",
      actionLabel: "Open Latest Game",
      route: (`/logged-game/${latestLogId}`) as Href,
      rank: 76
    });
  }

  if (storageMode === "hosted" && !hasFriends) {
    prompts.push({
      key: "find-friend",
      eyebrow: "Social",
      title: "Find another fan",
      body: "Shared profiles are secondary today, but following one friend gives the app another reason to revisit.",
      actionLabel: "Find Friends",
      route: "/(tabs)/profile" as Href,
      rank: 60
    });
  }

  return prompts
    .sort((left, right) => right.rank - left.rank)
    .slice(0, 5)
    .map(({ rank: _rank, ...prompt }) => prompt);
}

function buildInsightCards(params: {
  attendanceLogs: Array<{
    id: string;
    gameId: string;
    memorableMoment?: string;
    seat: { section: string; row?: string; seatNumber?: string };
    companion?: string;
    giveaway?: string;
    weather?: string;
  }>;
  attendedGames: Game[];
  stats: ReturnType<typeof calculatePersonalStats>;
  favoriteTeamName?: string;
  latestLogId?: string;
  latestGameTitle?: string;
  nextMilestone: ReturnType<typeof getNextMilestone>;
  levelProgress: ReturnType<typeof buildLevelProgress>;
  ledgerQuality: LedgerQualitySummary;
}) {
  const {
    attendanceLogs,
    attendedGames,
    stats,
    favoriteTeamName,
    latestLogId,
    latestGameTitle,
    nextMilestone,
    levelProgress,
    ledgerQuality
  } = params;

  if (!attendanceLogs.length) {
    return [] as InsightCardItem[];
  }

  const cards: Array<InsightCardItem & { rank: number }> = [];
  const highestScoringGame = [...attendedGames].sort(
    (left, right) => (right.homeScore + right.awayScore) - (left.homeScore + left.awayScore)
  )[0];
  const missingMemoryLog = attendanceLogs.find(isMemoryMissing);

  cards.push({
    key: "stadiums",
    eyebrow: "Milestone",
    title: `You have logged ${stats.uniqueStadiumsVisited} stadium${stats.uniqueStadiumsVisited === 1 ? "" : "s"}`,
    body: stats.uniqueStadiumsVisited >= 5
      ? "Your ledger is becoming a real stadium passport."
      : "Each new park makes the ledger feel more personal and collectible.",
    actionLabel: "View Fan Résumé",
    route: "/(tabs)/stats" as Href,
    rank: 84
  });

  if (favoriteTeamName && stats.favoriteTeamSplit) {
    cards.push({
      key: "favorite-record",
      eyebrow: "Favorite team",
      title: `${favoriteTeamName} are ${stats.favoriteTeamSplit.wins}-${stats.favoriteTeamSplit.losses} when you attend`,
      body: `${stats.favoriteTeamSplit.gamesAttended} saved game${stats.favoriteTeamSplit.gamesAttended === 1 ? "" : "s"} are shaping your in-person team record.`,
      actionLabel: "Log Another",
      route: "/(tabs)/log-game" as Href,
      rank: 95
    });
  }

  if (stats.uniquePitchersSeen > 0) {
    cards.push({
      key: "pitchers",
      eyebrow: "Players witnessed",
      title: `You have seen ${stats.uniquePitchersSeen} unique pitcher${stats.uniquePitchersSeen === 1 ? "" : "s"}`,
      body: stats.playerPitchingSummaries[0]
        ? `${stats.playerPitchingSummaries[0].pitcherName} leads your current pitcher trail.`
        : "Pitcher insights deepen as more games gain complete player data.",
      actionLabel: "View Fan Résumé",
      route: "/(tabs)/stats" as Href,
      rank: 80
    });
  }

  if (highestScoringGame) {
    cards.push({
      key: "highest-scoring",
      eyebrow: "Best games",
      title: `Your highest-scoring game had ${highestScoringGame.homeScore + highestScoringGame.awayScore} total runs`,
      body: "Big-score nights are usually worth revisiting when you want the loudest memory in the ledger.",
      actionLabel: "View Fan Résumé",
      route: "/(tabs)/stats" as Href,
      rank: 72
    });
  }

  if (missingMemoryLog) {
    cards.push({
      key: "missing-memories",
      eyebrow: "Make it richer",
      title: `${ledgerQuality.missingMemoryCount} game${ledgerQuality.missingMemoryCount === 1 ? "" : "s"} still need a memory`,
      body: "Preserve the story behind the stats while the details are still easy to remember.",
      actionLabel: "Add Memory",
      route: (`/logged-game/${missingMemoryLog.id}`) as Href,
      rank: 98
    });
  }

  if (nextMilestone) {
    cards.push({
      key: "milestone",
      eyebrow: "Progress",
      title: `${nextMilestone.remaining} more ${nextMilestone.remaining === 1 ? "game" : "games"} until ${nextMilestone.target}`,
      body: `${levelProgress.currentLevel.title} turns into a deeper ledger once you keep stacking attended games.`,
      actionLabel: "Log Another",
      route: "/(tabs)/log-game" as Href,
      rank: 90
    });
  }

  if (latestLogId && latestGameTitle) {
    cards.push({
      key: "latest-game",
      eyebrow: "Recent save",
      title: `Revisit ${latestGameTitle}`,
      body: "Open the saved game page to finish details, relive the box score, or add the story while it is still fresh.",
      actionLabel: "Open Game",
      route: (`/logged-game/${latestLogId}`) as Href,
      rank: 78
    });
  }

  if (ledgerQuality.score < 80) {
    cards.push({
      key: "ledger-quality",
      eyebrow: "Archive completeness",
      title: `Your ledger quality is ${ledgerQuality.score}/100`,
      body: "A few more memories, seat details, and profile choices will make the archive feel much richer.",
      actionLabel: "Improve Ledger",
      route: "/(tabs)/profile" as Href,
      rank: 86
    });
  }

  return cards
    .sort((left, right) => right.rank - left.rank)
    .slice(0, 5)
    .map(({ rank: _rank, ...card }) => card);
}

export function HomeScreen() {
  const router = useRouter();
  const responsive = useResponsiveLayout();
  const [dismissedInsightKeys, setDismissedInsightKeys] = useState<string[]>([]);
  const {
    attendanceLogs,
    friends,
    pendingFollowRequests,
    games,
    teams,
    venues,
    stats,
    profile,
    persistenceStatus,
    persistenceError,
    isHydrated,
    retryHydration,
    unfollowUser,
    storageMode
  } = useAppData();
  const isWide = responsive.isWideDesktop;
  const shouldStackHeroRail = responsive.isNarrow;
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
  const topTeams = useMemo(
    () => [...stats.teamSeenSummaries].sort((left, right) => right.gamesSeen - left.gamesSeen).slice(0, 6),
    [stats.teamSeenSummaries]
  );
  const followingPreview = friends.slice(0, 3);
  const topInsights = useMemo(() => getTopInsights(stats, favoriteTeam?.name), [favoriteTeam?.name, stats]);
  const ledgerPrompts = useMemo(
    () =>
      buildLedgerPrompts({
        attendanceLogs,
        stats,
        favoriteTeamName: favoriteTeam?.name,
        latestLogId: latestLog?.id,
        latestGameTitle: latestGameLabel?.title,
        hasFriends: friends.length > 0,
        storageMode
      }),
    [attendanceLogs, favoriteTeam?.name, friends.length, latestGameLabel?.title, latestLog?.id, stats, storageMode]
  );
  const ledgerQuality = useMemo(
    () =>
      buildLedgerQualitySummary({
        attendanceLogs,
        favoriteTeamId: profile.favoriteTeamId
      }),
    [attendanceLogs, profile.favoriteTeamId]
  );
  const insightCards = useMemo(
    () =>
      buildInsightCards({
        attendanceLogs,
        attendedGames,
        stats,
        favoriteTeamName: favoriteTeam?.name,
        latestLogId: latestLog?.id,
        latestGameTitle: latestGameLabel?.title,
        nextMilestone,
        levelProgress,
        ledgerQuality
      }).filter((card) => !dismissedInsightKeys.includes(card.key)),
    [
      attendanceLogs,
      attendedGames,
      dismissedInsightKeys,
      favoriteTeam?.name,
      latestGameLabel?.title,
      latestLog?.id,
      ledgerQuality,
      levelProgress,
      nextMilestone,
      stats
    ]
  );
  const favoriteRecord = stats.favoriteTeamSplit
    ? `${stats.favoriteTeamSplit.wins}-${stats.favoriteTeamSplit.losses}`
    : `${stats.wins}-${stats.losses}`;
  const levelJourney = useMemo(() => buildLevelJourney(levelProgress.points), [levelProgress.points]);
  const heroStatusLabel =
    persistenceStatus === "error"
      ? "Sync needs attention"
      : persistenceStatus === "saving"
        ? "Saving changes"
        : persistenceStatus === "saved"
          ? "Ledger saved"
          : "Ready for the next game";
  const heroStatusTone =
    persistenceStatus === "error"
      ? "danger"
      : persistenceStatus === "saving"
        ? "warning"
        : "success";

  return (
    <Screen title="Home" subtitle={`Your MLB ledger inside ${APP_NAME}: latest memories, unlocked progress, and the next best move.`}>
      <HeroCard>
        {isHydrated ? (
          <View style={styles.heroStack}>
            <View style={[styles.heroTopRow, !shouldStackHeroRail ? styles.heroTopRowWide : null]}>
              <View style={styles.heroLead}>
                <StatusPill label={`Your ${APP_NAME} Ledger`} tone="dark" />
                <Text style={styles.heroName}>{profile.displayName}</Text>
                <Text style={[styles.heroTitle, responsive.isCompact ? styles.heroTitleCompact : null]}>
                  {hasLogs ? levelProgress.currentLevel.title : "Build your fan record"}
                </Text>
                <Text style={styles.heroBody}>
                  {hasLogs
                    ? `${stats.totalGamesAttended} games, ${stats.uniqueStadiumsVisited} stadiums, and ${stats.witnessedHomeRuns} home runs seen in person.`
                    : "Start with one attended game and this turns into your personal baseball command center."}
                </Text>
                <View style={styles.heroActions}>
                  {nextAction.route ? (
                    <PrimaryButton label="Log a Game" onPress={() => router.push("/(tabs)/log-game")} />
                  ) : (
                    <PrimaryButton label="Retry Storage" onPress={retryHydration} />
                  )}
                  <PrimaryButton label="View Fan Résumé" variant="secondary" onPress={() => router.push("/(tabs)/stats")} />
                </View>
              </View>

              <View style={styles.heroRail}>
                <View style={styles.heroRailCard}>
                  <Text style={styles.heroRailLabel}>Level journey</Text>
                  <Text style={styles.heroRailValue}>{hasLogs ? levelProgress.currentLevel.title : "Rookie Scorer"}</Text>
                  <Text style={styles.heroRailMeta}>
                    {levelProgress.nextLevel
                      ? `${levelProgress.nextLevel.points - levelProgress.points} to ${levelProgress.nextLevel.title}`
                      : "Top level reached"}
                  </Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${levelJourney.topProgress * 100}%` }]} />
                  </View>
                  <View style={styles.levelMilestoneRow}>
                    {levelJourney.levels.map((level) => (
                      <View key={level.title} style={styles.levelMilestone}>
                        <View
                          style={[
                            styles.levelMilestoneDot,
                            level.status === "completed" ? styles.levelMilestoneDotCompleted : null,
                            level.status === "current" ? styles.levelMilestoneDotCurrent : null
                          ]}
                        />
                      </View>
                    ))}
                  </View>
                  <View style={styles.levelLegendStack}>
                    {levelJourney.levels.map((level) => (
                      <View key={`${level.title}_legend`} style={styles.levelLegendRow}>
                        <View
                          style={[
                            styles.levelLegendBadge,
                            level.status === "completed" ? styles.levelLegendBadgeCompleted : null,
                            level.status === "current" ? styles.levelLegendBadgeCurrent : null
                          ]}
                        >
                          <Text style={styles.levelLegendPoints}>{level.points}</Text>
                        </View>
                        <View style={styles.levelLegendCopy}>
                          <Text style={styles.levelLegendTitle}>{level.title}</Text>
                          <Text style={styles.levelLegendMeta}>
                            {level.status === "completed"
                              ? "Unlocked"
                              : level.status === "current"
                                ? "Current level"
                                : `${Math.max(0, level.points - levelProgress.points)} pts away`}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={styles.heroRailCard}>
                  <Text style={styles.heroRailLabel}>{hasLogs ? "Latest unlock" : "What this unlocks"}</Text>
                  <Text style={styles.heroRailBody}>
                    {hasLogs
                      ? insightCards[0]?.title ?? nextAction.summary
                      : "Log one game to unlock your personal record, your favorite-team split, and the first version of your Fan Résumé."}
                  </Text>
                  {hasLogs && insightCards[0] ? <Text style={styles.heroRailMeta}>{insightCards[0].body}</Text> : null}
                  <StatusPill label={heroStatusLabel} tone={heroStatusTone} />
                </View>
              </View>
            </View>

            <View style={[styles.metricGrid, responsive.isCompact ? styles.metricGridCompact : null]}>
              <MetricCard
                label="Games"
                value={String(stats.totalGamesAttended)}
                meta={`${stats.wins}-${stats.losses} overall`}
                inverse
              />
              <MetricCard
                label={favoriteTeam?.name ? `${favoriteTeam.abbreviation} Record` : "Record"}
                value={favoriteRecord}
                meta={favoriteTeam ? "Favorite-team split" : "All logged games"}
                inverse
              />
              <MetricCard
                label="Stadiums"
                value={String(stats.uniqueStadiumsVisited)}
                meta={`${stats.teamSeenSummaries.length} teams seen`}
                inverse
              />
            </View>
            <View style={styles.heroGranularRow}>
              <View style={styles.heroGranularChip}>
                <Text style={styles.heroGranularLabel}>Home runs seen</Text>
                <Text style={styles.heroGranularValue}>{stats.witnessedHomeRuns}</Text>
              </View>
              <View style={styles.heroGranularChip}>
                <Text style={styles.heroGranularLabel}>Best attendance streak</Text>
                <Text style={styles.heroGranularValue}>{levelProgress.streaks.bestWeeks} week{levelProgress.streaks.bestWeeks === 1 ? "" : "s"}</Text>
              </View>
              <View style={styles.heroGranularChip}>
                <Text style={styles.heroGranularLabel}>Teams seen</Text>
                <Text style={styles.heroGranularValue}>{stats.teamSeenSummaries.length}</Text>
              </View>
              <View style={styles.heroGranularChip}>
                <Text style={styles.heroGranularLabel}>Current pace</Text>
                <Text style={styles.heroGranularValue}>{levelProgress.points} pts</Text>
              </View>
            </View>

            {persistenceError ? <Text style={styles.heroError}>{persistenceError}</Text> : null}
          </View>
        ) : (
          <Text style={styles.heroLoading}>Loading your ledger...</Text>
        )}
      </HeroCard>

      {!hasLogs ? (
        <EmptyState
          eyebrow="First game"
          title="Log your first MLB game"
          body="The first save unlocks your home dashboard, your Fan Résumé, and example insights like stadium count, favorite-team record, and the loudest game you have seen in person."
          action={<PrimaryButton label="Log First Game" onPress={() => router.push("/(tabs)/log-game")} />}
        />
      ) : null}

      <SectionCard
        title="Continue Building Your Ledger"
        subtitle="A short list of the highest-value next moves based on what your record already has and what it is still missing."
      >
        <View style={[styles.promptGrid, isWide ? styles.promptGridWide : null]}>
          {ledgerPrompts.map((prompt) => (
            <View key={prompt.key} style={styles.promptCard}>
              <Text style={styles.promptEyebrow}>{prompt.eyebrow}</Text>
              <Text style={styles.promptTitle}>{prompt.title}</Text>
              <Text style={styles.promptBody}>{prompt.body}</Text>
              <PrimaryButton label={prompt.actionLabel} onPress={() => router.push(prompt.route)} variant="secondary" />
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard
        title="For You"
        subtitle="Fresh signals from your ledger so the next action is obvious without digging through tables."
      >
        {insightCards.length ? (
          <View style={styles.insightFeedStack}>
            {insightCards.map((card) => (
              <View key={card.key} style={styles.insightFeedCard}>
                <View style={styles.insightFeedHeader}>
                  <Text style={styles.promptEyebrow}>{card.eyebrow}</Text>
                  <Pressable onPress={() => setDismissedInsightKeys((current) => [...current, card.key])}>
                    <Text style={styles.dismissText}>Hide</Text>
                  </Pressable>
                </View>
                <Text style={styles.promptTitle}>{card.title}</Text>
                <Text style={styles.promptBody}>{card.body}</Text>
                <PrimaryButton label={card.actionLabel} variant="secondary" onPress={() => router.push(card.route)} />
              </View>
            ))}
          </View>
        ) : (
          <PlaceholderPanel
            title="Your next insights will appear here"
            body="As soon as you log more games or complete more memory details, this feed rotates in the strongest reasons to come back."
          />
        )}
      </SectionCard>

      <View style={[styles.grid, isWide ? styles.gridWide : null]}>
        <View style={styles.mainColumn}>
          <SectionCard title="Top personal insights" subtitle="The fastest read on your baseball identity right now.">
            {hasLogs ? (
              <View style={styles.summaryCardGrid}>
                {topInsights.map((insight) => (
                  <InsightCard key={insight.label} eyebrow={insight.label} title={insight.value} body={insight.detail} />
                ))}
              </View>
            ) : (
              <PlaceholderPanel
                title="Your first game starts the story"
                body="Once one attended game is in the ledger, this section becomes the fastest read on your baseball record."
                actionLabel="Log First Game"
                onAction={() => router.push("/(tabs)/log-game")}
              />
            )}
          </SectionCard>

          <SectionCard title="Latest logged game" subtitle="Your newest memory and its box-score context.">
            {latestGame && latestGameLabel ? (
              <View style={styles.featuredGameCard}>
                <View style={styles.featuredGameCopy}>
                  <Text style={styles.primaryText}>{latestGameLabel.title}</Text>
                  <Text style={styles.secondaryText}>{latestGameLabel.subtitle}</Text>
                  <Text style={styles.scoreText}>Final {latestGameLabel.score}</Text>
                </View>
                <View style={styles.tagRow}>
                  {buildGameNotes(latestGame).map((note) => (
                    <StatusPill key={note} label={note} tone="info" />
                  ))}
                </View>
                {latestLog.memorableMoment ? <Text style={styles.noteText}>{latestLog.memorableMoment}</Text> : null}
                <Text style={styles.secondaryText}>
                  {stats.playerBattingSummaries[0]
                    ? `Top hitter seen so far: ${stats.playerBattingSummaries[0].playerName}.`
                    : "Player summaries are still building as more games gain complete box-score coverage."}
                </Text>
                <View style={styles.inlineActions}>
                  <PrimaryButton label="Open Game Page" onPress={() => router.push((`/logged-game/${latestLog.id}`) as never)} />
                  <PrimaryButton label="View Stats" variant="secondary" onPress={() => router.push("/(tabs)/stats")} />
                </View>
              </View>
            ) : (
              <PlaceholderPanel
                title="Your first game belongs here"
                body="Search for the matchup you attended, save it once, and this becomes the latest chapter in your baseball ledger."
                actionLabel="Pick First Game"
                onAction={() => router.push("/(tabs)/log-game")}
              />
            )}
          </SectionCard>

          <SectionCard title="Progress and milestones" subtitle="Where your ledger is headed next.">
            <View style={styles.progressGrid}>
              <InsightCard
                eyebrow="Milestone"
                title={
                  nextMilestone
                    ? `${nextMilestone.remaining} more ${nextMilestone.remaining === 1 ? "game" : "games"}`
                    : "Milestone ladder cleared"
                }
                body={
                  nextMilestone
                    ? `You are closing in on ${nextMilestone.target} logged games.`
                    : "Keep stacking games and stadiums while the next beta levels take shape."
                }
              />
              <InsightCard
                eyebrow="Level scoring"
                title={`${levelProgress.counts.games} games • ${levelProgress.counts.stadiums} stadiums`}
                body={`HR seen ${levelProgress.counts.homeRuns} • Walk-offs ${levelProgress.counts.walkOffs} • Extra innings ${levelProgress.counts.extraInnings} • Best streak ${levelProgress.counts.bestStreakWeeks} weeks`}
              />
            </View>
          </SectionCard>

          <SectionCard title="When you go" subtitle="Your game-window heat map in Eastern Time.">
            {hasTimedGames ? (
              <ScrollView horizontal={responsive.isCompact} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.patternScrollContent}>
                <View style={[styles.patternWrap, responsive.isCompact ? styles.patternWrapCompact : null]}>
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
                </View>
              </ScrollView>
            ) : (
              <PlaceholderPanel
                title="No first-pitch pattern yet"
                body="This view turns on as the logged-game set fills in start times."
              />
            )}
          </SectionCard>
        </View>

        <View style={styles.sideColumn}>
          <SectionCard title="Ledger Quality" subtitle="A simple completeness score that nudges the archive to feel richer over time.">
            <View style={styles.qualityHero}>
              <Text style={styles.qualityScore}>{ledgerQuality.score}</Text>
              <Text style={styles.qualityScoreLabel}>Archive completeness</Text>
              <Text style={styles.secondaryText}>
                Preserve the story behind the stats with a few more memories, seat details, and profile choices.
              </Text>
            </View>
            <View style={styles.qualityChipRow}>
              <StatusPill label={`${toPercent(ledgerQuality.memoryCoverage)}% memories`} tone="default" />
              <StatusPill label={`${toPercent(ledgerQuality.seatCoverage)}% seat details`} tone="default" />
              <StatusPill label={`${toPercent(ledgerQuality.detailsCoverage)}% extra details`} tone="default" />
            </View>
            <View style={styles.qualityPromptStack}>
              {ledgerQuality.missingMemoryCount > 0 ? (
                <View style={styles.qualityPromptCard}>
                  <Text style={styles.promptEyebrow}>Make it richer</Text>
                  <Text style={styles.promptBody}>
                    Add memories to {ledgerQuality.missingMemoryCount} game{ledgerQuality.missingMemoryCount === 1 ? "" : "s"}.
                  </Text>
                </View>
              ) : null}
              {ledgerQuality.missingSeatCount > 0 ? (
                <View style={styles.qualityPromptCard}>
                  <Text style={styles.promptEyebrow}>Fill in seats</Text>
                  <Text style={styles.promptBody}>
                    Finish seat details for {ledgerQuality.missingSeatCount} game{ledgerQuality.missingSeatCount === 1 ? "" : "s"}.
                  </Text>
                </View>
              ) : null}
              {!profile.favoriteTeamId ? (
                <View style={styles.qualityPromptCard}>
                  <Text style={styles.promptEyebrow}>Favorite team</Text>
                  <Text style={styles.promptBody}>Pick a favorite team to unlock cleaner record splits across Home and Fan Résumé.</Text>
                </View>
              ) : null}
            </View>
            <PrimaryButton label="Open Profile" variant="secondary" onPress={() => router.push("/(tabs)/profile")} />
          </SectionCard>

          <SectionCard title="Top teams seen" subtitle="The clubs most attached to your ledger.">
            {topTeams.length ? (
              <View style={styles.teamSummaryStack}>
                {topTeams.map((team) => (
                  <View key={team.teamId} style={[styles.teamSummaryCard, responsive.isCompact ? styles.teamSummaryCardCompact : null]}>
                    <View style={[styles.teamSummaryHeader, responsive.isCompact ? styles.teamSummaryHeaderCompact : null]}>
                      <Text style={styles.teamSummaryName}>{team.teamName}</Text>
                      <StatusPill label={`${team.gamesSeen} games`} tone="default" />
                    </View>
                    <Text style={styles.teamSummaryMeta}>
                      {team.winsSeen}-{team.lossesSeen} attended record • {team.runsSeen} runs seen • {team.hitsSeen} hits seen
                    </Text>
                  </View>
                ))}
                <PrimaryButton label="Open Full Stats" variant="secondary" onPress={() => router.push("/(tabs)/stats")} />
              </View>
            ) : (
              <PlaceholderPanel
                title="No team splits yet"
                body="Once you log games, this becomes the visual club summary of your baseball trail."
              />
            )}
          </SectionCard>

          <SectionCard title="Following" subtitle="Secondary for now until the shared profile graph deepens.">
            {followingPreview.length ? (
              <View style={styles.socialStack}>
                {followingPreview.map((friend) => {
                  const favoriteFollowedTeam = teams.find((team) => team.id === friend.favoriteTeamId);

                  return (
                    <View key={friend.id} style={styles.friendRow}>
                      <Pressable style={styles.friendCopy} onPress={() => router.push((`/friends/${friend.id}`) as never)}>
                        <Text style={styles.friendName}>{friend.displayName}</Text>
                        <Text style={styles.secondaryText}>
                          {friend.username ? `@${friend.username}` : "App fan"} • {favoriteFollowedTeam?.name ?? "No favorite team"}
                        </Text>
                        <Text style={styles.secondaryText}>
                          {friend.sharedGamesLogged ?? 0} games shared • {friend.sharedStadiumsVisited ?? 0} stadiums shared
                        </Text>
                      </Pressable>
                      <View style={styles.inlineActions}>
                        <PrimaryButton label="View" variant="secondary" onPress={() => router.push((`/friends/${friend.id}`) as never)} />
                        <PrimaryButton label="Unfollow" variant="ghost" onPress={() => void unfollowUser(friend.id)} />
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.secondaryText}>No accepted follows yet. Profile is the place to find people and manage requests.</Text>
            )}
          </SectionCard>

          <SectionCard title="Requests" subtitle="What is waiting for action right now.">
            {pendingFollowRequests.length ? (
              pendingFollowRequests.map((request) => (
                <View key={request.id} style={styles.friendRow}>
                  <View style={styles.friendCopy}>
                    <Text style={styles.friendName}>{request.profile.displayName}</Text>
                    <Text style={styles.secondaryText}>
                      {request.direction === "incoming" ? "Wants to follow you" : "Request already sent"}
                    </Text>
                  </View>
                  <PrimaryButton label="Profile" variant="secondary" onPress={() => router.push((`/friends/${request.profile.id}`) as never)} />
                </View>
              ))
            ) : (
              <Text style={styles.secondaryText}>No requests are waiting right now.</Text>
            )}
          </SectionCard>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.lg
  },
  gridWide: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  promptGrid: {
    gap: spacing.md
  },
  promptGridWide: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  promptCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.subtle
  },
  promptEyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: colors.clay,
    fontWeight: "800"
  },
  promptTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    color: colors.text
  },
  promptBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted
  },
  insightFeedStack: {
    gap: spacing.md
  },
  insightFeedCard: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.subtle
  },
  insightFeedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  dismissText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textSoft
  },
  mainColumn: {
    flex: 1.15,
    gap: spacing.lg
  },
  sideColumn: {
    flex: 0.85,
    gap: spacing.lg
  },
  heroStack: {
    gap: spacing.lg
  },
  heroTopRow: {
    gap: spacing.lg
  },
  heroTopRowWide: {
    flexDirection: "row",
    alignItems: "stretch"
  },
  heroLead: {
    flex: 1.25,
    gap: spacing.sm
  },
  heroName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.warning
  },
  heroTitle: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "900",
    color: colors.textInverse
  },
  heroTitleCompact: {
    fontSize: 28,
    lineHeight: 32
  },
  heroBody: {
    fontSize: 16,
    lineHeight: 24,
    color: "rgba(255,253,248,0.82)",
    maxWidth: 680
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  heroRail: {
    flex: 0.8,
    gap: spacing.md
  },
  heroRailCard: {
    backgroundColor: "rgba(255,253,248,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,253,248,0.1)",
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm
  },
  heroRailLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "rgba(255,253,248,0.62)",
    fontWeight: "800"
  },
  heroRailValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    color: colors.textInverse
  },
  heroRailMeta: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,253,248,0.7)"
  },
  heroRailBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,253,248,0.7)"
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  metricGridCompact: {
    gap: spacing.sm
  },
  heroGranularRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  heroGranularChip: {
    minWidth: 148,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,253,248,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,253,248,0.1)",
    gap: 2
  },
  heroGranularLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: "800",
    color: "rgba(255,253,248,0.62)"
  },
  heroGranularValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: colors.textInverse
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,253,248,0.16)",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.warning
  },
  levelMilestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs
  },
  levelMilestone: {
    flex: 1,
    alignItems: "center"
  },
  levelMilestoneDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,253,248,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,253,248,0.28)"
  },
  levelMilestoneDotCompleted: {
    backgroundColor: colors.warning,
    borderColor: colors.warning
  },
  levelMilestoneDotCurrent: {
    width: 14,
    height: 14,
    backgroundColor: colors.textInverse,
    borderColor: colors.textInverse
  },
  levelLegendStack: {
    gap: spacing.sm
  },
  levelLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  levelLegendBadge: {
    minWidth: 52,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,253,248,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,253,248,0.14)",
    alignItems: "center"
  },
  levelLegendBadgeCompleted: {
    backgroundColor: colors.warning,
    borderColor: colors.warning
  },
  levelLegendBadgeCurrent: {
    backgroundColor: colors.textInverse,
    borderColor: colors.textInverse
  },
  levelLegendPoints: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.surfaceDark
  },
  levelLegendCopy: {
    flex: 1,
    gap: 2
  },
  levelLegendTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: colors.textInverse
  },
  levelLegendMeta: {
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(255,253,248,0.68)"
  },
  heroLoading: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textInverse
  },
  heroError: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.warning
  },
  summaryCardGrid: {
    gap: spacing.md
  },
  featuredGameCard: {
    gap: spacing.md
  },
  featuredGameCopy: {
    gap: spacing.xs
  },
  primaryText: {
    fontSize: 20,
    lineHeight: 25,
    color: colors.text,
    fontWeight: "900"
  },
  secondaryText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted
  },
  scoreText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
    color: colors.primary
  },
  noteText: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.text,
    fontStyle: "italic"
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  progressGrid: {
    gap: spacing.md
  },
  qualityHero: {
    gap: spacing.xs
  },
  qualityScore: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "900",
    color: colors.primary
  },
  qualityScoreLabel: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: colors.clay,
    fontWeight: "800"
  },
  qualityChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  qualityPromptStack: {
    gap: spacing.sm
  },
  qualityPromptCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs
  },
  teamSummaryStack: {
    gap: spacing.md
  },
  teamSummaryCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.subtle
  },
  teamSummaryCardCompact: {
    padding: spacing.md
  },
  teamSummaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm
  },
  teamSummaryHeaderCompact: {
    alignItems: "flex-start"
  },
  teamSummaryName: {
    flex: 1,
    fontSize: 17,
    fontWeight: "900",
    color: colors.text
  },
  teamSummaryMeta: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted
  },
  socialStack: {
    gap: spacing.md
  },
  friendRow: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft
  },
  friendCopy: {
    gap: spacing.xs
  },
  friendName: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.text
  },
  patternWrap: {
    gap: spacing.sm
  },
  patternWrapCompact: {
    minWidth: 440
  },
  patternScrollContent: {
    flexGrow: 1
  },
  patternHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  patternHeaderText: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textSoft,
    fontWeight: "800"
  },
  patternLabelCol: {
    flex: 1.4,
    textAlign: "left"
  },
  patternRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  patternRowLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "800"
  },
  patternCell: {
    flex: 1,
    minHeight: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  patternCellText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "800"
  },
  patternCellTextInverse: {
    color: colors.textInverse
  }
});
