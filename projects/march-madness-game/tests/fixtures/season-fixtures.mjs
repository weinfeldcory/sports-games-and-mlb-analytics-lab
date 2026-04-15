export function createFixtureScoring() {
  return {
    1: [1, 2, 3, 4, 5, 6],
    2: [2, 3, 4, 5, 6, 7]
  };
}

export function createFixtureTeams() {
  return [
    { seed: 1, name: "Alpha", owner: "Alex" },
    { seed: 2, name: "Beta", owner: "Blair" },
    { seed: 1, name: "Gamma", owner: "Casey" },
    { seed: 2, name: "Delta", owner: null }
  ];
}

export function createFixtureGames() {
  return [
    { topTeam: "Alpha", bottomTeam: "Delta", winner: "Alpha", round: "Round of 32 Appearance" }
  ];
}

export function createFixtureState() {
  const owners = ["Alex", "Blair", "Casey"];
  const teams = createFixtureTeams();

  return {
    season: 2031,
    updatedAt: "2031-03-01T12:00:00.000Z",
    owners,
    rounds: [
      "Round of 32 Appearance",
      "Sweet 16 Appearance",
      "Elite 8 Appearance",
      "Final Four Appearance",
      "Championship Appearance",
      "Champion"
    ],
    currentScoring: createFixtureScoring(),
    games: createFixtureGames(),
    baselineTeams: teams.map((team) => ({ ...team })),
    teams: teams.map((team) => ({ ...team })),
    draft: {
      order: owners,
      snake: true,
      locked: false,
      currentPickNumber: 3,
      currentPickIndex: 2,
      history: [
        { pickNumber: 1, teamName: "Alpha", owner: "Alex" },
        { pickNumber: 2, teamName: "Beta", owner: "Blair" }
      ]
    }
  };
}
