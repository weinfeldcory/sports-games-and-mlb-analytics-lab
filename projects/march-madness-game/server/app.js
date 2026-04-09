import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  expectedStandings,
  ownerWinningPaths,
  ownerWinOdds,
  standings,
  teamRows,
  trueMaxStandings,
  unresolvedGames
} from "../src/scoring.js";
import {
  assignTeam,
  draftPick,
  readState,
  resetDraft,
  unassignTeam,
  undoDraftPick,
  updateDraftSettings,
  updateSeasonConfig
} from "./store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, "..");
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function notFound(response) {
  json(response, 404, { error: "Not found" });
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function summarizeState(state) {
  const current = standings(state.teams, state.games, state.currentScoring);
  const max = trueMaxStandings(state.teams, state.games, state.currentScoring);
  const expected = expectedStandings(state.teams, state.games, state.currentScoring);
  const odds = ownerWinOdds(state.teams, state.games, state.currentScoring);
  const paths = ownerWinningPaths(state.teams, state.games, state.currentScoring);
  const maxByOwner = new Map(max.map((row) => [row.owner, row.max]));
  const expectedByOwner = new Map(expected.map((row) => [row.owner, row.expected]));
  const oddsByOwner = new Map(odds.map((row) => [row.owner, row.odds]));

  return {
    season: state.season,
    updatedAt: state.updatedAt,
    owners: state.owners,
    rounds: state.rounds,
    currentScoring: state.currentScoring,
    teams: state.teams,
    games: state.games,
    draft: {
      ...state.draft,
      currentOwner: state.draft.order[state.draft.currentPickIndex] ?? null
    },
    standings: current.map((row, index) => ({
      owner: row.owner,
      points: row.points,
      max: maxByOwner.get(row.owner),
      expected: expectedByOwner.get(row.owner),
      winOdds: oddsByOwner.get(row.owner) ?? 0,
      place: index + 1
    })),
    paths,
    teamRows: teamRows(state.teams, state.games, state.currentScoring),
    unresolvedGames: unresolvedGames(state.games)
  };
}

async function serveFile(response, urlPathname) {
  const normalizedPath = urlPathname === "/" ? "/index.html" : urlPathname;
  const filePath = path.join(ROOT_DIR, normalizedPath);
  const extension = path.extname(filePath);

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream"
    });
    response.end(file);
  } catch {
    notFound(response);
  }
}

async function handleApi(request, response, pathname) {
  try {
    if (request.method === "GET" && pathname === "/api/health") {
      return json(response, 200, { ok: true });
    }

    if (request.method === "GET" && pathname === "/api/state") {
      const state = await readState();
      return json(response, 200, summarizeState(state));
    }

    if (request.method === "POST" && pathname === "/api/draft/assign") {
      const body = await readBody(request);
      const state = await assignTeam(body.teamName, body.owner);
      return json(response, 200, summarizeState(state));
    }

    if (request.method === "POST" && pathname === "/api/draft/pick") {
      const body = await readBody(request);
      const state = await draftPick(body.teamName);
      return json(response, 200, summarizeState(state));
    }

    if (request.method === "POST" && pathname === "/api/draft/unassign") {
      const body = await readBody(request);
      const state = await unassignTeam(body.teamName);
      return json(response, 200, summarizeState(state));
    }

    if (request.method === "POST" && pathname === "/api/draft/reset") {
      const body = await readBody(request);
      const state = await resetDraft(body.mode);
      return json(response, 200, summarizeState(state));
    }

    if (request.method === "POST" && pathname === "/api/draft/undo") {
      const state = await undoDraftPick();
      return json(response, 200, summarizeState(state));
    }

    if (request.method === "POST" && pathname === "/api/draft/settings") {
      const body = await readBody(request);
      const state = await updateDraftSettings(body);
      return json(response, 200, summarizeState(state));
    }

    if (request.method === "POST" && pathname === "/api/season/config") {
      const body = await readBody(request);
      const state = await updateSeasonConfig(body);
      return json(response, 200, summarizeState(state));
    }

    return notFound(response);
  } catch (error) {
    return json(response, 400, { error: error.message });
  }
}

export function createAppServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, response, url.pathname);
    }

    return serveFile(response, url.pathname);
  });
}
