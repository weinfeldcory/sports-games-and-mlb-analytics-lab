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
      { teamId: "team_nyy", pitcherName: "Luis Gil", role: "starter" },
      { teamId: "team_bos", pitcherName: "Tanner Houck", role: "starter" }
    ],
    battersUsed: [
      { teamId: "team_nyy", playerName: "Juan Soto", atBats: 4, hits: 2, homeRuns: 1, rbis: 3, strikeouts: 1, walks: 1 },
      { teamId: "team_bos", playerName: "Rafael Devers", atBats: 4, hits: 1, homeRuns: 0, rbis: 0, strikeouts: 2, walks: 0 }
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
      { teamId: "team_nyy", pitcherName: "Gerrit Cole", role: "starter" },
      { teamId: "team_bos", pitcherName: "Tanner Houck", role: "reliever" }
    ],
    battersUsed: [
      { teamId: "team_nyy", playerName: "Juan Soto", atBats: 5, hits: 3, homeRuns: 0, rbis: 2, strikeouts: 0, walks: 0 },
      { teamId: "team_bos", playerName: "Rafael Devers", atBats: 4, hits: 2, homeRuns: 1, rbis: 2, strikeouts: 1, walks: 0 }
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
  assert.equal(stats.witnessedHomeRuns, 1);
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
    pitcherName: "Tanner Houck",
    teams: ["Red Sox"],
    appearances: 2,
    strikeoutsSeen: 0,
    inningsSeen: 0,
    hitsAllowedSeen: 0,
    runsAllowedSeen: 0,
    eraSeen: 0
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
