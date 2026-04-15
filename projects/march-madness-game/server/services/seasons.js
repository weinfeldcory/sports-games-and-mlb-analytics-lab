import {
  createDraftState,
  readState,
  sanitizeOwners,
  sanitizeScoring,
  sanitizeTeams,
  writeState
} from "../store.js";

export async function loadSeasonState() {
  return readState();
}

export async function updateSeasonConfig({ season, owners: nextOwners, teams: nextTeams, currentScoring: nextScoring }) {
  const state = await readState();

  if (!Number.isInteger(Number(season))) {
    throw new Error("Season must be a year.");
  }

  const ownersList = sanitizeOwners(nextOwners);
  const teamsList = sanitizeTeams(nextTeams);
  const scoring = sanitizeScoring(nextScoring);
  const ownerSet = new Set(ownersList);

  for (const team of teamsList) {
    if (team.owner && !ownerSet.has(team.owner)) {
      throw new Error(`Unknown owner on team ${team.name}: ${team.owner}`);
    }
  }

  state.season = Number(season);
  state.owners = ownersList;
  state.baselineTeams = teamsList.map((team) => ({ ...team }));
  state.teams = teamsList;
  state.currentScoring = scoring;
  state.games = [];
  state.draft = createDraftState(ownersList);

  return writeState(state);
}
