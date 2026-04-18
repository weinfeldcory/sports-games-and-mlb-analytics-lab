import { canCompare, isCompared } from "./compare.js";
import { hitterSlotDefinitions } from "./config.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import { isSelected, selectedRecords, swapTarget } from "./roster.js";
import { average, formatNumber, recordKey, teamLabel } from "./utils.js";

const hitterSortLabels = {
  team_building_value_score: "team-building value",
  blended_talent_score: "blended talent",
  blended_playing_time_score: "blended playing time",
  starter_probability_score: "starter probability",
  upside_score: "upside",
  floor_score: "floor",
  stability_score: "stability",
  platoon_risk_score: "platoon risk",
  projected_value_war_proxy: "projected WAR proxy",
  current_woba: "current wOBA",
  pace_home_runs_162: "162-game HR pace",
  pace_stolen_bases_162: "162-game SB pace",
  pace_pa_162: "162-game PA pace",
};

const hitterDecisionColumns = [
  { label: "Player", render: (record) => `
    <div class="player-cell">
      <strong>${record.player_name}</strong>
      <span class="player-meta">${record.archetype || "unknown"} · ${record.position_bucket || "unknown"} · wOBA diff ${formatNumber(record.current_woba_diff, 3)}</span>
    </div>
  ` },
  { label: "Team", render: (record) => teamLabel(record) },
  { label: "Role", render: (record) => record.roster_role || "-" },
  { label: "Pos", render: (record) => record.roster_position || "-" },
  { label: "Team Build", render: (record) => formatNumber(record.team_building_value_score, 1) },
  { label: "Talent", render: (record) => formatNumber(record.blended_talent_score, 1) },
  { label: "PT", render: (record) => formatNumber(record.blended_playing_time_score, 1) },
  { label: "Upside", render: (record) => formatNumber(record.upside_score, 1) },
  { label: "Floor", render: (record) => formatNumber(record.floor_score, 1) },
  { label: "Starter", render: (record) => formatNumber(record.starter_probability_score, 1) },
  { label: "Stability", render: (record) => formatNumber(record.stability_score, 1) },
  { label: "Platoon Risk", render: (record) => formatNumber(record.platoon_risk_score, 1) },
  { label: "Curr wOBA", render: (record) => formatNumber(record.current_woba, 3) },
  { label: "Proj wOBA", render: (record) => formatNumber(record.projected_woba, 3) },
  { label: "162G PA", render: (record) => formatNumber(record.pace_pa_162, 1) },
];

const hitterProjectionColumns = [
  { label: "Proj G", render: (record) => formatNumber(record.projected_games, 0) },
  { label: "Proj PA", render: (record) => formatNumber(record.projected_pa, 0) },
  { label: "Proj H", render: (record) => formatNumber(record.projected_hits, 0) },
  { label: "Proj 2B", render: (record) => formatNumber(record.projected_doubles, 0) },
  { label: "Proj 3B", render: (record) => formatNumber(record.projected_triples, 0) },
  { label: "Proj HR", render: (record) => formatNumber(record.projected_home_runs, 0) },
  { label: "Proj SB", render: (record) => formatNumber(record.projected_stolen_bases, 0) },
  { label: "Proj BB", render: (record) => formatNumber(record.projected_walks, 0) },
  { label: "Proj K", render: (record) => formatNumber(record.projected_strikeouts, 0) },
  { label: "Proj AVG", render: (record) => formatNumber(record.projected_avg, 3) },
  { label: "Proj OBP", render: (record) => formatNumber(record.projected_obp, 3) },
  { label: "Proj SLG", render: (record) => formatNumber(record.projected_slg, 3) },
  { label: "Proj OPS", render: (record) => formatNumber(record.projected_ops, 3) },
  { label: "Proj wOBA", render: (record) => formatNumber(record.projected_woba, 3) },
  { label: "Proj wOBA+", render: (record) => formatNumber(record.projected_woba_plus, 0) },
];

function hitterStatView() {
  return dom.hitterStatView?.value || "decision";
}

function hitterRowLimit() {
  return dom.hitterRowLimit?.value || "25";
}

function hitterColumns() {
  const statView = hitterStatView();
  if (statView === "projection") {
    return hitterProjectionColumns;
  }

  if (statView === "all") {
    return [...hitterDecisionColumns, ...hitterProjectionColumns];
  }

  return hitterDecisionColumns;
}

function renderHitterHead() {
  if (!dom.hitterTableHead) {
    return;
  }
  const columns = hitterColumns();
  dom.hitterTableHead.innerHTML = `
    <tr>
      <th>Pick</th>
      <th>Compare</th>
      ${columns.map((column) => `<th>${column.label}</th>`).join("")}
    </tr>
  `;
}

