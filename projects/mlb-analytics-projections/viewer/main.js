const hitterDataUrl = "./data/hitter_projection_vs_current_2026.json";
const pitcherDataUrl = "./data/pitcher_projection_vs_current_2026.json";
const rosterStorageKey = "mlb-team-builder-roster-v2";
const pythagoreanExponent = 1.83;
const teamSeasonPa = 6200;
const teamSeasonInnings = 1458;

const hitterSlotDefinitions = [
  { id: "C", label: "C" },
  { id: "1B", label: "1B" },
  { id: "2B", label: "2B" },
  { id: "3B", label: "3B" },
  { id: "SS", label: "SS" },
  { id: "OF1", label: "OF 1" },
  { id: "OF2", label: "OF 2" },
  { id: "OF3", label: "OF 3" },
  { id: "DH", label: "DH" },
  { id: "UTIL1", label: "UTIL 1" },
  { id: "UTIL2", label: "UTIL 2" },
  { id: "BENCH1", label: "Bench 1" },
  { id: "BENCH2", label: "Bench 2" },
];

const pitcherSlotDefinitions = [
  { id: "SP1", label: "SP 1" },
  { id: "SP2", label: "SP 2" },
  { id: "SP3", label: "SP 3" },
  { id: "SP4", label: "SP 4" },
  { id: "SP5", label: "SP 5" },
  { id: "CL", label: "CL" },
  { id: "RP1", label: "RP 1" },
  { id: "RP2", label: "RP 2" },
  { id: "RP3", label: "RP 3" },
  { id: "RP4", label: "RP 4" },
  { id: "P1", label: "Staff 1" },
  { id: "P2", label: "Staff 2" },
  { id: "P3", label: "Staff 3" },
];

const state = {
  hitters: [],
  pitchers: [],
  filteredHitters: [],
  filteredPitchers: [],
  roster: {
    hitters: hitterSlotDefinitions.map((slot) => ({ ...slot, playerId: null })),
    pitchers: pitcherSlotDefinitions.map((slot) => ({ ...slot, playerId: null })),
  },
};

const hitterTeamFilter = document.querySelector("#team-filter");
const hitterSearchFilter = document.querySelector("#search-filter");
const hitterMinPaFilter = document.querySelector("#min-pa-filter");
const hitterSortKeyFilter = document.querySelector("#sort-key");
const summaryCards = document.querySelector("#summary-cards");
const projectionRows = document.querySelector("#projection-rows");
const teamTitle = document.querySelector("#team-title");
const teamCopy = document.querySelector("#team-copy");
const teamMetrics = document.querySelector("#team-metrics");
const teamLeadersList = document.querySelector("#team-leaders-list");

const pitcherTeamFilter = document.querySelector("#pitcher-team-filter");
const pitcherSearchFilter = document.querySelector("#pitcher-search-filter");
const pitcherMinIpFilter = document.querySelector("#pitcher-min-ip-filter");
const pitcherSortKeyFilter = document.querySelector("#pitcher-sort-key");
const pitcherSummaryCards = document.querySelector("#pitcher-summary-cards");
const pitcherRows = document.querySelector("#pitcher-rows");

const rosterHitterSlots = document.querySelector("#roster-hitter-slots");
const rosterPitcherSlots = document.querySelector("#roster-pitcher-slots");
const rosterSummaryCards = document.querySelector("#roster-summary-cards");
const rosterTeamStats = document.querySelector("#roster-team-stats");
const rosterStatus = document.querySelector("#roster-status");
const rosterAssumption = document.querySelector("#roster-assumption");

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toFixed(digits);
}

function formatInteger(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return Math.round(Number(value)).toString();
}

function teamLabel(record) {
  const currentTeam = typeof record.team_2026 === "string" ? record.team_2026.trim() : "";
  const priorTeam = typeof record.team_2025 === "string" ? record.team_2025.trim() : "";

  if (currentTeam && currentTeam !== "- - -") {
    return currentTeam;
  }

  if (priorTeam && priorTeam !== "- - -") {
    return priorTeam;
  }

  return "FA";
}

