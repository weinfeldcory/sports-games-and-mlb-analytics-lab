import assert from "node:assert/strict";
import { currentScoring, games, teams } from "../src/data.js";
import {
  constrainedEqualValueScoring,
  equalValueScoring,
  expectedStandings,
  ownerWinningPaths,
  ownerWinOdds,
  scoringFairnessSummary,
  standings,
  trueMaxStandings
} from "../src/scoring.js";

const current = standings(teams, games);
assert.deepEqual(current, [
  { owner: "Cory", points: 83 },
  { owner: "Berkman", points: 61 },
  { owner: "Shuster", points: 32 },
  { owner: "Seiden", points: 19 }
]);

const max = trueMaxStandings(teams, games);
assert.deepEqual(max, [
  { owner: "Cory", max: 106 },
  { owner: "Berkman", max: 61 },
  { owner: "Shuster", max: 32 },
  { owner: "Seiden", max: 19 }
]);

const expected = expectedStandings(teams, games);
const cory = expected.find((row) => row.owner === "Cory");
assert.equal(Math.round(cory.expected * 10) / 10, 103.5);

const equalized = equalValueScoring(currentScoring);
const constrained = constrainedEqualValueScoring(currentScoring);
const currentFairness = scoringFairnessSummary(currentScoring);
const equalizedFairness = scoringFairnessSummary(equalized);
const constrainedFairness = scoringFairnessSummary(constrained);

assert.ok(equalizedFairness.spread < currentFairness.spread);
assert.ok(equalizedFairness.coefficientOfVariation < currentFairness.coefficientOfVariation);
assert.ok(constrainedFairness.spread < currentFairness.spread);
assert.ok(constrainedFairness.coefficientOfVariation < currentFairness.coefficientOfVariation);
assert.ok(constrained[16][5] <= 500);

const winOdds = ownerWinOdds(teams, games, currentScoring);
const totalOdds = winOdds.reduce((sum, row) => sum + row.odds, 0);
assert.ok(Math.abs(totalOdds - 1) < 0.000001);

const winPaths = ownerWinningPaths(teams, games, currentScoring);
assert.equal(winPaths.length, 4);
assert.equal(winPaths[0].owner, "Cory");
assert.match(winPaths[0].summary, /first place|clinch|remaining games/i);

console.log("scoring tests passed");
