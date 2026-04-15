export function teamsToText(teams) {
  return teams
    .slice()
    .sort((a, b) => a.seed - b.seed || a.name.localeCompare(b.name))
    .map((team) => `${team.seed}, ${team.name}`)
    .join("\n");
}

export function scoringToText(currentScoring) {
  return JSON.stringify(currentScoring, null, 2);
}

export function parseTeamsText(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [seed, ...rest] = line.split(",");
      return {
        seed: Number(seed.trim()),
        name: rest.join(",").trim(),
        owner: null
      };
    });
}

export function createUiState(appData) {
  return {
    manualOwner: appData.draft.currentOwner || appData.owners[0] || "",
    activeWorkspace: "paths",
    setupMessage: "",
    setupError: "",
    savingSetup: false
  };
}

export function draftStats(appData) {
  const totalTeams = appData.teams.length;
  const draftedTeams = appData.teams.filter((team) => team.owner).length;
  return {
    totalTeams,
    draftedTeams,
    availableTeams: totalTeams - draftedTeams
  };
}
