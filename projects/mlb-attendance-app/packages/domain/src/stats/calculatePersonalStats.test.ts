import test from "node:test";
import assert from "node:assert/strict";
import { calculatePersonalStats } from "./calculatePersonalStats";
import type { AttendanceLog, Game, Team, UserProfile, Venue } from "../models";

const user: UserProfile = {
  id: "user_1",
  displayName: "Cory",
  favoriteTeamId: "team_nyy",
  followingIds: ["friend_ava"]
};

const teams: Team[] = [
  { id: "team_nyy", sport: "MLB", city: "New York", name: "Yankees", abbreviation: "NYY" },
  { id: "team_bos", sport: "MLB", city: "Boston", name: "Red Sox", abbreviation: "BOS" }
];

const venues: Venue[] = [
  { id: "venue_yankee", name: "Yankee Stadium", city: "Bronx", state: "NY" },
  { id: "venue_fenway", name: "Fenway Park", city: "Boston", state: "MA" }
];

const games: Game[] = [
  {
    id: "game_1",
    sport: "MLB",
    startDate: "2025-07-20",
    venueId: "venue_fenway",
    homeTeamId: "team_bos",
    awayTeamId: "team_nyy",
    homeScore: 0,
    awayScore: 5,
    homeHits: 4,
    awayHits: 9,
    status: "final",
    featuredPlayerHomeRun: "Aaron Judge",
    pitchersUsed: [
      { teamId: "team_nyy", pitcherName: "Luis Gil", role: "starter", inningsPitched: 9, hitsAllowed: 4, runsAllowed: 0, strikeouts: 8, walksAllowed: 1, homeRunsAllowed: 0 },
      { teamId: "team_bos", pitcherName: "Tanner Houck", role: "starter", inningsPitched: 5, hitsAllowed: 7, runsAllowed: 5, strikeouts: 4, walksAllowed: 2, homeRunsAllowed: 1 }
    ],
    battersUsed: [
      { teamId: "team_nyy", playerName: "Juan Soto", position: "RF", atBats: 4, hits: 2, homeRuns: 1, rbis: 3, strikeouts: 1, walks: 1 },
      { teamId: "team_bos", playerName: "Rafael Devers", position: "3B", atBats: 4, hits: 1, homeRuns: 0, rbis: 0, strikeouts: 2, walks: 0 }
    ]
  },
  {
    id: "game_2",
    sport: "MLB",
    startDate: "2025-04-06",
    venueId: "venue_yankee",
    homeTeamId: "team_nyy",
    awayTeamId: "team_bos",
    homeScore: 6,
    awayScore: 4,
    homeHits: 11,
    awayHits: 8,
    status: "final",
    pitchersUsed: [
      { teamId: "team_nyy", pitcherName: "Gerrit Cole", role: "starter", inningsPitched: 7, hitsAllowed: 6, runsAllowed: 2, strikeouts: 9, walksAllowed: 1, homeRunsAllowed: 1 },
      { teamId: "team_bos", pitcherName: "Tanner Houck", role: "reliever", inningsPitched: 1, hitsAllowed: 0, runsAllowed: 0, strikeouts: 1, walksAllowed: 0, homeRunsAllowed: 0 }
    ],
    battersUsed: [
      { teamId: "team_nyy", playerName: "Juan Soto", position: "RF", atBats: 5, hits: 3, homeRuns: 0, rbis: 2, strikeouts: 0, walks: 0 },
      { teamId: "team_bos", playerName: "Rafael Devers", position: "3B", atBats: 4, hits: 2, homeRuns: 1, rbis: 2, strikeouts: 1, walks: 0 }
    ]
  }
];

