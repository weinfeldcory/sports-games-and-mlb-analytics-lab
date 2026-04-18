import {
  hitterSlotDefinitions,
  pitcherSlotDefinitions,
  pythagoreanExponent,
  rosterScenarioStorageKey,
  rosterStorageKey,
  teamSeasonInnings,
  teamSeasonPa,
} from "./config.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import { formatInteger, formatNumber, recordKey, teamLabel, weightedAverage } from "./utils.js";

let onRosterChange = () => {};
let lastRosterMove = "";

function currentRosterPayload() {
  return {
    hitters: state.roster.hitters.map((slot) => ({ id: slot.id, playerId: slot.playerId })),
    pitchers: state.roster.pitchers.map((slot) => ({ id: slot.id, playerId: slot.playerId })),
  };
}

function normalizeHitterPosition(position) {
  const raw = typeof position === "string" ? position.trim().toUpperCase() : "";

  if (["LF", "CF", "RF", "OF"].includes(raw)) {
    return "OF";
  }

  if (raw === "TWP") {
    return "DH";
  }

  return raw || "UTIL";
}

function eligibleHitterSlotIds(record) {
  const position = normalizeHitterPosition(record.roster_position);
  const slots = [];

  if (position === "OF") {
    slots.push("OF1", "OF2", "OF3", "UTIL1", "UTIL2", "BENCH1", "BENCH2", "DH");
  } else if (["C", "1B", "2B", "3B", "SS"].includes(position)) {
    slots.push(position, "UTIL1", "UTIL2", "BENCH1", "BENCH2");
    if (position !== "C") {
      slots.push("DH");
    }
  } else if (position === "DH") {
    slots.push("DH", "UTIL1", "UTIL2", "BENCH1", "BENCH2");
  } else {
    slots.push("UTIL1", "UTIL2", "BENCH1", "BENCH2", "DH");
  }

  return [...new Set(slots)];
}

function eligiblePitcherSlotIds(record) {
  const role = typeof record.projected_role_bucket === "string" ? record.projected_role_bucket : "";

  if (role === "starter") {
    return ["SP1", "SP2", "SP3", "SP4", "SP5", "P1", "P2", "P3"];
  }

  if (role === "closer") {
    return ["CL", "RP1", "RP2", "RP3", "RP4", "P1", "P2", "P3"];
  }

  if (role === "high_leverage_reliever") {
    return ["RP1", "RP2", "RP3", "RP4", "P1", "P2", "P3", "CL"];
  }

  if (role === "swingman") {
    return ["P1", "P2", "P3", "RP1", "RP2", "SP5"];
  }

  return ["RP1", "RP2", "RP3", "RP4", "P1", "P2", "P3"];
}

function datasetForType(type) {
  return type === "pitcher" ? state.pitchers : state.hitters;
}

function slotsForType(type) {
  return type === "pitcher" ? state.roster.pitchers : state.roster.hitters;
}

function eligibleSlotIds(type, record) {
  return type === "pitcher" ? eligiblePitcherSlotIds(record) : eligibleHitterSlotIds(record);
}

export function findRecordById(type, playerId) {
  return datasetForType(type).find((record) => recordKey(type, record) === String(playerId));
}

export function isSelected(type, playerId) {
  return slotsForType(type).some((slot) => String(slot.playerId) === String(playerId));
}

export function selectedRecords(type) {
  return slotsForType(type).map((slot) => findRecordById(type, slot.playerId)).filter(Boolean);
}

export function swapTarget(type, playerId) {
  if (isSelected(type, playerId)) {
    return null;
  }

  const record = findRecordById(type, playerId);
  if (!record) {
    return null;
  }

  const eligible = eligibleSlotIds(type, record);
  const openSlot = slotsForType(type).find((slot) => !slot.playerId && eligible.includes(slot.id));
  if (openSlot) {
    return null;
  }

  const filledEligibleSlots = slotsForType(type)
    .filter((slot) => slot.playerId && eligible.includes(slot.id))
    .map((slot) => ({ slot, record: findRecordById(type, slot.playerId) }))
    .filter((item) => item.record);

  if (!filledEligibleSlots.length) {
    return null;
  }

  const weakest = filledEligibleSlots.sort(
    (left, right) =>
      (Number(left.record.team_building_value_score) || -Infinity) - (Number(right.record.team_building_value_score) || -Infinity),
  )[0];

  return weakest || null;
}

