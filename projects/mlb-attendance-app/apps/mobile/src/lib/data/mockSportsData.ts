import rawGameLogs from "./userGameLogs.json";
import rawCatalogGames from "./mlbGameCatalog.json";
import type { AttendanceLog, BatterAppearance, FriendProfile, Game, InningLineScore, PitcherAppearance, Team, UserProfile, Venue } from "@mlb-attendance/domain";

interface RawGameLog {
  date: string;
  gameDate?: string;
  gamePk: number;
  homeTeam: {
    id: number;
    name: string;
  };
  awayTeam: {
    id: number;
    name: string;
  };
  homeScore: number;
  awayScore: number;
  homeHits: number;
  awayHits: number;
  homeErrors?: number;
  awayErrors?: number;
  lineScore?: Array<{
    inning: number;
    homeRuns: number;
    awayRuns: number;
  }>;
  venue: {
    id: number;
    name: string;
  };
  pitchers: Array<{
    teamId: string;
    pitcherName: string;
    inningsPitched: string;
    hitsAllowed: number;
    runsAllowed: number;
    strikeouts: number;
  }>;
  batters: Array<{
    teamId: string;
    playerName: string;
    position?: string;
    atBats: number;
    hits: number;
    homeRuns: number;
    rbis: number;
    strikeouts: number;
    walks: number;
  }>;
}

type RawCatalogGame = RawGameLog;

const METS_TEAM_ID = "team_nym";

const TEAM_METADATA: Record<number, { city: string; name: string; abbreviation: string }> = {
  108: { city: "Los Angeles", name: "Angels", abbreviation: "LAA" },
  109: { city: "Arizona", name: "Diamondbacks", abbreviation: "ARI" },
  110: { city: "Baltimore", name: "Orioles", abbreviation: "BAL" },
  111: { city: "Boston", name: "Red Sox", abbreviation: "BOS" },
  112: { city: "Chicago", name: "Cubs", abbreviation: "CHC" },
  113: { city: "Cincinnati", name: "Reds", abbreviation: "CIN" },
  114: { city: "Cleveland", name: "Guardians", abbreviation: "CLE" },
  115: { city: "Colorado", name: "Rockies", abbreviation: "COL" },
  116: { city: "Detroit", name: "Tigers", abbreviation: "DET" },
  117: { city: "Houston", name: "Astros", abbreviation: "HOU" },
  118: { city: "Kansas City", name: "Royals", abbreviation: "KC" },
  119: { city: "Los Angeles", name: "Dodgers", abbreviation: "LAD" },
  120: { city: "Washington", name: "Nationals", abbreviation: "WSH" },
  121: { city: "New York", name: "Mets", abbreviation: "NYM" },
  133: { city: "Oakland", name: "Athletics", abbreviation: "OAK" },
  134: { city: "Pittsburgh", name: "Pirates", abbreviation: "PIT" },
  135: { city: "San Diego", name: "Padres", abbreviation: "SD" },
  136: { city: "Seattle", name: "Mariners", abbreviation: "SEA" },
  137: { city: "San Francisco", name: "Giants", abbreviation: "SF" },
  138: { city: "St. Louis", name: "Cardinals", abbreviation: "STL" },
  139: { city: "Tampa Bay", name: "Rays", abbreviation: "TB" },
  140: { city: "Texas", name: "Rangers", abbreviation: "TEX" },
  141: { city: "Toronto", name: "Blue Jays", abbreviation: "TOR" },
  142: { city: "Minnesota", name: "Twins", abbreviation: "MIN" },
  143: { city: "Philadelphia", name: "Phillies", abbreviation: "PHI" },
  144: { city: "Atlanta", name: "Braves", abbreviation: "ATL" },
  145: { city: "Chicago", name: "White Sox", abbreviation: "CWS" },
  146: { city: "Miami", name: "Marlins", abbreviation: "MIA" },
  147: { city: "New York", name: "Yankees", abbreviation: "NYY" },
  158: { city: "Milwaukee", name: "Brewers", abbreviation: "MIL" }
};

const VENUE_METADATA: Record<number, { city: string; state: string }> = {
  3289: { city: "Queens", state: "NY" },
  3313: { city: "Bronx", state: "NY" },
  3309: { city: "Washington", state: "DC" },
  2871: { city: "Birmingham", state: "AL" }
};

const SPECIAL_NOTES_BY_DATE: Record<string, string> = {
  "2024-10-08": "NLDS Game 3",
  "2024-10-09": "NLDS Game 4",
  "2024-10-16": "NLCS Game 3"
};

function toTeamId(mlbTeamId: number) {
  const team = TEAM_METADATA[mlbTeamId];
  if (!team) {
    return `team_${mlbTeamId}`;
  }
  return `team_${team.abbreviation.toLowerCase()}`;
}

