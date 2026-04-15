import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { draftPick, resetDraft, undoDraftPick, updateDraftSettings } from "../server/services/draft.js";
import { loadSeasonState, updateSeasonConfig } from "../server/services/seasons.js";
import { createFixtureState } from "./fixtures/season-fixtures.mjs";

async function withTempStore(run) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mmg-store-"));
  const storePath = path.join(tempDir, "season-state.json");
  process.env.SEASON_STATE_PATH = storePath;

  try {
    return await run(storePath);
  } finally {
    delete process.env.SEASON_STATE_PATH;
  }
}

await withTempStore(async (storePath) => {
  const fixtureState = createFixtureState();
  await writeFile(storePath, JSON.stringify(fixtureState, null, 2));

  const emptied = await resetDraft("empty");
  assert.equal(emptied.season, fixtureState.season);
  assert.deepEqual(emptied.games, fixtureState.games);
  assert.deepEqual(emptied.baselineTeams, fixtureState.baselineTeams);
  assert.ok(emptied.teams.every((team) => team.owner === null));
  assert.deepEqual(emptied.draft, {
    order: fixtureState.owners,
    snake: true,
    locked: false,
    currentPickNumber: 1,
    currentPickIndex: 0,
    history: []
  });

  const restored = await resetDraft("sheet");
  assert.deepEqual(restored.teams, fixtureState.baselineTeams);
  assert.deepEqual(restored.baselineTeams, fixtureState.baselineTeams);

  const configured = await updateSeasonConfig({
    season: 2032,
    owners: ["Jordan", "Taylor"],
    teams: [
      { seed: 1, name: "Orcas", owner: "Jordan" },
      { seed: 2, name: "Bears", owner: "Taylor" }
    ],
    currentScoring: {
      1: [1, 2, 3, 4, 5, 6],
      2: [2, 3, 4, 5, 6, 7]
    }
  });

  assert.equal(configured.season, 2032);
  assert.deepEqual(configured.owners, ["Jordan", "Taylor"]);
  assert.deepEqual(configured.teams, configured.baselineTeams);
  assert.deepEqual(configured.games, []);
  assert.equal(configured.draft.currentPickNumber, 1);
  assert.equal(configured.draft.currentPickIndex, 0);
  assert.deepEqual(configured.draft.history, []);

  await resetDraft("empty");
  await updateDraftSettings({ order: ["Taylor", "Jordan"], snake: false, locked: false });
  const drafted = await draftPick("Bears");
  assert.equal(drafted.teams.find((team) => team.name === "Bears")?.owner, "Taylor");
  assert.equal(drafted.draft.currentPickNumber, 2);
  assert.equal(drafted.draft.currentPickIndex, 1);
  assert.equal(drafted.draft.history.length, 1);

  const afterUndo = await undoDraftPick();
  assert.equal(afterUndo.teams.find((team) => team.name === "Bears")?.owner, null);
  assert.equal(afterUndo.draft.currentPickNumber, 1);
  assert.equal(afterUndo.draft.currentPickIndex, 0);
  assert.deepEqual(afterUndo.draft.history, []);

  const persisted = JSON.parse(await readFile(storePath, "utf8"));
  assert.equal(persisted.season, 2032);
  assert.ok(Array.isArray(persisted.baselineTeams));
});

const loadedState = await withTempStore(async (storePath) => {
  const fixtureState = createFixtureState();
  delete fixtureState.baselineTeams;
  await writeFile(storePath, JSON.stringify(fixtureState, null, 2));
  return loadSeasonState();
});

assert.deepEqual(loadedState.baselineTeams, loadedState.teams);

console.log("server service tests passed");