test("calculatePersonalStats derives totals, favorite team split, and recent moments", () => {
  const attendanceLogs: AttendanceLog[] = [
    {
      id: "attendance_1",
      userId: "user_1",
      gameId: "game_2",
      venueId: "venue_yankee",
      attendedOn: "2025-04-06",
      seat: { section: "214A" },
      witnessedEvents: [{ id: "e1", attendanceLogId: "attendance_1", type: "team_win", label: "Win" }],
      memorableMoment: "Home opener"
    },
    {
      id: "attendance_2",
      userId: "user_1",
      gameId: "game_1",
      venueId: "venue_fenway",
      attendedOn: "2025-07-20",
      seat: { section: "Grandstand 12" },
      witnessedEvents: [
        { id: "e2", attendanceLogId: "attendance_2", type: "team_win", label: "Win" },
        { id: "e3", attendanceLogId: "attendance_2", type: "shutout", label: "Shutout" },
        { id: "e4", attendanceLogId: "attendance_2", type: "home_run", label: "Aaron Judge home run" }
      ],
      memorableMoment: "Road shutout"
    }
  ];

  const stats = calculatePersonalStats({
    user,
    attendanceLogs,
    games,
    teams,
    venues
  });

  assert.equal(stats.totalGamesAttended, 2);
  assert.equal(stats.wins, 2);
  assert.equal(stats.losses, 0);
  assert.equal(stats.uniqueStadiumsVisited, 2);
  assert.equal(stats.uniqueSectionsSatIn, 2);
  assert.equal(stats.witnessedHomeRuns, 2);
  assert.equal(stats.totalHitsSeen, 32);
  assert.equal(stats.totalRunsSeen, 15);
  assert.equal(stats.uniquePitchersSeen, 3);
  assert.equal(stats.averageHitsPerGame, 16);
  assert.deepEqual(stats.favoriteTeamSplit, {
    teamId: "team_nyy",
    teamName: "Yankees",
    gamesAttended: 2,
    wins: 2,
    losses: 0
  });
  assert.deepEqual(stats.topPitchersSeen[0], {
    pitcherName: "Tanner Houck",
    appearances: 2,
    teams: ["Red Sox"]
  });
  assert.deepEqual(stats.playerBattingSummaries[0], {
    playerName: "Juan Soto",
    teams: ["Yankees"],
    positions: ["RF"],
    gamesSeen: 2,
    atBatsSeen: 9,
    hitsSeen: 5,
    battingAverageSeen: 5 / 9,
    homeRunsSeen: 1,
    rbisSeen: 5,
    strikeoutsSeenAtPlate: 1,
    walksSeen: 1
  });
  assert.deepEqual(stats.playerPitchingSummaries[0], {
    pitcherName: "Luis Gil",
    teams: ["Yankees"],
    roles: ["starter"],
    appearances: 1,
    starts: 1,
    outsRecordedSeen: 27,
    strikeoutsSeen: 8,
    inningsSeen: 9,
    hitsAllowedSeen: 4,
    runsAllowedSeen: 0,
    earnedRunsAllowedSeen: undefined,
    walksAllowedSeen: 1,
    homeRunsAllowedSeen: 0,
    eraSeen: 0,
    bestGameScoreSeen: 92
  });
  assert.deepEqual(stats.playerPitchingSummaries[1], {
    pitcherName: "Gerrit Cole",
    teams: ["Yankees"],
    roles: ["starter"],
    appearances: 1,
    starts: 1,
    outsRecordedSeen: 21,
    strikeoutsSeen: 9,
    inningsSeen: 7,
    hitsAllowedSeen: 6,
    runsAllowedSeen: 2,
    earnedRunsAllowedSeen: undefined,
    walksAllowedSeen: 1,
    homeRunsAllowedSeen: 1,
    eraSeen: (2 * 9) / 7,
    bestGameScoreSeen: 65
  });
  assert.deepEqual(stats.playerPitchingSummaries[2], {
    pitcherName: "Tanner Houck",
    teams: ["Red Sox"],
    roles: ["reliever", "starter"],
    appearances: 2,
    starts: 1,
    outsRecordedSeen: 18,
    strikeoutsSeen: 5,
    inningsSeen: 6,
    hitsAllowedSeen: 7,
    runsAllowedSeen: 5,
    earnedRunsAllowedSeen: 0,
    walksAllowedSeen: 2,
    homeRunsAllowedSeen: 1,
    eraSeen: 7.5,
    bestGameScoreSeen: 35
  });
  assert.deepEqual(stats.topPitchingGamePerformances[0], {
    gameId: "game_1",
    pitcherName: "Luis Gil",
    teamId: "team_nyy",
    teamName: "Yankees",
    opponentTeamId: "team_bos",
    opponentTeamName: "Red Sox",
    startDate: "2025-07-20",
    venueId: "venue_fenway",
    gameScore: 92,
    inningsPitched: 9,
    hitsAllowed: 4,
    strikeouts: 8,
    runsAllowed: 0,
    earnedRunsAllowed: undefined,
    walksAllowed: 1,
    homeRunsAllowed: 0,
    pitchesThrown: undefined,
    strikes: undefined
  });
  assert.deepEqual(stats.teamSeenSummaries, [
    {
      teamId: "team_bos",
      teamName: "Red Sox",
      gamesSeen: 2,
      winsSeen: 0,
      lossesSeen: 2,
      hitsSeen: 12,
      runsSeen: 4
    },
    {
      teamId: "team_nyy",
      teamName: "Yankees",
      gamesSeen: 2,
      winsSeen: 2,
      lossesSeen: 0,
      hitsSeen: 20,
      runsSeen: 11
    }
  ]);
  assert.deepEqual(
    stats.recentMoments.map((moment) => moment.title),
    ["Road shutout", "Home opener"]
  );
  assert.equal(stats.recentMoments[0]?.subtitle, "Against Red Sox on 2025-07-20");
});

