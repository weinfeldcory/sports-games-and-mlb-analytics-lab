import { currentScoring, owners, roundOrder, rounds, seedProbabilities } from "./data.js";

export function teamMap(teams) {
  return new Map(teams.map((team) => [team.name, team]));
}

export function pointsFor(scoring, seed, round) {
  const roundIndex = roundOrder[round];
  if (roundIndex == null || !scoring[seed]) {
    return 0;
  }
  return scoring[seed][roundIndex] ?? 0;
}

export function earnedPointsByTeam(teams, games, scoring = currentScoring) {
  const byName = teamMap(teams);
  const totals = new Map(teams.map((team) => [team.name, 0]));

  for (const game of games) {
    if (!game.winner) continue;
    const winner = byName.get(game.winner);
    if (!winner) continue;
    totals.set(winner.name, totals.get(winner.name) + pointsFor(scoring, winner.seed, game.round));
  }

  return totals;
}

export function standings(teams, games, scoring = currentScoring) {
  const earned = earnedPointsByTeam(teams, games, scoring);
  const ownerTotals = new Map(owners.map((owner) => [owner, 0]));

  for (const team of teams) {
    if (!ownerTotals.has(team.owner)) continue;
    ownerTotals.set(team.owner, ownerTotals.get(team.owner) + earned.get(team.name));
  }

  return owners
    .map((owner) => ({ owner, points: ownerTotals.get(owner) }))
    .sort((a, b) => b.points - a.points);
}

export function unresolvedGames(games) {
  return games.filter((game) => !game.winner);
}

export function remainingOutcomesForGame(game, teams, scoring = currentScoring) {
  const byName = teamMap(teams);
  return [game.topTeam, game.bottomTeam].map((teamName) => {
    const team = byName.get(teamName);
    return {
      team: team.name,
      owner: team.owner,
      seed: team.seed,
      round: game.round,
      points: pointsFor(scoring, team.seed, game.round)
    };
  });
}

export function trueMaxStandings(teams, games, scoring = currentScoring) {
  const current = new Map(standings(teams, games, scoring).map((row) => [row.owner, row.points]));
  const unresolved = unresolvedGames(games);

  for (const game of unresolved) {
    const outcomes = remainingOutcomesForGame(game, teams, scoring);
    for (const owner of owners) {
      const best = Math.max(0, ...outcomes.filter((outcome) => outcome.owner === owner).map((outcome) => outcome.points));
      current.set(owner, current.get(owner) + best);
    }
  }

  return owners
    .map((owner) => ({ owner, max: current.get(owner) }))
    .sort((a, b) => b.max - a.max);
}

export function expectedRemainingByTeam(teams, games, scoring = currentScoring, probabilities = seedProbabilities) {
  const unresolved = unresolvedGames(games);
  const remaining = new Map(teams.map((team) => [team.name, 0]));

  for (const game of unresolved) {
    const outcomes = remainingOutcomesForGame(game, teams, scoring);
    const weights = outcomes.map((outcome) => {
      const probability = probabilities[outcome.seed][roundOrder[outcome.round]] || 0;
      return { ...outcome, probability };
    });
    const totalWeight = weights.reduce((sum, outcome) => sum + outcome.probability, 0) || weights.length;

    for (const outcome of weights) {
      const normalizedProbability = totalWeight === weights.length ? 1 / weights.length : outcome.probability / totalWeight;
      remaining.set(outcome.team, remaining.get(outcome.team) + outcome.points * normalizedProbability);
    }
  }

  return remaining;
}

export function expectedStandings(teams, games, scoring = currentScoring, probabilities = seedProbabilities) {
  const current = new Map(standings(teams, games, scoring).map((row) => [row.owner, row.points]));
  const remaining = expectedRemainingByTeam(teams, games, scoring, probabilities);

  for (const team of teams) {
    if (!current.has(team.owner)) continue;
    current.set(team.owner, current.get(team.owner) + remaining.get(team.name));
  }

  return owners
    .map((owner) => ({ owner, expected: current.get(owner) }))
    .sort((a, b) => b.expected - a.expected);
}

export function teamRows(teams, games, scoring = currentScoring) {
  const earned = earnedPointsByTeam(teams, games, scoring);
  const expectedRemaining = expectedRemainingByTeam(teams, games, scoring);
  const unresolved = unresolvedGames(games);

  return teams.map((team) => {
    const remaining = unresolved
      .filter((game) => game.topTeam === team.name || game.bottomTeam === team.name)
      .reduce((sum, game) => sum + pointsFor(scoring, team.seed, game.round), 0);
    return { ...team, points: earned.get(team.name), remaining, expectedRemaining: expectedRemaining.get(team.name) };
  });
}