function toVenueId(mlbVenueId: number) {
  return `venue_${mlbVenueId}`;
}

function inningsToNumber(value: string) {
  const [whole, remainder] = value.split(".");
  const base = Number(whole);
  if (!remainder) {
    return base;
  }

  return base + Number(remainder) / 3;
}

function getPitcherRole(pitcher: RawGameLog["pitchers"][number], pitchersOnTeam: RawGameLog["pitchers"]) {
  const sortedByWorkload = [...pitchersOnTeam].sort(
    (left, right) => inningsToNumber(right.inningsPitched) - inningsToNumber(left.inningsPitched)
  );

  if (sortedByWorkload[0]?.pitcherName === pitcher.pitcherName) {
    return "starter";
  }

  if (pitchersOnTeam[pitchersOnTeam.length - 1]?.pitcherName === pitcher.pitcherName) {
    return "closer";
  }

  return "reliever";
}

function buildPitchers(game: RawGameLog): PitcherAppearance[] {
  return game.pitchers.map((pitcher) => {
    const pitchersOnTeam = game.pitchers.filter((candidate) => candidate.teamId === pitcher.teamId);

    return {
      teamId: toTeamId(Number(pitcher.teamId)),
      pitcherName: pitcher.pitcherName,
      role: getPitcherRole(pitcher, pitchersOnTeam),
      inningsPitched: inningsToNumber(pitcher.inningsPitched),
      hitsAllowed: pitcher.hitsAllowed,
      runsAllowed: pitcher.runsAllowed,
      strikeouts: pitcher.strikeouts
    };
  });
}

function buildBatters(game: RawGameLog): BatterAppearance[] {
  return game.batters.map((batter) => ({
    teamId: toTeamId(Number(batter.teamId)),
    playerName: batter.playerName,
    position: batter.position,
    atBats: batter.atBats,
    hits: batter.hits,
    homeRuns: batter.homeRuns,
    rbis: batter.rbis,
    strikeouts: batter.strikeouts,
    walks: batter.walks
  }));
}

function buildLineScore(game: RawGameLog): InningLineScore[] | undefined {
  if (!game.lineScore?.length) {
    return undefined;
  }

  return game.lineScore.map((inning) => ({
    inning: inning.inning,
    homeRuns: inning.homeRuns,
    awayRuns: inning.awayRuns
  }));
}

function buildWalkOff(lineScore: InningLineScore[] | undefined, homeScore: number, awayScore: number) {
  if (!lineScore?.length || homeScore <= awayScore) {
    return false;
  }

  const finalInning = lineScore[lineScore.length - 1];
  if (!finalInning || finalInning.homeRuns <= 0) {
    return false;
  }

  const homeBeforeFinal = lineScore
    .slice(0, -1)
    .reduce((total, inning) => total + inning.homeRuns, 0);
  const awayThroughFinal = lineScore
    .reduce((total, inning) => total + inning.awayRuns, 0);

  return homeBeforeFinal < awayThroughFinal;
}

function buildWitnessedEvents(game: Game): AttendanceLog["witnessedEvents"] {
  const events: AttendanceLog["witnessedEvents"] = [];
  const metsWereHome = game.homeTeamId === METS_TEAM_ID;
  const metsWereAway = game.awayTeamId === METS_TEAM_ID;

  if (metsWereHome || metsWereAway) {
    const metsWon = metsWereHome ? game.homeScore > game.awayScore : game.awayScore > game.homeScore;
    events.push({
      id: `${game.id}_favorite_result`,
      attendanceLogId: `${game.id}_attendance`,
      type: metsWon ? "team_win" : "team_loss",
      label: metsWon ? "Mets win" : "Mets loss",
      teamId: METS_TEAM_ID
    });

    const metsRuns = metsWereHome ? game.homeScore : game.awayScore;
    const opponentRuns = metsWereHome ? game.awayScore : game.homeScore;
    if (metsRuns > 0 && opponentRuns === 0) {
      events.push({
        id: `${game.id}_shutout`,
        attendanceLogId: `${game.id}_attendance`,
        type: "shutout",
        label: "Mets shutout",
        teamId: METS_TEAM_ID
      });
    }
  }

  return events;
}

function buildAttendanceLog(game: Game): AttendanceLog {
  const note = SPECIAL_NOTES_BY_DATE[game.startDate];

  return {
    id: `${game.id}_attendance`,
    userId: "user_1",
    gameId: game.id,
    venueId: game.venueId,
    attendedOn: game.startDate,
    seat: {
      section: "To log"
    },
    witnessedEvents: buildWitnessedEvents(game),
    memorableMoment: note ? `${note} in person.` : undefined
  };
}

