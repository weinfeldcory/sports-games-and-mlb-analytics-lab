import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  currentScoring,
  games,
  owners,
  rounds,
  teams
} from "../src/data.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_PATH = path.join(DATA_DIR, "season-state.json");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeOwners(nextOwners) {
  const ownersList = nextOwners
    .map((owner) => String(owner).trim())
    .filter(Boolean);

  if (!ownersList.length) {
    throw new Error("At least one owner is required.");
  }

  return [...new Set(ownersList)];
}

function sanitizeTeams(nextTeams) {
  const normalizedTeams = nextTeams
    .map((team) => ({
      seed: Number(team.seed),
      name: String(team.name || "").trim(),
      owner: team.owner ? String(team.owner).trim() : null
    }))
    .filter((team) => team.seed && team.name);

  if (!normalizedTeams.length) {
    throw new Error("At least one team is required.");
  }

  return normalizedTeams;
}

function sanitizeScoring(nextScoring) {
  const scoring = {};

  for (const [seed, values] of Object.entries(nextScoring || {})) {
    const normalizedSeed = Number(seed);
    if (!normalizedSeed) continue;
    const normalizedValues = values.map((value) => Number(value || 0));
    if (normalizedValues.length !== rounds.length) {
      throw new Error(`Seed ${seed} must define ${rounds.length} round values.`);
    }
    scoring[normalizedSeed] = normalizedValues;
  }

  if (!Object.keys(scoring).length) {
    throw new Error("Scoring matrix is required.");
  }

  return scoring;
}

function computeCurrentOwner(state) {
  const order = state.draft.order;
  if (!order.length) return null;
  return order[state.draft.currentPickIndex % order.length];
}

function createDraftState(nextOwners = owners) {
  return {
    order: clone(nextOwners),
    snake: true,
    locked: false,
    currentPickNumber: 1,
    currentPickIndex: 0,
    history: []
  };
}

function createInitialState() {
  return {
    season: 2026,
    updatedAt: new Date().toISOString(),
    owners: clone(owners),
    rounds: clone(rounds),
    currentScoring: clone(currentScoring),
    games: clone(games),
    teams: clone(teams),
    draft: createDraftState(owners)
  };
}

function advanceDraft(state) {
  const orderLength = state.draft.order.length;
  if (!orderLength) return;

  state.draft.currentPickNumber += 1;

  if (!state.draft.snake) {
    state.draft.currentPickIndex = (state.draft.currentPickIndex + 1) % orderLength;
    return;
  }

  const roundIndex = Math.floor((state.draft.currentPickNumber - 2) / orderLength);
  const offset = (state.draft.currentPickNumber - 2) % orderLength;
  state.draft.currentPickIndex = roundIndex % 2 === 0 ? offset + 1 : orderLength - offset - 2;

  if (state.draft.currentPickIndex < 0) {
    state.draft.currentPickIndex = 0;
  }
  if (state.draft.currentPickIndex >= orderLength) {
    state.draft.currentPickIndex = orderLength - 1;
  }
}

function rebuildDraftPositionFromHistory(state) {
  state.draft.currentPickNumber = 1;
  state.draft.currentPickIndex = 0;

  for (let index = 0; index < state.draft.history.length; index += 1) {
    advanceDraft(state);
  }
}

async function ensureStoreFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(STORE_PATH, "utf8");
  } catch {
    await writeFile(STORE_PATH, JSON.stringify(createInitialState(), null, 2));
  }
}

export async function readState() {
  await ensureStoreFile();
  const raw = await readFile(STORE_PATH, "utf8");
  const state = JSON.parse(raw);
  if (!state.draft) {
    state.draft = createDraftState(state.owners);
  }
  if (!Array.isArray(state.draft.history)) {
    state.draft.history = [];
  }
  return state;
}

export async function writeState(nextState) {
  const state = {
    ...nextState,
    updatedAt: new Date().toISOString()
  };

  await ensureStoreFile();
  await writeFile(STORE_PATH, JSON.stringify(state, null, 2));
  return state;
}

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
  const initialState = createInitialState();

  if (mode === "sheet") {
    return writeState(initialState);
  }
  if (mode !== "empty") {
    throw new Error(`Unsupported reset mode: ${mode}`);
  }

  initialState.teams = initialState.teams.map((team) => ({
    ...team,
    owner: null
  }));

  return writeState(initialState);
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
  state.teams = teamsList;
  state.currentScoring = scoring;
  state.games = [];
  state.draft = createDraftState(ownersList);

  return writeState(state);
}