export function probabilityBasedScoring(probabilities = seedProbabilities, roundExpectedValues = [0.8, 1.25, 1.8, 2.5, 3.2, 4], cap = 250) {
  const probabilityFloors = [0.01, 0.01, 0.006, 0.004, 0.0025, 0.0015];
  const matrix = {};

  for (let seed = 1; seed <= 16; seed += 1) {
    matrix[seed] = rounds.map((round, index) => {
      const probability = Math.max(probabilities[seed][index] || 0, probabilityFloors[index]);
      return Math.min(cap, Math.max(1, Math.round(roundExpectedValues[index] / probability)));
    });
  }

  return matrix;
}

export function smoothedSeedProbabilities(probabilities = seedProbabilities, probabilityFloors = [0.01, 0.01, 0.006, 0.004, 0.0025, 0.0015]) {
  const matrix = {};

  for (let seed = 1; seed <= 16; seed += 1) {
    matrix[seed] = rounds.map((_, index) => Math.max(probabilities[seed][index] || 0, probabilityFloors[index]));
  }

  return matrix;
}

export function inferredRoundExpectedValues(scoring = currentScoring, probabilities = seedProbabilities) {
  const smoothed = smoothedSeedProbabilities(probabilities);

  return rounds.map((_, index) => {
    const values = Array.from({ length: 16 }, (_, offset) => {
      const seed = offset + 1;
      return scoring[seed][index] * smoothed[seed][index];
    }).sort((a, b) => a - b);

    const median = values.length % 2 === 0
      ? (values[(values.length / 2) - 1] + values[values.length / 2]) / 2
      : values[Math.floor(values.length / 2)];

    const scarcityMultiplier = 2 ** index;
    return median * scarcityMultiplier;
  });
}

export function equalValueScoring(scoring = currentScoring, probabilities = seedProbabilities, cap = Infinity) {
  const smoothed = smoothedSeedProbabilities(probabilities);
  const roundExpectedValues = inferredRoundExpectedValues(scoring, probabilities);
  const matrix = {};

  for (let seed = 1; seed <= 16; seed += 1) {
    matrix[seed] = rounds.map((_, index) => Math.min(cap, Math.max(1, Math.round(roundExpectedValues[index] / smoothed[seed][index]))));
  }

  return matrix;
}

export function constrainedEqualValueScoring(
  scoring = currentScoring,
  probabilities = seedProbabilities,
  options = {}
) {
  const {
    roundMaximums = [12, 24, 60, 120, 240, 500],
    roundMinimums = [1, 2, 4, 7, 12, 20]
  } = options;

  const unconstrained = equalValueScoring(scoring, probabilities, Infinity);
  const matrix = {};

  for (let seed = 1; seed <= 16; seed += 1) {
    let previous = 0;
    matrix[seed] = rounds.map((_, index) => {
      const bounded = Math.max(
        roundMinimums[index],
        Math.min(roundMaximums[index], unconstrained[seed][index])
      );
      const monotonic = Math.max(previous, bounded);
      previous = monotonic;
      return monotonic;
    });
  }

  for (let index = 0; index < rounds.length; index += 1) {
    let previous = matrix[1][index];
    for (let seed = 2; seed <= 16; seed += 1) {
      matrix[seed][index] = Math.max(previous, matrix[seed][index]);
      previous = matrix[seed][index];
    }
  }

  return matrix;
}

export function seedExpectedValueTotals(scoring = currentScoring, probabilities = seedProbabilities) {
  const smoothed = smoothedSeedProbabilities(probabilities);

  return Array.from({ length: 16 }, (_, offset) => {
    const seed = offset + 1;
    const expectedValue = rounds.reduce(
      (sum, _, index) => sum + scoring[seed][index] * smoothed[seed][index],
      0
    );

    return {
      seed,
      expectedValue
    };
  });
}

export function scoringFairnessSummary(scoring = currentScoring, probabilities = seedProbabilities) {
  const rows = seedExpectedValueTotals(scoring, probabilities);
  const values = rows.map((row) => row.expectedValue);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    mean,
    min,
    max,
    spread: max - min,
    coefficientOfVariation: mean === 0 ? 0 : Math.sqrt(variance) / mean
  };
}

