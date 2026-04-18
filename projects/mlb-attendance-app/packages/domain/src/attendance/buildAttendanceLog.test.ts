import test from "node:test";
import assert from "node:assert/strict";
import { buildAttendanceLog } from "./buildAttendanceLog";
import type { CreateAttendanceInput, Game } from "../models";

const baseInput: CreateAttendanceInput = {
  userId: "user_1",
  gameId: "game_1",
  seat: {
    section: " 214A ",
    row: " 5 ",
    seatNumber: " 7 "
  },
  memorableMoment: "  Judge hit one over the Monster. ",
  companion: " Sam ",
  giveaway: " Aaron Judge bobblehead ",
  weather: " 72F and clear "
};

test("buildAttendanceLog trims seat fields and derives witnessed events", () => {
  const game: Game = {
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
    featuredPlayerHomeRun: "Aaron Judge"
  };

  const log = buildAttendanceLog({
    input: baseInput,
    game,
    favoriteTeamId: "team_nyy",
    now: 12345
  });

  assert.equal(log.id, "attendance_12345");
  assert.deepEqual(log.seat, {
    section: "214A",
    row: "5",
    seatNumber: "7"
  });
  assert.equal(log.memorableMoment, "Judge hit one over the Monster.");
  assert.equal(log.companion, "Sam");
  assert.equal(log.giveaway, "Aaron Judge bobblehead");
  assert.equal(log.weather, "72F and clear");
  assert.equal(log.attendedOn, "2025-07-20");
  assert.deepEqual(
    log.witnessedEvents.map((event) => event.type),
    ["team_win", "shutout", "home_run"]
  );
});

test("buildAttendanceLog includes extra innings and walk-off without favorite-team result when favorite team is absent", () => {
  const game: Game = {
    id: "game_1",
    sport: "MLB",
    startDate: "2025-05-18",
    venueId: "venue_camden",
    homeTeamId: "team_bal",
    awayTeamId: "team_nyy",
    homeScore: 2,
    awayScore: 1,
    homeHits: 7,
    awayHits: 5,
    status: "final",
    innings: 10,
    walkOff: true
  };

  const log = buildAttendanceLog({
    input: {
      ...baseInput,
      seat: {
        section: "76"
      }
    },
    game,
    now: 67890
  });

  assert.deepEqual(
    log.witnessedEvents.map((event) => event.type),
    ["extra_innings", "walk_off"]
  );
});
