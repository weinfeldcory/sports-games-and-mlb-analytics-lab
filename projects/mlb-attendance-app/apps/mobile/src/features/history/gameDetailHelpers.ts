import type { AttendanceLog, BatterAppearance, Game, PitcherAppearance, Team } from "@mlb-attendance/domain";
import { formatBaseballInnings } from "../../lib/formatters";

export const MEMORY_CHIPS = [
  "Walk-off",
  "First visit",
  "Rivalry game",
  "Playoff game",
  "Great seats",
  "Rain delay",
  "Extra innings",
  "Bobblehead / giveaway"
] as const;

export function applyMemoryChip(currentValue: string, chip: string) {
  const trimmed = currentValue.trim();
  if (!trimmed) {
    return chip;
  }
  if (trimmed.toLowerCase().includes(chip.toLowerCase())) {
    return currentValue;
  }
  return `${trimmed}${trimmed.endsWith(".") ? "" : "."} ${chip}`;
}

export function createDraft(log: AttendanceLog) {
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

export function getStartingPitcher(game: Game, teamId: string) {
  const pitchers = game.pitchersUsed?.filter((pitcher) => pitcher.teamId === teamId) ?? [];
  return pitchers.find((pitcher) => pitcher.role === "starter") ?? [...pitchers].sort((left, right) => (right.inningsPitched ?? 0) - (left.inningsPitched ?? 0))[0];
}

export function getTopHitters(game: Game, teamId: string) {
  const hitters = game.battersUsed?.filter((batter) => batter.teamId === teamId) ?? [];
  return [...hitters]
    .sort((left, right) => {
      if (right.homeRuns !== left.homeRuns) {
        return right.homeRuns - left.homeRuns;
      }
      if (right.hits !== left.hits) {
        return right.hits - left.hits;
      }
      if (right.rbis !== left.rbis) {
        return right.rbis - left.rbis;
      }
      if (right.walks !== left.walks) {
        return right.walks - left.walks;
      }
      return right.atBats - left.atBats;
    })
    .slice(0, 3);
}

export function formatPitcherLine(pitcher: PitcherAppearance | undefined) {
  if (!pitcher) {
    return "No starting pitcher data";
  }

  return `${formatBaseballInnings(pitcher.inningsPitched)} IP • ${pitcher.strikeouts ?? 0} K • ${pitcher.hitsAllowed ?? 0} H • ${pitcher.runsAllowed ?? 0} R`;
}

export function formatHitterLine(hitter: BatterAppearance) {
  const extras = [];
  if (hitter.homeRuns) {
    extras.push(`${hitter.homeRuns} HR`);
  }
  if (hitter.rbis) {
    extras.push(`${hitter.rbis} RBI`);
  }
  if (hitter.walks) {
    extras.push(`${hitter.walks} BB`);
  }

  const statTail = extras.length ? ` • ${extras.join(" • ")}` : "";
  return `${hitter.hits}-${hitter.atBats}${statTail}`;
}

export function getPlayerDataMessage(game: Game) {
  if (game.battersUsed?.length && game.pitchersUsed?.length) {
    return {
      label: "Complete player lines",
      detail: "Top hitters and pitcher usage are attached to this game."
    };
  }

  if (game.battersUsed?.length) {
    return {
      label: "Missing pitcher detail",
      detail: "Hitter lines are attached, but pitcher detail is still being backfilled."
    };
  }

  if (game.pitchersUsed?.length) {
    return {
      label: "Missing hitter detail",
      detail: "Pitcher lines are attached, but hitter detail is still being backfilled."
    };
  }

  return {
    label: "Player data pending",
    detail: "This game saved correctly, but player-level lines are still unavailable."
  };
}

export interface DerivedHistoryMoment {
  key: string;
  tag: "Walk-off" | "Go-ahead HR" | "Dominant start" | "Extra innings" | "Slugfest" | "Memory" | "Multi-HR" | "10+ K" | "One-run game";
  title: string;
  description: string;
  priority: number;
}

function toPitcherGameScore(pitcher: PitcherAppearance | undefined) {
  if (!pitcher || pitcher.role !== "starter") {
    return undefined;
  }
  const inningsPitched = pitcher.inningsPitched ?? 0;
  const wholeInnings = Math.trunc(inningsPitched);
  const partialOuts = Math.round((inningsPitched - wholeInnings) * 10);
  const outsRecorded = wholeInnings * 3 + partialOuts;
  const strikeouts = pitcher.strikeouts ?? 0;
  const walksAllowed = pitcher.walksAllowed ?? 0;
  const hitsAllowed = pitcher.hitsAllowed ?? 0;
  const runsAllowed = pitcher.runsAllowed ?? 0;
  const homeRunsAllowed = pitcher.homeRunsAllowed ?? 0;
  return 40 + 2 * outsRecorded + strikeouts - 2 * walksAllowed - 2 * hitsAllowed - 3 * runsAllowed - 6 * homeRunsAllowed;
}

function getWinningTeam(game: Game, teamsById: Map<string, Team>) {
  if (game.homeScore === game.awayScore) {
    return undefined;
  }
  return game.homeScore > game.awayScore ? teamsById.get(game.homeTeamId) : teamsById.get(game.awayTeamId);
}

export function getDerivedHistoryMoments(log: AttendanceLog, game: Game, teamsById: Map<string, Team>) {
  const moments: DerivedHistoryMoment[] = [];
  const winner = getWinningTeam(game, teamsById);
  const starters = [getStartingPitcher(game, game.awayTeamId), getStartingPitcher(game, game.homeTeamId)].filter(Boolean) as PitcherAppearance[];
  const dominantStarter = [...starters]
    .map((pitcher) => ({ pitcher, gameScore: toPitcherGameScore(pitcher) ?? Number.NEGATIVE_INFINITY }))
    .sort((left, right) => right.gameScore - left.gameScore)[0];
  const strikeoutStarter = [...starters].sort((left, right) => (right.strikeouts ?? 0) - (left.strikeouts ?? 0))[0];
  const multiHomerHitter = [...(game.battersUsed ?? [])]
    .filter((batter) => batter.homeRuns >= 2)
    .sort((left, right) => right.homeRuns - left.homeRuns || right.rbis - left.rbis)[0];
  const runMargin = Math.abs(game.homeScore - game.awayScore);
  const totalRuns = game.homeScore + game.awayScore;

  if (log.memorableMoment?.trim()) {
    moments.push({
      key: `${game.id}:memory`,
      tag: "Memory",
      title: "Your memory",
      description: log.memorableMoment.trim(),
      priority: 100
    });
  }

  if (game.walkOff && winner) {
    moments.push({
      key: `${game.id}:walkoff`,
      tag: "Walk-off",
      title: "Walk-off finish",
      description: `${winner.abbreviation} won it in walk-off fashion, ${game.awayScore}-${game.homeScore}.`,
      priority: 95
    });
  }

  if (dominantStarter && dominantStarter.gameScore >= 70) {
    moments.push({
      key: `${game.id}:dominant-start`,
      tag: "Dominant start",
      title: `${dominantStarter.pitcher.pitcherName} dominated`,
      description: `${formatBaseballInnings(dominantStarter.pitcher.inningsPitched)} IP • ${dominantStarter.pitcher.strikeouts ?? 0} K • Game Score ${dominantStarter.gameScore}.`,
      priority: 90
    });
  }

  if (multiHomerHitter) {
    moments.push({
      key: `${game.id}:multi-hr`,
      tag: "Multi-HR",
      title: `${multiHomerHitter.playerName} went deep twice`,
      description: `${multiHomerHitter.homeRuns} HR and ${multiHomerHitter.rbis} RBI in this one.`,
      priority: 85
    });
  }

  if (strikeoutStarter && (strikeoutStarter.strikeouts ?? 0) >= 10) {
    moments.push({
      key: `${game.id}:ten-k`,
      tag: "10+ K",
      title: "Double-digit strikeouts",
      description: `${strikeoutStarter.pitcherName} punched out ${strikeoutStarter.strikeouts} hitters over ${formatBaseballInnings(strikeoutStarter.inningsPitched)} innings.`,
      priority: 84
    });
  }

  if ((game.innings ?? 0) > 9) {
    moments.push({
      key: `${game.id}:extra-innings`,
      tag: "Extra innings",
      title: "Extra-inning battle",
      description: `This game stretched to ${game.innings} innings before it was decided.`,
      priority: 72
    });
  } else if (runMargin === 1) {
    moments.push({
      key: `${game.id}:one-run`,
      tag: "One-run game",
      title: "One-run finish",
      description: `The final margin was just one run, ${game.awayScore}-${game.homeScore}.`,
      priority: 70
    });
  }

  if (totalRuns >= 10) {
    moments.push({
      key: `${game.id}:slugfest`,
      tag: "Slugfest",
      title: "Slugfest",
      description: `${totalRuns} total runs made this one a loud scoreboard night.`,
      priority: 68
    });
  }

  return moments.sort((left, right) => right.priority - left.priority || left.key.localeCompare(right.key));
}