export function scoringSummary(current = currentScoring, optimized = probabilityBasedScoring()) {
  return rounds.map((round, index) => {
    const currentOneSeed = current[1][index];
    const currentCinderella = current[12][index];
    const optimizedOneSeed = optimized[1][index];
    const optimizedCinderella = optimized[12][index];

    return {
      round,
      currentOneSeed,
      currentCinderella,
      optimizedOneSeed,
      optimizedCinderella,
      currentRatio: currentOneSeed === 0 ? null : currentCinderella / currentOneSeed,
      optimizedRatio: optimizedOneSeed === 0 ? null : optimizedCinderella / optimizedOneSeed
    };
  });
}

function createSeededRandom(seed = 42) {
  let value = seed >>> 0;
  return function nextRandom() {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ownerWinOdds(
  teams,
  games,
  scoring = currentScoring,
  probabilities = seedProbabilities,
  simulations = 12000,
  seed = 42
) {
  const currentStandings = standings(teams, games, scoring);
  const unresolved = unresolvedGames(games);

  if (!unresolved.length) {
    const maxScore = Math.max(...currentStandings.map((row) => row.points));
    const leaders = currentStandings.filter((row) => row.points === maxScore);
    return currentStandings.map((row) => ({
      owner: row.owner,
      odds: leaders.some((leader) => leader.owner === row.owner) ? 1 / leaders.length : 0
    }));
  }

  const byName = teamMap(teams);
  const ownerWins = new Map(owners.map((owner) => [owner, 0]));
  const random = createSeededRandom(seed);

  for (let simulation = 0; simulation < simulations; simulation += 1) {
    const ownerTotals = new Map(currentStandings.map((row) => [row.owner, row.points]));

    for (const game of unresolved) {
      const top = byName.get(game.topTeam);
      const bottom = byName.get(game.bottomTeam);
      if (!top || !bottom) continue;

      const roundIndex = roundOrder[game.round];
      const topWeight = probabilities[top.seed]?.[roundIndex] ?? 0;
      const bottomWeight = probabilities[bottom.seed]?.[roundIndex] ?? 0;
      const totalWeight = topWeight + bottomWeight || 2;
      const winner = random() < (topWeight || 1) / totalWeight ? top : bottom;

      if (!ownerTotals.has(winner.owner)) continue;
      ownerTotals.set(
        winner.owner,
        ownerTotals.get(winner.owner) + pointsFor(scoring, winner.seed, game.round)
      );
    }

    const bestScore = Math.max(...ownerTotals.values());
    const leaders = [...ownerTotals.entries()].filter(([, score]) => score === bestScore);
    const split = 1 / leaders.length;

    for (const [owner] of leaders) {
      ownerWins.set(owner, ownerWins.get(owner) + split);
    }
  }

  return owners
    .map((owner) => ({
      owner,
      odds: ownerWins.get(owner) / simulations
    }))
    .sort((a, b) => b.odds - a.odds);
}

export function ownerWinningPaths(
  teams,
  games,
  scoring = currentScoring,
  probabilities = seedProbabilities,
  simulations = 12000,
  seed = 42
) {
  const currentStandings = standings(teams, games, scoring);
  const currentByOwner = new Map(currentStandings.map((row) => [row.owner, row.points]));
  const unresolved = unresolvedGames(games);

  if (!unresolved.length) {
    const maxScore = Math.max(...currentStandings.map((row) => row.points));
    return currentStandings.map((row) => ({
      owner: row.owner,
      odds: row.points === maxScore ? 1 : 0,
      currentPoints: row.points,
      pointsBehind: maxScore - row.points,
      averageWinningScore: row.points,
      mustHave: [],
      favorable: [],
      avoid: [],
      summary: row.points === maxScore ? "Already in first. No remaining games can change the result." : "Eliminated. No remaining games can create a win path."
    }));
  }

  const byName = teamMap(teams);
  const random = createSeededRandom(seed);
  const ownerWins = new Map(owners.map((owner) => [owner, 0]));
  const winningScoreTotals = new Map(owners.map((owner) => [owner, 0]));
  const gameOutcomeCounts = new Map();
  const baselineOutcomeCounts = new Map();

  for (const game of unresolved) {
    gameOutcomeCounts.set(game.id, new Map(owners.map((owner) => [owner, new Map()])));
    baselineOutcomeCounts.set(game.id, new Map());
  }

  for (let simulation = 0; simulation < simulations; simulation += 1) {
    const ownerTotals = new Map(currentStandings.map((row) => [row.owner, row.points]));
    const simulatedOutcomes = [];

    for (const game of unresolved) {
      const top = byName.get(game.topTeam);
      const bottom = byName.get(game.bottomTeam);
      if (!top || !bottom) continue;

      const roundIndex = roundOrder[game.round];
      const topWeight = probabilities[top.seed]?.[roundIndex] ?? 0;
      const bottomWeight = probabilities[bottom.seed]?.[roundIndex] ?? 0;
      const totalWeight = topWeight + bottomWeight || 2;
      const topProbability = totalWeight === 2 ? 0.5 : (topWeight || 1) / totalWeight;
      const winner = random() < topProbability ? top : bottom;

      simulatedOutcomes.push({
        game,
        winnerName: winner.name
      });

      const baselineByWinner = baselineOutcomeCounts.get(game.id);
      baselineByWinner.set(winner.name, (baselineByWinner.get(winner.name) ?? 0) + 1);

      if (!ownerTotals.has(winner.owner)) continue;
      ownerTotals.set(
        winner.owner,
        ownerTotals.get(winner.owner) + pointsFor(scoring, winner.seed, game.round)
      );
    }

    const bestScore = Math.max(...ownerTotals.values());
    const leaders = [...ownerTotals.entries()].filter(([, score]) => score === bestScore);
    const split = 1 / leaders.length;

    for (const [owner] of leaders) {
      ownerWins.set(owner, ownerWins.get(owner) + split);
      winningScoreTotals.set(owner, winningScoreTotals.get(owner) + (bestScore * split));

      for (const outcome of simulatedOutcomes) {
        const ownerOutcomeCounts = gameOutcomeCounts.get(outcome.game.id).get(owner);
        ownerOutcomeCounts.set(
          outcome.winnerName,
          (ownerOutcomeCounts.get(outcome.winnerName) ?? 0) + split
        );
      }
    }
  }

  const leaderScore = Math.max(...currentStandings.map((row) => row.points));

  return owners.map((owner) => {
    const wins = ownerWins.get(owner);
    const odds = wins / simulations;
    const currentPoints = currentByOwner.get(owner) ?? 0;
    const averageWinningScore = wins ? winningScoreTotals.get(owner) / wins : null;
    const outcomeRows = unresolved.flatMap((game) => {
      const top = byName.get(game.topTeam);
      const bottom = byName.get(game.bottomTeam);
      if (!top || !bottom) return [];

      return [top, bottom].map((team) => {
        const baselineProbability = (baselineOutcomeCounts.get(game.id).get(team.name) ?? 0) / simulations;
        const ownerConditional = wins
          ? (gameOutcomeCounts.get(game.id).get(owner).get(team.name) ?? 0) / wins
          : 0;

        return {
          gameId: game.id,
          round: game.round,
          matchup: `${game.topTeam} vs ${game.bottomTeam}`,
          team: team.name,
          teamOwner: team.owner,
          points: pointsFor(scoring, team.seed, game.round),
          baselineProbability,
          conditionalProbability: ownerConditional,
          lift: ownerConditional - baselineProbability
        };
      });
    });

    const mustHave = outcomeRows
      .filter((row) => row.conditionalProbability >= 0.82 && row.lift > 0.12)
      .sort((a, b) => b.conditionalProbability - a.conditionalProbability || b.lift - a.lift)
      .slice(0, 3);

    const favorable = outcomeRows
      .filter((row) => row.lift > 0.08)
      .sort((a, b) => b.lift - a.lift || b.conditionalProbability - a.conditionalProbability)
      .slice(0, 3);

    const avoid = outcomeRows
      .filter((row) => row.lift < -0.08)
      .sort((a, b) => a.lift - b.lift || a.conditionalProbability - b.conditionalProbability)
      .slice(0, 2);

    let summary = "No meaningful winning path remains.";
    if (odds >= 0.999) {
      summary = "Effectively clinched. Remaining results do not materially change first place.";
    } else if (odds > 0) {
      const summaryParts = [];
      if (mustHave.length) {
        summaryParts.push(`Usually needs ${mustHave.map((row) => row.team).join(", ")}`);
      }
      if (avoid.length) {
        summaryParts.push(`usually avoids ${avoid.map((row) => row.team).join(", ")}`);
      }
      if (!summaryParts.length && favorable.length) {
        summaryParts.push(`best path runs through ${favorable.map((row) => row.team).join(", ")}`);
      }
      summary = `${summaryParts.join(" and ")}.`;
    }

    return {
      owner,
      odds,
      currentPoints,
      pointsBehind: leaderScore - currentPoints,
      averageWinningScore,
      mustHave,
      favorable,
      avoid,
      summary
    };
  }).sort((a, b) => b.odds - a.odds);
}
