import {
  advanceDraft,
  clone,
  computeCurrentOwner,
  readState,
  resetStateForDraft,
  rebuildDraftPositionFromHistory,
  sanitizeOwners,
  writeState
} from "../store.js";

export async function assignTeam(teamName, owner) {
  const state = await readState();
  const team = state.teams.find((entry) => entry.name === teamName);

  if (!team) throw new Error(`Unknown team: ${teamName}`);
  if (!state.owners.includes(owner)) throw new Error(`Unknown owner: ${owner}`);

  team.owner = owner;
  return writeState(state);
}

export async function draftPick(teamName) {
  const state = await readState();
  const team = state.teams.find((entry) => entry.name === teamName);
  const currentOwner = computeCurrentOwner(state);

  if (state.draft.locked) throw new Error("Draft is locked.");
  if (!team) throw new Error(`Unknown team: ${teamName}`);
  if (!currentOwner) throw new Error("Draft order is empty.");
  if (team.owner) throw new Error(`${teamName} has already been drafted.`);

  team.owner = currentOwner;
  state.draft.history.push({
    pickNumber: state.draft.currentPickNumber,
    teamName,
    owner: currentOwner
  });
  advanceDraft(state);

  return writeState(state);
}

export async function undoDraftPick() {
  const state = await readState();
  const lastPick = state.draft.history.pop();

  if (!lastPick) throw new Error("No draft picks to undo.");

  const team = state.teams.find((entry) => entry.name === lastPick.teamName);
  if (team) {
    team.owner = null;
  }
  rebuildDraftPositionFromHistory(state);

  return writeState(state);
}

export async function unassignTeam(teamName) {
  const state = await readState();
  const team = state.teams.find((entry) => entry.name === teamName);

  if (!team) throw new Error(`Unknown team: ${teamName}`);

  team.owner = null;
  state.draft.history = state.draft.history.filter((entry) => entry.teamName !== teamName);
  rebuildDraftPositionFromHistory(state);

  return writeState(state);
}

export async function resetDraft(mode = "empty") {
  const state = await readState();
  return writeState(resetStateForDraft(state, mode));
}

export async function updateDraftSettings({ order, snake, locked }) {
  const state = await readState();

  if (order) {
    state.owners = sanitizeOwners(order);
    state.draft.order = clone(state.owners);
    const validOwners = new Set(state.owners);
    state.teams = state.teams.map((team) => ({
      ...team,
      owner: validOwners.has(team.owner) ? team.owner : null
    }));
    state.draft.history = state.draft.history.filter((entry) => validOwners.has(entry.owner));
  }
  if (typeof snake === "boolean") {
    state.draft.snake = snake;
  }
  if (typeof locked === "boolean") {
    state.draft.locked = locked;
  }

  rebuildDraftPositionFromHistory(state);
  return writeState(state);
}
