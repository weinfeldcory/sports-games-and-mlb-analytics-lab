import { currentScoring as fallbackScoring, games as fallbackGames, owners as fallbackOwners, teams as fallbackTeams } from "./data.js";

const SHEET_ID = "1a6n9EzyMieM6PQz4G40BW_GEmITMk1nYd5XTILroLC8";
const GIDS = {
  draftboard: 1459338582,
  scoreboard: 0,
  liveGameData: 1795896697
};

const GVIZ_BASE_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`;

function parseGvizResponse(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Unexpected Google Sheets response.");
  }

  return JSON.parse(text.slice(start, end + 1));
}

function cellValue(cell) {
  if (!cell) return null;
  if ("v" in cell) return cell.v;
  return null;
}

async function fetchSheetRange(gid, range) {
  const url = new URL(GVIZ_BASE_URL);
  url.searchParams.set("gid", String(gid));
  url.searchParams.set("range", range);
  url.searchParams.set("tqx", "out:json");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Sheets request failed: ${response.status}`);
  }

  const payload = parseGvizResponse(await response.text());
  return (payload.table.rows || []).map((row) => (row.c || []).map(cellValue));
}

function normalizeOwnerSummary(rows) {
  return rows
    .map((row) => ({
      owner: row[0],
      points: Number(row[2] || 0),
      max: Number(row[4] || 0),
      projected: row[6] == null || row[6] === "" ? null : Number(row[6]),
      place: row[7] == null || row[7] === "" ? null : Number(row[7]),
      liveOdds: row[8] ?? null
    }))
    .filter((row) => row.owner);
}

function normalizeScoring(rows) {
  const scoring = {};

  for (const row of rows) {
    const seed = Number(row[0]);
    const round = row[1];
    const points = Number(row[3] || 0);

    if (!seed || !round) continue;
    if (!scoring[seed]) scoring[seed] = [];
    scoring[seed].push(points);
  }

  return scoring;
}

function normalizeTeams(rows) {
  return rows
    .map((row) => ({
      seed: Number(row[0]),
      name: row[1],
      owner: row[2]
    }))
    .filter((row) => row.seed && row.name && row.owner);
}

function normalizeGames(rows) {
  return rows
    .map((row) => ({
      id: Number(row[0]),
      status: row[2] || "",
      topTeam: row[3],
      bottomTeam: row[4],
      topSeed: Number(row[5] || 0),
      bottomSeed: Number(row[6] || 0),
      topScore: row[7] == null || row[7] === "" ? null : Number(row[7]),
      bottomScore: row[8] == null || row[8] === "" ? null : Number(row[8]),
      winningTeam: row[9] || null,
      gameState: String(row[25] || "").toLowerCase(),
      round: row[26] || null,
      pointsForWinner: row[27] == null || row[27] === "" ? null : Number(row[27])
    }))
    .filter((row) => row.topTeam && row.bottomTeam && row.round)
    .sort((a, b) => a.id - b.id)
    .map((row) => ({
      ...row,
      winner: row.gameState === "final" ? row.winningTeam : null
    }));
}

export async function loadLiveAppData() {
  try {
    const [teamRows, gameRows, scoringRows, summaryRows] = await Promise.all([
      fetchSheetRange(GIDS.draftboard, "A2:C80"),
      fetchSheetRange(GIDS.liveGameData, "A2:AB120"),
      fetchSheetRange(GIDS.scoreboard, "A10:D120"),
      fetchSheetRange(GIDS.scoreboard, "B3:J6")
    ]);

    const teams = normalizeTeams(teamRows);
    const games = normalizeGames(gameRows);
    const currentScoring = normalizeScoring(scoringRows);
    const summary = normalizeOwnerSummary(summaryRows);
    const owners = summary.map((row) => row.owner);

    if (!teams.length || !games.length || !owners.length) {
      throw new Error("Sheet data was incomplete.");
    }

    return {
      owners,
      teams,
      games,
      currentScoring,
      summary,
      source: "live"
    };
  } catch (error) {
    console.error("Falling back to local March Madness snapshot.", error);
    return {
      owners: fallbackOwners,
      teams: fallbackTeams,
      games: fallbackGames,
      currentScoring: fallbackScoring,
      summary: null,
      source: "fallback"
    };
  }
}