function average(records, key) {
  const values = records
    .map((record) => Number(record[key]))
    .filter((value) => !Number.isNaN(value));

  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedAverage(records, key, weightKey) {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const record of records) {
    const value = Number(record[key]);
    const weight = Number(record[weightKey]);

    if (Number.isNaN(value) || Number.isNaN(weight) || weight <= 0) {
      continue;
    }

    weightedSum += value * weight;
    totalWeight += weight;
  }

  return totalWeight ? weightedSum / totalWeight : 0;
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

function slotDefinitionsForType(type) {
  return type === "pitcher" ? pitcherSlotDefinitions : hitterSlotDefinitions;
}

function findRecordById(type, playerId) {
  return datasetForType(type).find((record) => String(record.fg_player_id) === String(playerId));
}

function isSelected(type, playerId) {
  return slotsForType(type).some((slot) => String(slot.playerId) === String(playerId));
}

function selectedRecords(type) {
  return slotsForType(type)
    .map((slot) => findRecordById(type, slot.playerId))
    .filter(Boolean);
}

function saveRoster() {
  const payload = {
    hitters: state.roster.hitters.map((slot) => ({ id: slot.id, playerId: slot.playerId })),
    pitchers: state.roster.pitchers.map((slot) => ({ id: slot.id, playerId: slot.playerId })),
  };
  localStorage.setItem(rosterStorageKey, JSON.stringify(payload));
}

function restoreRoster() {
  try {
    const stored = JSON.parse(localStorage.getItem(rosterStorageKey) || "{}");
    const hitterBySlot = new Map((stored.hitters || []).map((slot) => [slot.id, slot.playerId]));
    const pitcherBySlot = new Map((stored.pitchers || []).map((slot) => [slot.id, slot.playerId]));

    state.roster.hitters = hitterSlotDefinitions.map((slot) => ({ ...slot, playerId: hitterBySlot.get(slot.id) || null }));
    state.roster.pitchers = pitcherSlotDefinitions.map((slot) => ({
      ...slot,
      playerId: pitcherBySlot.get(slot.id) || null,
    }));
  } catch (_error) {
    state.roster.hitters = hitterSlotDefinitions.map((slot) => ({ ...slot, playerId: null }));
    state.roster.pitchers = pitcherSlotDefinitions.map((slot) => ({ ...slot, playerId: null }));
  }
}

function addToRoster(type, playerId) {
  if (isSelected(type, playerId)) {
    return;
  }

  const record = findRecordById(type, playerId);
  if (!record) {
    return;
  }

  const eligible = type === "pitcher" ? eligiblePitcherSlotIds(record) : eligibleHitterSlotIds(record);
  const openSlot = slotsForType(type).find((slot) => !slot.playerId && eligible.includes(slot.id));

  if (!openSlot) {
    return;
  }

  openSlot.playerId = playerId;
  saveRoster();
  renderRosterBuilder();
  applyHitterFilters();
  applyPitcherFilters();
}

function removeFromRoster(type, playerId) {
  const slot = slotsForType(type).find((candidate) => String(candidate.playerId) === String(playerId));
  if (!slot) {
    return;
  }

  slot.playerId = null;
  saveRoster();
  renderRosterBuilder();
  applyHitterFilters();
  applyPitcherFilters();
}

function removeFromSlot(type, slotId) {
  const slot = slotsForType(type).find((candidate) => candidate.id === slotId);
  if (!slot) {
    return;
  }

  slot.playerId = null;
  saveRoster();
  renderRosterBuilder();
  applyHitterFilters();
  applyPitcherFilters();
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
          <button class="slot-remove" data-type="${type}" data-slot-id="${slot.id}">Remove</button>
        </article>
      `;
    })
    .join("");
}

function renderRosterBuilder() {
  const hitterRecords = selectedRecords("hitter");
  const pitcherRecords = selectedRecords("pitcher");
  const fullRosterComplete =
    hitterRecords.length === hitterSlotDefinitions.length && pitcherRecords.length === pitcherSlotDefinitions.length;

  rosterStatus.textContent = `${hitterRecords.length} / ${hitterSlotDefinitions.length} hitters · ${pitcherRecords.length} / ${pitcherSlotDefinitions.length} pitchers`;
  renderSlotCards("hitter", rosterHitterSlots, state.roster.hitters);
  renderSlotCards("pitcher", rosterPitcherSlots, state.roster.pitchers);

  if (!hitterRecords.length && !pitcherRecords.length) {
    rosterSummaryCards.innerHTML = `
      <article class="card">
        <span class="card-label">Roster Build</span>
        <div class="card-value">Start Drafting</div>
        <div class="card-subtext">Select hitters and pitchers from the boards to model a full season.</div>
      </article>
    `;
    rosterAssumption.textContent =
      "Formula: runs scored comes from scaled hitter wOBA; runs allowed comes from scaled pitcher projected runs allowed; wins use a 1.83 Pythagorean exponent.";
    rosterTeamStats.innerHTML = "";
    return;
  }

  const projection = rosterProjection(hitterRecords, pitcherRecords);
  const summaryCardsMarkup = [
    {
      label: "Selected Hitter WAR",
      value: formatNumber(projection.hitterWar, 1),
      subtext: "Offensive roster contribution",
    },
    {
      label: "Selected Pitcher WAR",
      value: formatNumber(projection.pitcherWar, 1),
      subtext: "Staff contribution from selected pitchers",
    },
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

  rosterSummaryCards.innerHTML = summaryCardsMarkup
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

  rosterAssumption.textContent =
    "Formula: runs scored = 6,200 PA scaled from selected hitter wOBA; runs allowed = selected pitcher projected runs allowed scaled to 1,458 innings; wins use a 1.83 Pythagorean exponent.";

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

  rosterTeamStats.innerHTML = teamStats
    .map(
      (stat) => `
        <article class="stat-chip">
          <span class="stat-chip-label">${stat.label}</span>
          <div class="stat-chip-value">${stat.value}</div>
        </article>
      `,
    )
    .join("");
}

function populateTeamFilters() {
  const teams = [...new Set([...state.hitters, ...state.pitchers].map(teamLabel))].sort();

  for (const filter of [hitterTeamFilter, pitcherTeamFilter]) {
    filter.innerHTML = `<option value="ALL">All Teams</option>`;
    for (const team of teams) {
      const option = document.createElement("option");
      option.value = team;
      option.textContent = team;
      filter.append(option);
    }
  }
}

function updateHitterSummary(records) {
  const totalWar = records.reduce((sum, record) => sum + (Number(record.projected_value_war_proxy) || 0), 0);
  const bestFit = records[0];

  const cards = [
    {
      label: "Hitters",
      value: records.length,
      subtext: "Current filtered population",
    },
    {
      label: "Avg Team Build",
      value: formatNumber(average(records, "team_building_value_score"), 1),
      subtext: "Composite roster-construction score",
    },
    {
      label: "Avg Upside",
      value: formatNumber(average(records, "upside_score"), 1),
      subtext: "Ceiling across the active pool",
    },
    {
      label: "Avg Floor",
      value: formatNumber(average(records, "floor_score"), 1),
      subtext: "Stability plus lineup utility",
    },
    {
      label: "Projected WAR",
      value: formatNumber(totalWar, 1),
      subtext: "Sum of WAR proxy in the current slice",
    },
    {
      label: "Top Fit",
      value: bestFit ? bestFit.player_name : "-",
      subtext: bestFit
        ? `${bestFit.roster_role} · ${teamLabel(bestFit)} · ${formatNumber(bestFit.team_building_value_score, 1)}`
        : "No matching rows",
    },
  ];

  summaryCards.innerHTML = cards
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
}

function updateTeamPanel(records) {
  const selectedTeam = hitterTeamFilter.value;

  if (selectedTeam === "ALL") {
    teamTitle.textContent = "All Hitter Pools";
    teamCopy.textContent =
      "Use the hitter board to compare talent, playing time, upside, and risk before slotting bats into the roster build.";
    teamMetrics.innerHTML = `
      <article class="card">
        <span class="card-label">Teams</span>
        <div class="card-value">${new Set(state.hitters.map(teamLabel)).size}</div>
        <div class="card-subtext">Distinct clubs in the current hitter file</div>
      </article>
      <article class="card">
        <span class="card-label">Avg Talent</span>
        <div class="card-value">${formatNumber(average(records, "blended_talent_score"), 1)}</div>
        <div class="card-subtext">Prior plus in-season offensive signal</div>
      </article>
      <article class="card">
        <span class="card-label">Avg PT</span>
        <div class="card-value">${formatNumber(average(records, "blended_playing_time_score"), 1)}</div>
        <div class="card-subtext">Expected lineup access and role stability</div>
      </article>
      <article class="card">
        <span class="card-label">Avg Starter</span>
        <div class="card-value">${formatNumber(average(records, "starter_probability_score"), 1)}</div>
        <div class="card-subtext">Likelihood of holding a regular role</div>
      </article>
      <article class="card">
        <span class="card-label">Avg Platoon Risk</span>
        <div class="card-value">${formatNumber(average(records, "platoon_risk_score"), 1)}</div>
        <div class="card-subtext">Higher means more role fragility</div>
      </article>
    `;
  } else {
    const teamRecords = state.hitters.filter((record) => teamLabel(record) === selectedTeam);
    const topTeamBat = [...teamRecords].sort(
      (a, b) => Number(b.team_building_value_score) - Number(a.team_building_value_score),
    )[0];

    teamTitle.textContent = selectedTeam;
    teamCopy.textContent = topTeamBat
      ? `${topTeamBat.player_name} is the top hitter fit on this club at ${formatNumber(
          topTeamBat.team_building_value_score,
          1,
        )}. Role: ${topTeamBat.roster_role}.`
      : "No rows for this team.";

    teamMetrics.innerHTML = `
      <article class="card">
        <span class="card-label">Avg Team Build</span>
        <div class="card-value">${formatNumber(average(teamRecords, "team_building_value_score"), 1)}</div>
        <div class="card-subtext">Composite roster score</div>
      </article>
      <article class="card">
        <span class="card-label">Projected WAR</span>
        <div class="card-value">${formatNumber(average(teamRecords, "projected_value_war_proxy"), 2)}</div>
        <div class="card-subtext">Average player WAR proxy</div>
      </article>
      <article class="card">
        <span class="card-label">Avg Upside</span>
        <div class="card-value">${formatNumber(average(teamRecords, "upside_score"), 1)}</div>
        <div class="card-subtext">Ceiling if roles hold</div>
      </article>
      <article class="card">
        <span class="card-label">Avg Floor</span>
        <div class="card-value">${formatNumber(average(teamRecords, "floor_score"), 1)}</div>
        <div class="card-subtext">Safer lineup utility</div>
      </article>
      <article class="card">
        <span class="card-label">Avg Stability</span>
        <div class="card-value">${formatNumber(average(teamRecords, "stability_score"), 1)}</div>
        <div class="card-subtext">Sample and role reliability</div>
      </article>
    `;
  }

  const leaders = [...records]
    .sort((a, b) => Number(b.team_building_value_score) - Number(a.team_building_value_score))
    .slice(0, 3);

  teamLeadersList.innerHTML = leaders.length
    ? leaders
        .map(
          (record, index) => `
            <article class="leader-card">
              <span class="leader-rank">#${index + 1}</span>
              <strong>${record.player_name}</strong>
              <div class="leader-line">${record.roster_role} · ${teamLabel(record)} · ${record.roster_position || "-"}</div>
              <div class="leader-line">Build ${formatNumber(record.team_building_value_score, 1)} · Talent ${formatNumber(
                record.blended_talent_score,
                1,
              )} · PT ${formatNumber(record.blended_playing_time_score, 1)}</div>
            </article>
          `,
        )
        .join("")
    : `<article class="leader-card"><strong>No matching hitters</strong><div class="leader-line">Adjust the filters to populate this panel.</div></article>`;
}

function updatePitcherSummary(records) {
  const totalWar = records.reduce((sum, record) => sum + (Number(record.projected_war) || 0), 0);
  const topArm = records[0];

  const cards = [
    {
      label: "Pitchers",
      value: records.length,
      subtext: "Current filtered staff pool",
    },
    {
      label: "Avg Team Build",
      value: formatNumber(average(records, "team_building_value_score"), 1),
      subtext: "Counting stats plus pitch-quality signal",
    },
    {
      label: "Avg Run Prevention",
      value: formatNumber(average(records, "blended_run_prevention_score"), 1),
      subtext: "Prior plus current performance blend",
    },
    {
      label: "Avg Pitch Quality",
      value: formatNumber(average(records, "blended_pitch_quality_score"), 1),
      subtext: "Historical Statcast-driven pitch quality",
    },
    {
      label: "Projected WAR",
      value: formatNumber(totalWar, 1),
      subtext: "Sum of projected pitcher WAR",
    },
    {
      label: "Top Arm",
      value: topArm ? topArm.player_name : "-",
      subtext: topArm
        ? `${topArm.roster_role} · ${teamLabel(topArm)} · ${formatNumber(topArm.team_building_value_score, 1)}`
        : "No matching rows",
    },
  ];

  pitcherSummaryCards.innerHTML = cards
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
}

function renderHitterTable(records) {
  if (!records.length) {
    projectionRows.innerHTML = `<tr><td class="empty" colspan="16">No hitters match the current filters.</td></tr>`;
    return;
  }

  projectionRows.innerHTML = records
    .map((record) => {
      const selected = isSelected("hitter", record.fg_player_id);
      const rosterFull = selectedRecords("hitter").length >= hitterSlotDefinitions.length;
      const canAdd = !selected && !rosterFull;
      const buttonClass = selected ? "pick-button is-selected" : canAdd ? "pick-button" : "pick-button is-disabled";
      const buttonLabel = selected ? "Selected" : canAdd ? "Add" : "Full";

      return `
        <tr>
          <td>
            <button class="${buttonClass}" data-type="hitter" data-player-id="${record.fg_player_id}">
              ${buttonLabel}
            </button>
          </td>
          <td>
            <div class="player-cell">
              <strong>${record.player_name}</strong>
              <span class="player-meta">${record.archetype || "unknown"} · ${record.position_bucket || "unknown"} · wOBA diff ${formatNumber(
                record.current_woba_diff,
                3,
              )}</span>
            </div>
          </td>
          <td>${teamLabel(record)}</td>
          <td>${record.roster_role || "-"}</td>
          <td>${record.roster_position || "-"}</td>
          <td>${formatNumber(record.team_building_value_score, 1)}</td>
          <td>${formatNumber(record.blended_talent_score, 1)}</td>
          <td>${formatNumber(record.blended_playing_time_score, 1)}</td>
          <td>${formatNumber(record.upside_score, 1)}</td>
          <td>${formatNumber(record.floor_score, 1)}</td>
          <td>${formatNumber(record.starter_probability_score, 1)}</td>
          <td>${formatNumber(record.stability_score, 1)}</td>
          <td>${formatNumber(record.platoon_risk_score, 1)}</td>
          <td>${formatNumber(record.current_woba, 3)}</td>
          <td>${formatNumber(record.projected_woba, 3)}</td>
          <td>${formatNumber(record.pace_pa_162, 1)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderPitcherTable(records) {
  if (!records.length) {
    pitcherRows.innerHTML = `<tr><td class="empty" colspan="15">No pitchers match the current filters.</td></tr>`;
    return;
  }

  pitcherRows.innerHTML = records
    .map((record) => {
      const selected = isSelected("pitcher", record.fg_player_id);
      const rosterFull = selectedRecords("pitcher").length >= pitcherSlotDefinitions.length;
      const canAdd = !selected && !rosterFull;
      const buttonClass = selected ? "pick-button is-selected" : canAdd ? "pick-button" : "pick-button is-disabled";
      const buttonLabel = selected ? "Selected" : canAdd ? "Add" : "Full";

      return `
        <tr>
          <td>
            <button class="${buttonClass}" data-type="pitcher" data-player-id="${record.fg_player_id}">
              ${buttonLabel}
            </button>
          </td>
          <td>
            <div class="player-cell">
              <strong>${record.player_name}</strong>
              <span class="player-meta">${record.projected_role_bucket} · ERA diff ${formatNumber(
                record.current_era_diff,
                2,
              )} · Stuff+ ${formatNumber(record.projected_stuff_plus_base, 1)}</span>
            </div>
          </td>
          <td>${teamLabel(record)}</td>
          <td>${record.roster_role || "-"}</td>
          <td>${formatNumber(record.team_building_value_score, 1)}</td>
          <td>${formatNumber(record.blended_run_prevention_score, 1)}</td>
          <td>${formatNumber(record.blended_pitch_quality_score, 1)}</td>
          <td>${formatNumber(record.blended_playing_time_score, 1)}</td>
          <td>${formatNumber(record.upside_score, 1)}</td>
          <td>${formatNumber(record.floor_score, 1)}</td>
          <td>${formatNumber(record.projected_era, 2)}</td>
          <td>${formatNumber(record.projected_ip, 1)}</td>
          <td>${formatInteger(record.projected_strikeouts)}</td>
          <td>${formatNumber(record.current_era, 2)}</td>
          <td>${formatNumber(record.pace_ip_162, 1)}</td>
        </tr>
      `;
    })
    .join("");
}

function applyHitterFilters() {
  const selectedTeam = hitterTeamFilter.value;
  const searchTerm = hitterSearchFilter.value.trim().toLowerCase();
  const minPa = hitterMinPaFilter.value.trim() === "" ? 0 : Number(hitterMinPaFilter.value) || 0;
  const sortKey = hitterSortKeyFilter.value;

  state.filteredHitters = state.hitters
    .filter((record) => selectedTeam === "ALL" || teamLabel(record) === selectedTeam)
    .filter((record) => record.player_name.toLowerCase().includes(searchTerm))
    .filter((record) => {
      const comparisonPa = Number(record.current_pa ?? record.projected_pa ?? 0);
      return comparisonPa >= minPa;
    })
    .sort((a, b) => {
      const left = Number(a[sortKey]);
      const right = Number(b[sortKey]);
      return (Number.isNaN(right) ? -Infinity : right) - (Number.isNaN(left) ? -Infinity : left);
    });

  updateHitterSummary(state.filteredHitters);
  updateTeamPanel(state.filteredHitters);
  renderHitterTable(state.filteredHitters);
}

function applyPitcherFilters() {
  const selectedTeam = pitcherTeamFilter.value;
  const searchTerm = pitcherSearchFilter.value.trim().toLowerCase();
  const minIp = pitcherMinIpFilter.value.trim() === "" ? 0 : Number(pitcherMinIpFilter.value) || 0;
  const sortKey = pitcherSortKeyFilter.value;

  state.filteredPitchers = state.pitchers
    .filter((record) => selectedTeam === "ALL" || teamLabel(record) === selectedTeam)
    .filter((record) => record.player_name.toLowerCase().includes(searchTerm))
    .filter((record) => {
      const comparisonIp = Number(record.current_ip ?? record.projected_ip ?? 0);
      return comparisonIp >= minIp;
    })
    .sort((a, b) => {
      const left = Number(a[sortKey]);
      const right = Number(b[sortKey]);
      return (Number.isNaN(right) ? -Infinity : right) - (Number.isNaN(left) ? -Infinity : left);
    });

  updatePitcherSummary(state.filteredPitchers);
  renderPitcherTable(state.filteredPitchers);
}

async function init() {
  const [hittersResponse, pitchersResponse] = await Promise.all([fetch(hitterDataUrl), fetch(pitcherDataUrl)]);
  state.hitters = await hittersResponse.json();
  state.pitchers = await pitchersResponse.json();
  restoreRoster();
  populateTeamFilters();
  renderRosterBuilder();
  applyHitterFilters();
  applyPitcherFilters();
}

hitterTeamFilter.addEventListener("change", applyHitterFilters);
hitterSearchFilter.addEventListener("input", applyHitterFilters);
hitterMinPaFilter.addEventListener("input", applyHitterFilters);
hitterSortKeyFilter.addEventListener("change", applyHitterFilters);

pitcherTeamFilter.addEventListener("change", applyPitcherFilters);
pitcherSearchFilter.addEventListener("input", applyPitcherFilters);
pitcherMinIpFilter.addEventListener("input", applyPitcherFilters);
pitcherSortKeyFilter.addEventListener("change", applyPitcherFilters);

for (const tableBody of [projectionRows, pitcherRows]) {
  tableBody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const playerId = target.dataset.playerId;
    const type = target.dataset.type;
    if (!playerId || !type) {
      return;
    }

    if (isSelected(type, playerId)) {
      removeFromRoster(type, playerId);
      return;
    }

    addToRoster(type, playerId);
  });
}

for (const slotContainer of [rosterHitterSlots, rosterPitcherSlots]) {
  slotContainer.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const slotId = target.dataset.slotId;
    const type = target.dataset.type;
    if (!slotId || !type) {
      return;
    }

    removeFromSlot(type, slotId);
  });
}

init().catch((error) => {
  summaryCards.innerHTML = "";
  pitcherSummaryCards.innerHTML = "";
  projectionRows.innerHTML = `<tr><td class="empty" colspan="16">Failed to load hitter data: ${error.message}</td></tr>`;
  pitcherRows.innerHTML = `<tr><td class="empty" colspan="15">Failed to load pitcher data: ${error.message}</td></tr>`;
});
