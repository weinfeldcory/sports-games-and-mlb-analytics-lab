import type {
  AttendanceLog,
  FavoriteTeamSplit,
  Game,
  PersonalStats,
  PlayerBattingSummary,
  PlayerPitchingSummary,
  PitcherSeenSummary,
  Team,
  TeamSeenSummary,
  UserProfile,
  Venue
} from "../models";

function didTeamWin(game: Game, teamId: string) {
  if (game.homeTeamId === teamId) {
    return game.homeScore > game.awayScore;
  }

  if (game.awayTeamId === teamId) {
    return game.awayScore > game.homeScore;
  }

  return false;
}

function toBattingAverage(hits: number, atBats: number) {
  if (!atBats) {
    return 0;
  }

  return hits / atBats;
}

function toEra(runsAllowed: number, inningsPitched: number) {
  if (!inningsPitched) {
    return 0;
  }

  return (runsAllowed * 9) / inningsPitched;
}

function createFavoriteTeamSplit(
  favoriteTeamId: string | undefined,
  logs: AttendanceLog[],
  gamesById: Map<string, Game>,
  teamsById: Map<string, Team>
): FavoriteTeamSplit | undefined {
  if (!favoriteTeamId) {
    return undefined;
  }

  const relevantLogs = logs.filter((log) => {
    const game = gamesById.get(log.gameId);
    if (!game) {
      return false;
    }

    return game.homeTeamId === favoriteTeamId || game.awayTeamId === favoriteTeamId;
  });

  const wins = relevantLogs.filter((log) => {
    const game = gamesById.get(log.gameId);
    return game ? didTeamWin(game, favoriteTeamId) : false;
  }).length;

  const teamName = teamsById.get(favoriteTeamId)?.name ?? "Favorite Team";

  return {
    teamId: favoriteTeamId,
    teamName,
    gamesAttended: relevantLogs.length,
    wins,
    losses: relevantLogs.length - wins
  };
}