function buildFriendAttendanceLog(params: {
  friendId: string;
  game: Game;
  note: string;
  section: string;
}): AttendanceLog {
  return {
    id: `${params.game.id}_${params.friendId}`,
    userId: params.friendId,
    gameId: params.game.id,
    venueId: params.game.venueId,
    attendedOn: params.game.startDate,
    seat: {
      section: params.section
    },
    witnessedEvents: [],
    memorableMoment: params.note
  };
}

const userGameLogs = rawGameLogs as RawGameLog[];
const catalogGameLogs = rawCatalogGames as RawCatalogGame[];

export const mockUser: UserProfile = {
  id: "user_1",
  displayName: "Cory",
  favoriteTeamId: METS_TEAM_ID,
  followingIds: ["friend_ava", "friend_miles"]
};

export const friends: FriendProfile[] = [
  {
    id: "friend_ava",
    displayName: "Ava",
    favoriteTeamId: "team_phi",
    bio: "Postseason chaser who keeps a book scorecard every October.",
    homeCity: "Philadelphia"
  },
  {
    id: "friend_miles",
    displayName: "Miles",
    favoriteTeamId: "team_nyy",
    bio: "Mostly tracks pitching matchups and how deep starters go.",
    homeCity: "Bronx"
  },
  {
    id: "friend_jules",
    displayName: "Jules",
    favoriteTeamId: METS_TEAM_ID,
    bio: "Road-trips for rivalry games and weird neutral-site baseball.",
    homeCity: "Queens"
  }
];

export const teams: Team[] = Object.entries(TEAM_METADATA).map(([mlbId, team]) => ({
  id: toTeamId(Number(mlbId)),
  sport: "MLB",
  city: team.city,
  name: team.name,
  abbreviation: team.abbreviation
}));

export const venues: Venue[] = Object.entries(
  [...catalogGameLogs, ...userGameLogs].reduce<Record<number, { id: number; name: string }>>((map, game) => {
    map[game.venue.id] = {
      id: game.venue.id,
      name: game.venue.name
    };
    return map;
  }, {})
).map(([venueId, venue]) => ({
  id: toVenueId(Number(venueId)),
  name: venue.name,
  city: VENUE_METADATA[Number(venueId)]?.city ?? "Unknown",
  state: VENUE_METADATA[Number(venueId)]?.state
}));

function buildGame(game: RawCatalogGame): Game {
  const lineScore = buildLineScore(game);

  return {
    id: `game_${game.gamePk}`,
    sport: "MLB",
    startDate: game.date,
    startDateTime: game.gameDate,
    venueId: toVenueId(game.venue.id),
    homeTeamId: toTeamId(game.homeTeam.id),
    awayTeamId: toTeamId(game.awayTeam.id),
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    homeHits: game.homeHits,
    awayHits: game.awayHits,
    homeErrors: game.homeErrors,
    awayErrors: game.awayErrors,
    status: "final",
    innings: game.lineScore?.length,
    lineScore,
    walkOff: buildWalkOff(lineScore, game.homeScore, game.awayScore),
    pitchersUsed: buildPitchers(game),
    battersUsed: buildBatters(game)
  };
}

export const seededGames: Game[] = userGameLogs.map(buildGame);
export const catalogGames: Game[] = catalogGameLogs.map(buildGame);

export const games: Game[] = [
  ...new Map(
    [...catalogGames, ...seededGames].map((game) => [game.id, game])
  ).values()
];

export const attendanceLogs: AttendanceLog[] = seededGames.map(buildAttendanceLog);

const gamesByDate = new Map(seededGames.map((game) => [game.startDate, game]));

export const friendAttendanceLogs: AttendanceLog[] = [
  buildFriendAttendanceLog({
    friendId: "friend_ava",
    game: gamesByDate.get("2024-10-08")!,
    note: "Could not believe the Mets took NLDS Game 3 in that atmosphere.",
    section: "Upper Deck 6"
  }),
  buildFriendAttendanceLog({
    friendId: "friend_ava",
    game: gamesByDate.get("2024-10-09")!,
    note: "Stayed for every pitch of NLDS Game 4 and the crowd never sat down.",
    section: "Upper Deck 6"
  }),
  buildFriendAttendanceLog({
    friendId: "friend_miles",
    game: gamesByDate.get("2025-05-21")!,
    note: "deGrom vs the Yankees in person was the entire reason I bought this ticket.",
    section: "Terrace 15"
  }),
  buildFriendAttendanceLog({
    friendId: "friend_jules",
    game: gamesByDate.get("2024-06-20")!,
    note: "Rickwood Field was too weird and historic to miss.",
    section: "Grandstand 3"
  })
];