function saveRoster() {
  localStorage.setItem(rosterStorageKey, JSON.stringify(currentRosterPayload()));
}

function signedIntegerDelta(value) {
  const rounded = Math.round(Number(value) || 0);
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function moveProjectionSummary(beforeProjection, afterProjection) {
  const runsDelta = (afterProjection?.estimatedRunsScored || 0) - (beforeProjection?.estimatedRunsScored || 0);
  const runsAllowedDelta = (afterProjection?.scaledRunsAllowed || 0) - (beforeProjection?.scaledRunsAllowed || 0);
  const winsDelta =
    afterProjection?.estimatedWins !== null &&
    afterProjection?.estimatedWins !== undefined &&
    beforeProjection?.estimatedWins !== null &&
    beforeProjection?.estimatedWins !== undefined
      ? afterProjection.estimatedWins - beforeProjection.estimatedWins
      : null;

  return `Runs ${signedIntegerDelta(runsDelta)}, runs allowed ${signedIntegerDelta(-runsAllowedDelta)}, wins ${
    winsDelta === null ? "pending full roster" : signedIntegerDelta(winsDelta)
  }.`;
}

function rememberRosterMove(label, beforeProjection, afterProjection) {
  lastRosterMove = `${label} ${moveProjectionSummary(beforeProjection, afterProjection)}`.trim();
}

export function restoreRoster() {
  try {
    const stored = JSON.parse(localStorage.getItem(rosterStorageKey) || "{}");
    const hitterBySlot = new Map((stored.hitters || []).map((slot) => [slot.id, slot.playerId]));
    const pitcherBySlot = new Map((stored.pitchers || []).map((slot) => [slot.id, slot.playerId]));

    state.roster.hitters = hitterSlotDefinitions.map((slot) => {
      const playerId = hitterBySlot.get(slot.id);
      return { ...slot, playerId: playerId && findRecordById("hitter", playerId) ? playerId : null };
    });
    state.roster.pitchers = pitcherSlotDefinitions.map((slot) => {
      const playerId = pitcherBySlot.get(slot.id);
      return { ...slot, playerId: playerId && findRecordById("pitcher", playerId) ? playerId : null };
    });
  } catch (_error) {
    state.roster.hitters = hitterSlotDefinitions.map((slot) => ({ ...slot, playerId: null }));
    state.roster.pitchers = pitcherSlotDefinitions.map((slot) => ({ ...slot, playerId: null }));
  }
}

function readScenarioStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem(rosterScenarioStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function writeScenarioStorage(scenarios) {
  localStorage.setItem(rosterScenarioStorageKey, JSON.stringify(scenarios.slice(0, 8)));
}

function scenarioLabel(name, index) {
  const cleaned = typeof name === "string" ? name.trim() : "";
  return cleaned || `Scenario ${index + 1}`;
}

function applyRosterPayload(payload) {
  const hitterBySlot = new Map((payload.hitters || []).map((slot) => [slot.id, slot.playerId]));
  const pitcherBySlot = new Map((payload.pitchers || []).map((slot) => [slot.id, slot.playerId]));

  state.roster.hitters = hitterSlotDefinitions.map((slot) => {
    const playerId = hitterBySlot.get(slot.id);
    return { ...slot, playerId: playerId && findRecordById("hitter", playerId) ? playerId : null };
  });
  state.roster.pitchers = pitcherSlotDefinitions.map((slot) => {
    const playerId = pitcherBySlot.get(slot.id);
    return { ...slot, playerId: playerId && findRecordById("pitcher", playerId) ? playerId : null };
  });
}

export function saveScenario(name) {
  const scenarios = readScenarioStorage();
  const next = [
    {
      id: `${Date.now()}`,
      name: scenarioLabel(name, scenarios.length),
      savedAt: new Date().toISOString(),
      roster: currentRosterPayload(),
    },
    ...scenarios,
  ];
  writeScenarioStorage(next);
  renderRosterBuilder();
}

export function loadScenario(scenarioId) {
  const scenario = readScenarioStorage().find((item) => String(item.id) === String(scenarioId));
  if (!scenario) {
    return;
  }

  const beforeProjection = rosterProjection(selectedRecords("hitter"), selectedRecords("pitcher"));
  applyRosterPayload(scenario.roster || {});
  saveRoster();
  rememberRosterMove(`Loaded scenario ${scenario.name}.`, beforeProjection, rosterProjection(selectedRecords("hitter"), selectedRecords("pitcher")));
  renderRosterBuilder();
  onRosterChange();
}

export function deleteScenario(scenarioId) {
  writeScenarioStorage(readScenarioStorage().filter((item) => String(item.id) !== String(scenarioId)));
  renderRosterBuilder();
}

function renderScenarioList() {
  if (!dom.scenarioList) {
    return;
  }

  const scenarios = readScenarioStorage();
  if (!scenarios.length) {
    dom.scenarioList.innerHTML = `<article class="roster-note"><span>Save a roster shell to compare future ideas against it.</span></article>`;
    return;
  }

  dom.scenarioList.innerHTML = scenarios
    .map((scenario) => {
      const hitters = (scenario.roster?.hitters || []).filter((slot) => slot.playerId).length;
      const pitchers = (scenario.roster?.pitchers || []).filter((slot) => slot.playerId).length;
      return `
        <article class="scenario-card">
          <div>
            <strong>${scenario.name}</strong>
            <div class="card-subtext">${hitters}/${hitterSlotDefinitions.length} hitters · ${pitchers}/${pitcherSlotDefinitions.length} pitchers</div>
          </div>
          <div class="scenario-actions">
            <button type="button" class="slot-remove" data-action="load-scenario" data-scenario-id="${scenario.id}">Load</button>
            <button type="button" class="slot-remove" data-action="delete-scenario" data-scenario-id="${scenario.id}">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");
}

export function addToRoster(type, playerId) {
  if (isSelected(type, playerId)) {
    return;
  }

  const record = findRecordById(type, playerId);
  if (!record) {
    return;
  }

  const beforeProjection = rosterProjection(selectedRecords("hitter"), selectedRecords("pitcher"));
  const eligible = eligibleSlotIds(type, record);
  const openSlot = slotsForType(type).find((slot) => !slot.playerId && eligible.includes(slot.id));
  if (!openSlot) {
    const target = swapTarget(type, playerId);
    if (!target) {
      return;
    }

    const replacedRecord = target.record;
    target.slot.playerId = playerId;
    saveRoster();
    rememberRosterMove(
      `Swapped ${record.player_name} in for ${replacedRecord.player_name} at ${target.slot.label}.`,
      beforeProjection,
      rosterProjection(selectedRecords("hitter"), selectedRecords("pitcher")),
    );
    renderRosterBuilder();
    onRosterChange();
    return;
  }

  openSlot.playerId = playerId;
  saveRoster();
  rememberRosterMove(
    `Added ${record.player_name} to ${openSlot.label}.`,
    beforeProjection,
    rosterProjection(selectedRecords("hitter"), selectedRecords("pitcher")),
  );
  renderRosterBuilder();
  onRosterChange();
}

export function removeFromRoster(type, playerId) {
  const slot = slotsForType(type).find((candidate) => String(candidate.playerId) === String(playerId));
  if (!slot) {
    return;
  }

  const removedRecord = findRecordById(type, playerId);
  const beforeProjection = rosterProjection(selectedRecords("hitter"), selectedRecords("pitcher"));
  slot.playerId = null;
  saveRoster();
  rememberRosterMove(
    `Removed ${removedRecord?.player_name || "player"} from ${slot.label}.`,
    beforeProjection,
    rosterProjection(selectedRecords("hitter"), selectedRecords("pitcher")),
  );
  renderRosterBuilder();
  onRosterChange();
}

export function removeFromSlot(type, slotId) {
  const slot = slotsForType(type).find((candidate) => candidate.id === slotId);
  if (!slot) {
    return;
  }

  const removedRecord = findRecordById(type, slot.playerId);
  const beforeProjection = rosterProjection(selectedRecords("hitter"), selectedRecords("pitcher"));
  slot.playerId = null;
  saveRoster();
  rememberRosterMove(
    `Removed ${removedRecord?.player_name || "player"} from ${slot.label}.`,
    beforeProjection,
    rosterProjection(selectedRecords("hitter"), selectedRecords("pitcher")),
  );
  renderRosterBuilder();
  onRosterChange();
}

function rosterProjection(hitterRecords, pitcherRecords) {
  const hitterWar = hitterRecords.reduce((sum, record) => sum + (Number(record.projected_value_war_proxy) || 0), 0);
  const pitcherWar = pitcherRecords.reduce((sum, record) => sum + (Number(record.projected_war) || 0), 0);
  const teamBuild =
    [...hitterRecords, ...pitcherRecords].reduce((sum, record) => sum + (Number(record.team_building_value_score) || 0), 0) /
    Math.max(hitterRecords.length + pitcherRecords.length, 1);

  const totalPa = hitterRecords.reduce((sum, record) => sum + (Number(record.projected_pa) || 0), 0);
  const totalHits = hitterRecords.reduce((sum, record) => sum + (Number(record.projected_hits) || 0), 0);
  const totalWalks = hitterRecords.reduce((sum, record) => sum + (Number(record.projected_walks) || 0), 0);
  const totalHr = hitterRecords.reduce((sum, record) => sum + (Number(record.projected_home_runs) || 0), 0);
  const totalSb = hitterRecords.reduce((sum, record) => sum + (Number(record.projected_stolen_bases) || 0), 0);
  const totalDefense = hitterRecords.reduce((sum, record) => sum + (Number(record.projected_defense_runs) || 0), 0);
  const offenseWoba = weightedAverage(hitterRecords, "projected_woba", "projected_pa");
  const offenseWobaPlus = weightedAverage(hitterRecords, "projected_woba_plus", "projected_pa");
  const avg = weightedAverage(hitterRecords, "projected_avg", "projected_pa");
  const obp = weightedAverage(hitterRecords, "projected_obp", "projected_pa");
  const slg = weightedAverage(hitterRecords, "projected_slg", "projected_pa");
  const paScale = totalPa > 0 ? teamSeasonPa / totalPa : 0;
  const estimatedRunsScored =
    totalPa > 0 ? teamSeasonPa * (0.113 + (offenseWoba - 0.315) / 1.85) + totalSb * paScale * 0.08 : 0;

  const projectedPitchingIp = pitcherRecords.reduce((sum, record) => sum + (Number(record.projected_ip) || 0), 0);
  const projectedEarnedRuns = pitcherRecords.reduce((sum, record) => sum + (Number(record.projected_earned_runs) || 0), 0);
  const projectedRunsAllowed = pitcherRecords.reduce((sum, record) => sum + (Number(record.projected_runs_allowed) || 0), 0);
  const projectedPitchingKs = pitcherRecords.reduce((sum, record) => sum + (Number(record.projected_strikeouts) || 0), 0);
  const projectedPitchingBbs = pitcherRecords.reduce((sum, record) => sum + (Number(record.projected_walks) || 0), 0);
  const projectedPitchingHits = pitcherRecords.reduce((sum, record) => sum + (Number(record.projected_hits_allowed) || 0), 0);
  const projectedPitchingHr = pitcherRecords.reduce((sum, record) => sum + (Number(record.projected_home_runs_allowed) || 0), 0);
  const scaledRunsAllowed = projectedPitchingIp > 0 ? projectedRunsAllowed * (teamSeasonInnings / projectedPitchingIp) : 0;
  const scaledEarnedRuns = projectedPitchingIp > 0 ? projectedEarnedRuns * (teamSeasonInnings / projectedPitchingIp) : 0;
  const scaledPitchingKs = projectedPitchingIp > 0 ? projectedPitchingKs * (teamSeasonInnings / projectedPitchingIp) : 0;
  const scaledPitchingBbs = projectedPitchingIp > 0 ? projectedPitchingBbs * (teamSeasonInnings / projectedPitchingIp) : 0;
  const scaledPitchingHits = projectedPitchingIp > 0 ? projectedPitchingHits * (teamSeasonInnings / projectedPitchingIp) : 0;
  const scaledPitchingHr = projectedPitchingIp > 0 ? projectedPitchingHr * (teamSeasonInnings / projectedPitchingIp) : 0;
  const teamEra = scaledEarnedRuns > 0 ? (scaledEarnedRuns * 9) / teamSeasonInnings : 0;
  const teamWhip = projectedPitchingIp > 0 ? (scaledPitchingHits + scaledPitchingBbs) / teamSeasonInnings : 0;
  const runPrevention = weightedAverage(pitcherRecords, "blended_run_prevention_score", "projected_ip");

  const fullRosterComplete =
    hitterRecords.length === hitterSlotDefinitions.length && pitcherRecords.length === pitcherSlotDefinitions.length;

  const winPct =
    estimatedRunsScored > 0 && scaledRunsAllowed > 0
      ? Math.pow(estimatedRunsScored, pythagoreanExponent) /
        (Math.pow(estimatedRunsScored, pythagoreanExponent) + Math.pow(scaledRunsAllowed, pythagoreanExponent))
      : 0;
  const estimatedWins = fullRosterComplete ? Math.max(45, Math.min(120, Math.round(winPct * 162))) : null;
  const estimatedLosses = estimatedWins === null ? null : 162 - estimatedWins;

  return {
    hitterWar,
    pitcherWar,
    teamBuild,
    offenseWoba,
    offenseWobaPlus,
    avg,
    obp,
    slg,
    totalPa,
    totalHits,
    totalWalks,
    totalHr,
    totalSb,
    totalDefense,
    estimatedRunsScored,
    scaledRunsAllowed,
    projectedPitchingIp,
    scaledPitchingKs,
    scaledPitchingBbs,
    scaledPitchingHits,
    scaledPitchingHr,
    teamEra,
    teamWhip,
    runPrevention,
    estimatedWins,
    estimatedLosses,
  };
}

function averageScore(records, key) {
  if (!records.length) {
    return 0;
  }
  return records.reduce((sum, record) => sum + (Number(record[key]) || 0), 0) / records.length;
}

function filledSlotCount(slots, ids) {
  return slots.filter((slot) => ids.includes(slot.id) && slot.playerId).length;
}

function rosterInsights(hitterRecords, pitcherRecords) {
  const hitterSlots = state.roster.hitters;
  const pitcherSlots = state.roster.pitchers;
  const catcherFilled = filledSlotCount(hitterSlots, ["C"]);
  const middleInfieldFilled = filledSlotCount(hitterSlots, ["2B", "SS"]);
  const outfieldFilled = filledSlotCount(hitterSlots, ["OF1", "OF2", "OF3"]);
  const benchFilled = filledSlotCount(hitterSlots, ["BENCH1", "BENCH2"]);
  const dhUtilFilled = filledSlotCount(hitterSlots, ["DH", "UTIL1", "UTIL2"]);
  const rotationFilled = filledSlotCount(pitcherSlots, ["SP1", "SP2", "SP3", "SP4", "SP5"]);
  const bullpenFilled = filledSlotCount(pitcherSlots, ["CL", "RP1", "RP2", "RP3", "RP4"]);
  const staffDepthFilled = filledSlotCount(pitcherSlots, ["P1", "P2", "P3"]);

  const strengthCandidates = [
    { label: "Lineup talent", score: averageScore(hitterRecords, "blended_talent_score"), copy: `Avg blended talent ${formatNumber(averageScore(hitterRecords, "blended_talent_score"), 1)} across selected hitters.` },
    { label: "Lineup stability", score: averageScore(hitterRecords, "stability_score"), copy: `Avg stability ${formatNumber(averageScore(hitterRecords, "stability_score"), 1)} keeps the offense less fragile.` },
    { label: "Power ceiling", score: averageScore(hitterRecords, "upside_score"), copy: `Avg hitter upside ${formatNumber(averageScore(hitterRecords, "upside_score"), 1)} gives the roster more ceiling.` },
    { label: "Run prevention", score: averageScore(pitcherRecords, "blended_run_prevention_score"), copy: `Avg run prevention ${formatNumber(averageScore(pitcherRecords, "blended_run_prevention_score"), 1)} supports the staff baseline.` },
    { label: "Pitch quality", score: averageScore(pitcherRecords, "blended_pitch_quality_score"), copy: `Avg pitch quality ${formatNumber(averageScore(pitcherRecords, "blended_pitch_quality_score"), 1)} signals swing-and-miss quality.` },
    { label: "Pitcher floor", score: averageScore(pitcherRecords, "floor_score"), copy: `Avg pitcher floor ${formatNumber(averageScore(pitcherRecords, "floor_score"), 1)} improves staff trust.` },
  ]
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const risks = [];
  if (!catcherFilled) {
    risks.push("No catcher slot is filled, so the lineup shell is missing a required defensive anchor.");
  }
  if (middleInfieldFilled < 2) {
    risks.push("Middle infield is incomplete. A missing 2B or SS weakens defensive shape and lineup balance.");
  }
  if (outfieldFilled < 3) {
    risks.push(`Only ${outfieldFilled} of 3 outfield slots are filled, so the offense still lacks full corner/center coverage.`);
  }
  if (rotationFilled < 5) {
    risks.push(`The rotation is only ${rotationFilled} of 5 starters deep, so projected innings are still structurally thin.`);
  }
  if (bullpenFilled < 5) {
    risks.push(`Only ${bullpenFilled} of 5 bullpen slots are filled, so late-game role balance is incomplete.`);
  }
  if (benchFilled < 2) {
    risks.push("The hitter bench is not fully built, which limits platoon and injury coverage.");
  }
  if (staffDepthFilled < 3) {
    risks.push("The staff depth slots are still open, so fallback innings are light.");
  }
  if (hitterRecords.length && averageScore(hitterRecords, "platoon_risk_score") > 100) {
    risks.push(`Avg platoon risk is ${formatNumber(averageScore(hitterRecords, "platoon_risk_score"), 1)}, which suggests the lineup may be too role-fragile.`);
  }
  if (pitcherRecords.length && averageScore(pitcherRecords, "stability_score") < 95) {
    risks.push(`Avg pitcher stability is only ${formatNumber(averageScore(pitcherRecords, "stability_score"), 1)}, which makes the staff more volatile than the headline score implies.`);
  }

  const balanceCards = [
    { label: "Hitter Spine", value: `${catcherFilled}/1 C · ${middleInfieldFilled}/2 MI · ${outfieldFilled}/3 OF`, subtext: "Core defensive structure across the lineup shell." },
    { label: "Bench / Utility", value: `${dhUtilFilled}/3 DH+UTIL · ${benchFilled}/2 bench`, subtext: "Flexibility for lineup mixing and coverage." },
    { label: "Rotation", value: `${rotationFilled}/5 starters`, subtext: "Front-to-back rotation coverage." },
    { label: "Bullpen / Staff", value: `${bullpenFilled}/5 pen · ${staffDepthFilled}/3 depth`, subtext: "Late-game and fallback innings coverage." },
  ];

  return {
    strengths: strengthCandidates,
    risks: risks.slice(0, 4),
    balanceCards,
  };
}

function renderRosterInsights(hitterRecords, pitcherRecords) {
  if (!dom.rosterInsights) {
    return;
  }

  if (!hitterRecords.length && !pitcherRecords.length) {
    dom.rosterInsights.innerHTML = "";
    return;
  }

  const insights = rosterInsights(hitterRecords, pitcherRecords);

  dom.rosterInsights.innerHTML = `
    <div class="roster-insight-layout">
      <section class="roster-insight-block">
        <h4>Balance Check</h4>
        <div class="roster-balance-grid">
          ${insights.balanceCards
            .map(
              (card) => `
                <article class="stat-chip">
                  <span class="stat-chip-label">${card.label}</span>
                  <div class="stat-chip-value">${card.value}</div>
                  <div class="card-subtext">${card.subtext}</div>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>
      <section class="roster-insight-block">
        <h4>Strengths</h4>
        <div class="roster-note-list">
          ${insights.strengths.length
            ? insights.strengths
                .map(
                  (item) => `
                    <article class="roster-note positive">
                      <strong>${item.label}</strong>
                      <span>${item.copy}</span>
                    </article>
                  `,
                )
                .join("")
            : `<article class="roster-note"><span>Add more players to surface team strengths.</span></article>`}
        </div>
      </section>
      <section class="roster-insight-block">
        <h4>Risks</h4>
        <div class="roster-note-list">
          ${insights.risks.length
            ? insights.risks
                .map(
                  (item) => `
                    <article class="roster-note warning">
                      <span>${item}</span>
                    </article>
                  `,
                )
                .join("")
            : `<article class="roster-note positive"><span>The current roster shell does not show an obvious structural risk.</span></article>`}
        </div>
      </section>
    </div>
  `;
}

function renderSlotCards(type, container, slots) {
  container.innerHTML = slots
    .map((slot) => {
      const record = findRecordById(type, slot.playerId);

      if (!record) {
        return `
          <article class="slot-card">
            <span class="slot-label">${slot.label}</span>
            <div class="slot-empty">Open slot</div>
            <div class="slot-meta">Add a ${type} from the board.</div>
          </article>
        `;
      }

      const metaLine =
        type === "pitcher"
          ? `${teamLabel(record)} · ${record.roster_role} · ${record.projected_role_bucket}`
          : `${teamLabel(record)} · ${record.roster_position || "-"} · ${record.roster_role}`;

      const scoreLine =
        type === "pitcher"
          ? `Build ${formatNumber(record.team_building_value_score, 1)} · ERA ${formatNumber(record.projected_era, 2)} · IP ${formatNumber(record.projected_ip, 1)}`
          : `Build ${formatNumber(record.team_building_value_score, 1)} · WAR ${formatNumber(record.projected_value_war_proxy, 1)}`;

      return `
        <article class="slot-card filled">
          <span class="slot-label">${slot.label}</span>
          <div class="slot-player">${record.player_name}</div>
          <div class="slot-meta">${metaLine}</div>
          <div class="slot-meta">${scoreLine}</div>
          <button type="button" class="slot-remove" data-type="${type}" data-slot-id="${slot.id}">Remove</button>
        </article>
      `;
    })
    .join("");
}

export function renderRosterBuilder() {
  const hitterRecords = selectedRecords("hitter");
  const pitcherRecords = selectedRecords("pitcher");
  const fullRosterComplete =
    hitterRecords.length === hitterSlotDefinitions.length && pitcherRecords.length === pitcherSlotDefinitions.length;

  dom.rosterStatus.textContent = `${hitterRecords.length} / ${hitterSlotDefinitions.length} hitters · ${pitcherRecords.length} / ${pitcherSlotDefinitions.length} pitchers`;
  renderSlotCards("hitter", dom.rosterHitterSlots, state.roster.hitters);
  renderSlotCards("pitcher", dom.rosterPitcherSlots, state.roster.pitchers);

  if (!hitterRecords.length && !pitcherRecords.length) {
    dom.rosterSummaryCards.innerHTML = `
      <article class="card">
        <span class="card-label">Roster Build</span>
        <div class="card-value">Start Drafting</div>
        <div class="card-subtext">Select hitters and pitchers from the boards to model a full season.</div>
      </article>
    `;
    dom.rosterAssumption.textContent =
      "Formula: runs scored comes from scaled hitter wOBA; runs allowed comes from scaled pitcher projected runs allowed; wins use a 1.83 Pythagorean exponent.";
    dom.rosterMoveNote.textContent = lastRosterMove;
    dom.rosterTeamStats.innerHTML = "";
    dom.rosterInsights.innerHTML = "";
    renderScenarioList();
    return;
  }

  const projection = rosterProjection(hitterRecords, pitcherRecords);
  const summaryCardsMarkup = [
    { label: "Selected Hitter WAR", value: formatNumber(projection.hitterWar, 1), subtext: "Offensive roster contribution" },
    { label: "Selected Pitcher WAR", value: formatNumber(projection.pitcherWar, 1), subtext: "Staff contribution from selected pitchers" },
    {
      label: "Projected Runs",
      value: `${formatInteger(projection.estimatedRunsScored)} / ${formatInteger(projection.scaledRunsAllowed)}`,
      subtext: "Runs scored and runs allowed over 162 games",
    },
    {
      label: "Likely Record",
      value: fullRosterComplete ? `${projection.estimatedWins}-${projection.estimatedLosses}` : "Incomplete",
      subtext: fullRosterComplete
        ? `Pythagorean estimate with exponent ${pythagoreanExponent}`
        : `Add ${hitterSlotDefinitions.length - hitterRecords.length} hitters and ${pitcherSlotDefinitions.length - pitcherRecords.length} pitchers to unlock the record`,
    },
    {
      label: "Offense Quality",
      value: `${formatNumber(projection.offenseWoba, 3)} / ${formatInteger(projection.offenseWobaPlus)}`,
      subtext: "Projected team wOBA / wOBA+",
    },
    {
      label: "Staff Quality",
      value: `${formatNumber(projection.teamEra, 2)} / ${formatNumber(projection.teamWhip, 2)}`,
      subtext: "Projected ERA / WHIP from selected staff",
    },
  ];

  dom.rosterSummaryCards.innerHTML = summaryCardsMarkup
    .map(
      (card) => `
        <article class="card">
          <span class="card-label">${card.label}</span>
          <div class="card-value">${card.value}</div>
          <div class="card-subtext">${card.subtext}</div>
        </article>
      `,
    )
    .join("");

  dom.rosterAssumption.textContent =
    "Formula: runs scored = 6,200 PA scaled from selected hitter wOBA; runs allowed = selected pitcher projected runs allowed scaled to 1,458 innings; wins use a 1.83 Pythagorean exponent.";
  dom.rosterMoveNote.textContent = lastRosterMove;

  const teamStats = [
    { label: "Projected AVG", value: formatNumber(projection.avg, 3) },
    { label: "Projected OBP", value: formatNumber(projection.obp, 3) },
    { label: "Projected SLG", value: formatNumber(projection.slg, 3) },
    { label: "Hitter PA", value: formatInteger(projection.totalPa) },
    { label: "Projected Hits", value: formatInteger(projection.totalHits) },
    { label: "Projected Walks", value: formatInteger(projection.totalWalks) },
    { label: "Projected HR", value: formatInteger(projection.totalHr) },
    { label: "Projected SB", value: formatInteger(projection.totalSb) },
    { label: "Defense Runs", value: formatNumber(projection.totalDefense, 1) },
    { label: "Pitching IP", value: formatNumber(projection.projectedPitchingIp, 1) },
    { label: "Pitching K", value: formatInteger(projection.scaledPitchingKs) },
    { label: "Pitching BB", value: formatInteger(projection.scaledPitchingBbs) },
    { label: "Hits Allowed", value: formatInteger(projection.scaledPitchingHits) },
    { label: "HR Allowed", value: formatInteger(projection.scaledPitchingHr) },
    { label: "Run Prevention", value: formatNumber(projection.runPrevention, 1) },
  ];

  dom.rosterTeamStats.innerHTML = teamStats
    .map(
      (stat) => `
        <article class="stat-chip">
          <span class="stat-chip-label">${stat.label}</span>
          <div class="stat-chip-value">${stat.value}</div>
        </article>
      `,
    )
    .join("");

  renderRosterInsights(hitterRecords, pitcherRecords);
  renderScenarioList();
}

export function registerRosterCallbacks(callbacks) {
  onRosterChange = callbacks.onRosterChange || (() => {});
}