test("pitcher seen most ranks by outs recorded before appearances", () => {
  const inningsRankingGames: Game[] = [
    {
      id: "rank_game_1",
      sport: "MLB",
      startDate: "2025-05-01",
      venueId: "venue_yankee",
      homeTeamId: "team_nyy",
      awayTeamId: "team_bos",
      homeScore: 4,
      awayScore: 2,
      homeHits: 8,
      awayHits: 6,
      status: "final",
      pitchersUsed: [
        { teamId: "team_nyy", pitcherName: "Workhorse B", role: "starter", inningsPitched: 5.2, hitsAllowed: 4, runsAllowed: 2, earnedRunsAllowed: 2, strikeouts: 7, walksAllowed: 1, homeRunsAllowed: 0 },
        { teamId: "team_bos", pitcherName: "Sprinter A", role: "starter", inningsPitched: 2, hitsAllowed: 5, runsAllowed: 3, earnedRunsAllowed: 3, strikeouts: 2, walksAllowed: 1, homeRunsAllowed: 1 }
      ]
    },
    {
      id: "rank_game_2",
      sport: "MLB",
      startDate: "2025-05-05",
      venueId: "venue_fenway",
      homeTeamId: "team_bos",
      awayTeamId: "team_nyy",
      homeScore: 3,
      awayScore: 6,
      homeHits: 7,
      awayHits: 9,
      status: "final",
      pitchersUsed: [
        { teamId: "team_bos", pitcherName: "Sprinter A", role: "starter", inningsPitched: 2, hitsAllowed: 6, runsAllowed: 4, earnedRunsAllowed: 4, strikeouts: 3, walksAllowed: 2, homeRunsAllowed: 1 }
      ]
    },
    {
      id: "rank_game_3",
      sport: "MLB",
      startDate: "2025-05-10",
      venueId: "venue_yankee",
      homeTeamId: "team_nyy",
      awayTeamId: "team_bos",
      homeScore: 2,
      awayScore: 1,
      homeHits: 5,
      awayHits: 4,
      status: "final",
      pitchersUsed: [
        { teamId: "team_nyy", pitcherName: "Workhorse B", role: "starter", inningsPitched: 1.0, hitsAllowed: 1, runsAllowed: 0, earnedRunsAllowed: 0, strikeouts: 1, walksAllowed: 0, homeRunsAllowed: 0 }
      ]
    }
  ];

  const attendanceLogs: AttendanceLog[] = inningsRankingGames.map((game, index) => ({
    id: `rank_attendance_${index + 1}`,
    userId: user.id,
    gameId: game.id,
    venueId: game.venueId,
    attendedOn: game.startDate,
    seat: { section: "100" },
    witnessedEvents: []
  }));

  const stats = calculatePersonalStats({
    user,
    attendanceLogs,
    games: inningsRankingGames,
    teams,
    venues
  });

  assert.equal(stats.playerPitchingSummaries[0]?.pitcherName, "Workhorse B");
  assert.equal(stats.playerPitchingSummaries[0]?.outsRecordedSeen, 20);
  assert.equal(stats.playerPitchingSummaries[0]?.inningsSeen, 6.2);
  assert.equal(stats.playerPitchingSummaries[1]?.pitcherName, "Sprinter A");
  assert.equal(stats.playerPitchingSummaries[1]?.appearances, 2);
});