export function updateHitterSummary(records) {
  const totalWar = records.reduce((sum, record) => sum + (Number(record.projected_value_war_proxy) || 0), 0);
  const bestFit = records[0];

  const cards = [
    { label: "Hitters", value: records.length, subtext: "Current filtered population" },
    { label: "Avg Team Build", value: formatNumber(average(records, "team_building_value_score"), 1), subtext: "Composite roster-construction score" },
    { label: "Avg Upside", value: formatNumber(average(records, "upside_score"), 1), subtext: "Ceiling across the active pool" },
    { label: "Avg Floor", value: formatNumber(average(records, "floor_score"), 1), subtext: "Stability plus lineup utility" },
    { label: "Projected WAR", value: formatNumber(totalWar, 1), subtext: "Sum of WAR proxy in the current slice" },
    {
      label: "Top Fit",
      value: bestFit ? bestFit.player_name : "-",
      subtext: bestFit ? `${bestFit.roster_role} · ${teamLabel(bestFit)} · ${formatNumber(bestFit.team_building_value_score, 1)}` : "No matching rows",
    },
  ];

  dom.summaryCards.innerHTML = cards
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

export function updateHitterGuide(records) {
  if (!dom.hitterGuide) {
    return;
  }
  const sortKey = dom.hitterSortKeyFilter.value;
  const sortLabel = hitterSortLabels[sortKey] || sortKey;
  const searchTerm = dom.hitterSearchFilter.value.trim();
  const selectedTeam = dom.hitterTeamFilter.value;
  const selectedPosition = dom.hitterPositionFilter?.value || "ALL";
  const minPa = Number(dom.hitterMinPaFilter.value) || 0;
  const topFit = records[0];
  const safestRegular = [...records]
    .sort((a, b) => Number(b.starter_probability_score) + Number(b.floor_score) - (Number(a.starter_probability_score) + Number(a.floor_score)))
    [0];
  const bestUpside = [...records].sort((a, b) => Number(b.upside_score) - Number(a.upside_score))[0];

  const activeFilters = [
    selectedTeam === "ALL" ? "all teams" : selectedTeam,
    selectedPosition === "ALL" ? "all positions" : selectedPosition,
    searchTerm ? `search: ${searchTerm}` : "all names",
    minPa > 0 ? `min ${minPa} PA` : "no PA floor",
    `sorted by ${sortLabel}`,
    hitterRowLimit() === "ALL" ? "all rows visible" : `showing top ${hitterRowLimit()}`,
  ];

  dom.hitterGuide.innerHTML = `
    <div class="insight-header">
      <div>
        <p class="eyebrow">Reading Guide</p>
        <h3>What This Hitter Slice Says</h3>
      </div>
      <div class="filter-chips">
        ${activeFilters.map((label) => `<span class="filter-chip">${label}</span>`).join("")}
      </div>
    </div>
    <div class="insight-grid">
      <article class="insight-card">
        <span class="card-label">Best Current Fit</span>
        <div class="card-value">${topFit ? topFit.player_name : "-"}</div>
        <div class="card-subtext">${
          topFit
            ? `${topFit.roster_role || "role open"} · ${teamLabel(topFit)} · Build ${formatNumber(topFit.team_building_value_score, 1)}`
            : "No hitters match the current slice."
        }</div>
      </article>
      <article class="insight-card">
        <span class="card-label">Safest Regular</span>
        <div class="card-value">${safestRegular ? safestRegular.player_name : "-"}</div>
        <div class="card-subtext">${
          safestRegular
            ? `Starter ${formatNumber(safestRegular.starter_probability_score, 1)} · Floor ${formatNumber(safestRegular.floor_score, 1)}`
            : "Need matching hitters to estimate role safety."
        }</div>
      </article>
      <article class="insight-card">
        <span class="card-label">Biggest Ceiling</span>
        <div class="card-value">${bestUpside ? bestUpside.player_name : "-"}</div>
        <div class="card-subtext">${
          bestUpside
            ? `Upside ${formatNumber(bestUpside.upside_score, 1)} · PT ${formatNumber(bestUpside.blended_playing_time_score, 1)}`
            : "Need matching hitters to estimate upside."
        }</div>
      </article>
      <article class="insight-card">
        <span class="card-label">How To Use This Board</span>
        <div class="insight-copy">Start with the best current fit, compare two bats, then use floor and platoon risk to separate exciting names from stable lineup answers.</div>
      </article>
    </div>
  `;
}

export function updateTeamPanel(records) {
  const selectedTeam = dom.hitterTeamFilter.value;

  if (selectedTeam === "ALL") {
    dom.teamTitle.textContent = "All Hitter Pools";
    dom.teamCopy.textContent =
      "Use the hitter board to compare talent, playing time, upside, and risk before slotting bats into the roster build.";
    dom.teamMetrics.innerHTML = `
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

    dom.teamTitle.textContent = selectedTeam;
    dom.teamCopy.textContent = topTeamBat
      ? `${topTeamBat.player_name} is the top hitter fit on this club at ${formatNumber(topTeamBat.team_building_value_score, 1)}. Role: ${topTeamBat.roster_role}.`
      : "No rows for this team.";

    dom.teamMetrics.innerHTML = `
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

  const leaders = [...records].sort((a, b) => Number(b.team_building_value_score) - Number(a.team_building_value_score)).slice(0, 3);

  dom.teamLeadersList.innerHTML = leaders.length
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

function visibleRows(records) {
  const rowLimit = hitterRowLimit();
  if (rowLimit === "ALL") {
    return records;
  }

  const limit = Number(rowLimit);
  return Number.isNaN(limit) ? records : records.slice(0, limit);
}

function updateHitterTableStatus(filteredRecords, visibleRecords) {
  if (!dom.hitterTableStatus) {
    return;
  }
  const sortKey = dom.hitterSortKeyFilter.value;
  const sortLabel = hitterSortLabels[sortKey] || sortKey;
  const statViewLabel =
    hitterStatView() === "projection" ? "projected stats" : hitterStatView() === "all" ? "all stats" : "decision stats";
  const total = filteredRecords.length;
  const visible = visibleRecords.length;

  dom.hitterTableStatus.textContent =
    total === 0
      ? "No hitters match the current slice."
      : visible === total
        ? `Showing all ${total} hitters in the current slice with ${statViewLabel}, ranked by ${sortLabel}.`
        : `Showing top ${visible} of ${total} hitters in the current slice with ${statViewLabel}, ranked by ${sortLabel}. Increase Rows to scan deeper.`;
}

export function renderHitterTable(records) {
  renderHitterHead();

  if (!records.length) {
    dom.projectionRows.innerHTML = `<tr><td class="empty" colspan="${hitterColumns().length + 2}">No hitters match the current filters.</td></tr>`;
    return;
  }

  const columns = hitterColumns();
  dom.projectionRows.innerHTML = records
    .map((record) => {
      const playerId = recordKey("hitter", record);
      const selected = isSelected("hitter", playerId);
      const target = swapTarget("hitter", playerId);
      const rosterFull = selectedRecords("hitter").length >= hitterSlotDefinitions.length;
      const canAdd = !selected && !rosterFull;
      const canSwap = !selected && !!target;
      const buttonClass = selected ? "pick-button is-selected" : canAdd ? "pick-button" : "pick-button is-disabled";
      const swapClass = canSwap ? "pick-button swap-button" : buttonClass;
      const buttonLabel = selected ? "Selected" : canAdd ? "Add" : canSwap ? `Swap ${target.slot.id}` : "Full";
      const compared = isCompared("hitter", playerId);
      const canToggleCompare = canCompare("hitter", playerId);
      const compareClass = compared ? "pick-button is-selected" : canToggleCompare ? "pick-button compare-button" : "pick-button is-disabled";
      const compareLabel = compared ? "Comparing" : canToggleCompare ? "Compare" : "Full";

      return `
        <tr>
          <td>
            <button type="button" class="${canSwap ? swapClass : buttonClass}" data-action="toggle-roster" data-type="hitter" data-player-id="${playerId}">
              ${buttonLabel}
            </button>
          </td>
          <td>
            <button type="button" class="${compareClass}" data-action="toggle-compare" data-type="hitter" data-player-id="${playerId}">
              ${compareLabel}
            </button>
          </td>
          ${columns.map((column) => `<td>${column.render(record)}</td>`).join("")}
        </tr>
      `;
    })
    .join("");
}

export function applyHitterFilters() {
  const selectedTeam = dom.hitterTeamFilter.value;
  const selectedPosition = dom.hitterPositionFilter?.value || "ALL";
  const searchTerm = dom.hitterSearchFilter.value.trim().toLowerCase();
  const minPa = dom.hitterMinPaFilter.value.trim() === "" ? 0 : Number(dom.hitterMinPaFilter.value) || 0;
  const sortKey = dom.hitterSortKeyFilter.value;

  state.filteredHitters = state.hitters
    .filter((record) => selectedTeam === "ALL" || teamLabel(record) === selectedTeam)
    .filter((record) => selectedPosition === "ALL" || String(record.roster_position || "").trim() === selectedPosition)
    .filter((record) => record.player_name.toLowerCase().includes(searchTerm))
    .filter((record) => Number(record.current_pa ?? record.projected_pa ?? 0) >= minPa)
    .sort((a, b) => {
      const left = Number(a[sortKey]);
      const right = Number(b[sortKey]);
      return (Number.isNaN(right) ? -Infinity : right) - (Number.isNaN(left) ? -Infinity : left);
    });

  const visibleHitters = visibleRows(state.filteredHitters);
  updateHitterSummary(state.filteredHitters);
  updateHitterGuide(state.filteredHitters);
  updateTeamPanel(state.filteredHitters);
  updateHitterTableStatus(state.filteredHitters, visibleHitters);
  renderHitterTable(visibleHitters);
}