export function calculatePersonalStats(params: {
  user: UserProfile;
  attendanceLogs: AttendanceLog[];
  games: Game[];
  teams: Team[];
  venues: Venue[];
}): PersonalStats {
  const { user, attendanceLogs, games, teams } = params;
  const gamesById = new Map(games.map((game) => [game.id, game]));
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const favoriteTeamSplit = createFavoriteTeamSplit(user.favoriteTeamId, attendanceLogs, gamesById, teamsById);
  const attendedGames = attendanceLogs
    .map((log) => gamesById.get(log.gameId))
    .filter((game): game is Game => Boolean(game));

  const wins = attendanceLogs.filter((log) =>
    log.witnessedEvents.some((event) => event.type === "team_win")
  ).length;
  const losses = attendanceLogs.filter((log) =>
    log.witnessedEvents.some((event) => event.type === "team_loss")
  ).length;
  const totalHitsSeen = attendedGames.reduce((total, game) => total + game.homeHits + game.awayHits, 0);
  const totalRunsSeen = attendedGames.reduce((total, game) => total + game.homeScore + game.awayScore, 0);

  const pitcherMap = attendedGames.reduce<Map<string, PitcherSeenSummary>>((map, game) => {
    game.pitchersUsed?.forEach((pitcher) => {
      const existing = map.get(pitcher.pitcherName);
      const teamName = teamsById.get(pitcher.teamId)?.name ?? pitcher.teamId;

      if (existing) {
        existing.appearances += 1;
        if (!existing.teams.includes(teamName)) {
          existing.teams.push(teamName);
        }
        return;
      }

      map.set(pitcher.pitcherName, {
        pitcherName: pitcher.pitcherName,
        appearances: 1,
        teams: [teamName]
      });
    });
    return map;
  }, new Map());

  const playerPitchingMap = attendedGames.reduce<Map<string, PlayerPitchingSummary>>((map, game) => {
    game.pitchersUsed?.forEach((pitcher) => {
      const existing = map.get(pitcher.pitcherName);
      const teamName = teamsById.get(pitcher.teamId)?.name ?? pitcher.teamId;

      if (existing) {
        existing.appearances += 1;
        existing.strikeoutsSeen += pitcher.strikeouts ?? 0;
        existing.inningsSeen += pitcher.inningsPitched ?? 0;
        existing.hitsAllowedSeen += pitcher.hitsAllowed ?? 0;
        existing.runsAllowedSeen += pitcher.runsAllowed ?? 0;
        existing.eraSeen = toEra(existing.runsAllowedSeen, existing.inningsSeen);
        if (!existing.teams.includes(teamName)) {
          existing.teams.push(teamName);
        }
        return;
      }

      map.set(pitcher.pitcherName, {
        pitcherName: pitcher.pitcherName,
        appearances: 1,
        teams: [teamName],
        strikeoutsSeen: pitcher.strikeouts ?? 0,
        inningsSeen: pitcher.inningsPitched ?? 0,
        hitsAllowedSeen: pitcher.hitsAllowed ?? 0,
        runsAllowedSeen: pitcher.runsAllowed ?? 0,
        eraSeen: toEra(pitcher.runsAllowed ?? 0, pitcher.inningsPitched ?? 0)
      });
    });
    return map;
  }, new Map());

  const playerBattingMap = attendedGames.reduce<Map<string, PlayerBattingSummary>>((map, game) => {
    game.battersUsed?.forEach((batter) => {
      const existing = map.get(batter.playerName);
      const teamName = teamsById.get(batter.teamId)?.name ?? batter.teamId;

      if (existing) {
        existing.gamesSeen += 1;
        existing.atBatsSeen += batter.atBats;
        existing.hitsSeen += batter.hits;
        existing.battingAverageSeen = toBattingAverage(existing.hitsSeen, existing.atBatsSeen);
        existing.homeRunsSeen += batter.homeRuns;
        existing.rbisSeen += batter.rbis;
        existing.strikeoutsSeenAtPlate += batter.strikeouts;
        existing.walksSeen += batter.walks;
        if (!existing.teams.includes(teamName)) {
          existing.teams.push(teamName);
        }
        return;
      }

      map.set(batter.playerName, {
        playerName: batter.playerName,
        teams: [teamName],
        gamesSeen: 1,
        atBatsSeen: batter.atBats,
        hitsSeen: batter.hits,
        battingAverageSeen: toBattingAverage(batter.hits, batter.atBats),
        homeRunsSeen: batter.homeRuns,
        rbisSeen: batter.rbis,
        strikeoutsSeenAtPlate: batter.strikeouts,
        walksSeen: batter.walks
      });
    });
    return map;
  }, new Map());

  const teamSeenMap = attendedGames.reduce<Map<string, TeamSeenSummary>>((map, game) => {
    const homeTeam = teamsById.get(game.homeTeamId);
    const awayTeam = teamsById.get(game.awayTeamId);

    if (homeTeam) {
      const existingHome = map.get(homeTeam.id);
      if (existingHome) {
        existingHome.gamesSeen += 1;
        existingHome.winsSeen += game.homeScore > game.awayScore ? 1 : 0;
        existingHome.lossesSeen += game.homeScore < game.awayScore ? 1 : 0;
        existingHome.hitsSeen += game.homeHits;
        existingHome.runsSeen += game.homeScore;
      } else {
        map.set(homeTeam.id, {
          teamId: homeTeam.id,
          teamName: homeTeam.name,
          gamesSeen: 1,
          winsSeen: game.homeScore > game.awayScore ? 1 : 0,
          lossesSeen: game.homeScore < game.awayScore ? 1 : 0,
          hitsSeen: game.homeHits,
          runsSeen: game.homeScore
        });
      }
    }

    if (awayTeam) {
      const existingAway = map.get(awayTeam.id);
      if (existingAway) {
        existingAway.gamesSeen += 1;
        existingAway.winsSeen += game.awayScore > game.homeScore ? 1 : 0;
        existingAway.lossesSeen += game.awayScore < game.homeScore ? 1 : 0;
        existingAway.hitsSeen += game.awayHits;
        existingAway.runsSeen += game.awayScore;
      } else {
        map.set(awayTeam.id, {
          teamId: awayTeam.id,
          teamName: awayTeam.name,
          gamesSeen: 1,
          winsSeen: game.awayScore > game.homeScore ? 1 : 0,
          lossesSeen: game.awayScore < game.homeScore ? 1 : 0,
          hitsSeen: game.awayHits,
          runsSeen: game.awayScore
        });
      }
    }

    return map;
  }, new Map());

  return {
    totalGamesAttended: attendanceLogs.length,
    wins,
    losses,
    uniqueStadiumsVisited: new Set(attendanceLogs.map((log) => log.venueId)).size,
    uniqueSectionsSatIn: new Set(
      attendanceLogs.map((log) => `${log.venueId}:${log.seat.section.trim().toLowerCase()}`)
    ).size,
    favoriteTeamSplit,
    witnessedHomeRuns: attendanceLogs.reduce((count, log) => {
      return count + log.witnessedEvents.filter((event) => event.type === "home_run").length;
    }, 0),
    totalHitsSeen,
    totalRunsSeen,
    uniquePitchersSeen: pitcherMap.size,
    averageHitsPerGame: attendanceLogs.length ? totalHitsSeen / attendanceLogs.length : 0,
    topPitchersSeen: [...pitcherMap.values()]
      .sort((left, right) => right.appearances - left.appearances || left.pitcherName.localeCompare(right.pitcherName))
      .slice(0, 5),
    playerBattingSummaries: [...playerBattingMap.values()]
      .sort((left, right) => right.homeRunsSeen - left.homeRunsSeen || right.hitsSeen - left.hitsSeen || left.playerName.localeCompare(right.playerName)),
    playerPitchingSummaries: [...playerPitchingMap.values()]
      .sort((left, right) => right.strikeoutsSeen - left.strikeoutsSeen || right.appearances - left.appearances || left.pitcherName.localeCompare(right.pitcherName)),
    teamSeenSummaries: [...teamSeenMap.values()]
      .sort((left, right) => right.gamesSeen - left.gamesSeen || left.teamName.localeCompare(right.teamName)),
    recentMoments: [...attendanceLogs]
      .sort((left, right) => right.attendedOn.localeCompare(left.attendedOn))
      .slice(0, 3)
      .map((log) => {
        const game = gamesById.get(log.gameId);
        const opponentId = game
          ? game.homeTeamId === user.favoriteTeamId
            ? game.awayTeamId
            : game.homeTeamId
          : undefined;
        const opponentName = opponentId ? teamsById.get(opponentId)?.name : undefined;

        return {
          attendanceLogId: log.id,
          title: log.memorableMoment ?? "Memorable game",
          subtitle: opponentName ? `Against ${opponentName} on ${log.attendedOn}` : log.attendedOn
        };
      })
  };
}
