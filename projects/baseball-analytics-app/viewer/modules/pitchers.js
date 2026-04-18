import { canCompare, isCompared } from "./compare.js";
import { pitcherSlotDefinitions } from "./config.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import { isSelected, selectedRecords, swapTarget } from "./roster.js";
import { average, formatInteger, formatNumber, recordKey, teamLabel } from "./utils.js";

const pitcherSortLabels = {
  team_building_value_score: "team-building value",
  blended_run_prevention_score: "run prevention",
  blended_pitch_quality_score: "pitch quality",
  blended_playing_time_score: "playing time",
  upside_score: "upside",
  floor_score: "floor",
  projected_war: "projected WAR",
  projected_era: "projected ERA",
  projected_ip: "projected innings",
  pace_ip_162: "162-game IP pace",
  pace_runs_allowed_162: "162-game runs-allowed pace",
};

const pitcherDecisionColumns = [
  { label: "Pitcher", render: (record) => `
    <div class="player-cell">
      <strong>${record.player_name}</strong>
      <span class="player-meta">${record.projected_role_bucket} · ERA diff ${formatNumber(record.current_era_diff, 2)} · Stuff+ ${formatNumber(record.projected_stuff_plus_base, 1)}</span>
    </div>
  ` },
  { label: "Team", render: (record) => teamLabel(record) },
  { label: "Role", render: (record) => record.roster_role || "-" },
  { label: "Team Build", render: (record) => formatNumber(record.team_building_value_score, 1) },
  { label: "Run Prev", render: (record) => formatNumber(record.blended_run_prevention_score, 1) },
  { label: "Pitch Quality", render: (record) => formatNumber(record.blended_pitch_quality_score, 1) },
  { label: "PT", render: (record) => formatNumber(record.blended_playing_time_score, 1) },
  { label: "Upside", render: (record) => formatNumber(record.upside_score, 1) },
  { label: "Floor", render: (record) => formatNumber(record.floor_score, 1) },
  { label: "Proj ERA", render: (record) => formatNumber(record.projected_era, 2) },
  { label: "Proj IP", render: (record) => formatNumber(record.projected_ip, 1) },
  { label: "Proj K", render: (record) => formatInteger(record.projected_strikeouts) },
  { label: "Curr ERA", render: (record) => formatNumber(record.current_era, 2) },
  { label: "162G IP", render: (record) => formatNumber(record.pace_ip_162, 1) },
];

const pitcherProjectionColumns = [
  { label: "Proj W", render: (record) => formatNumber(record.projected_wins, 1) },
  { label: "Proj L", render: (record) => formatNumber(record.projected_losses, 1) },
  { label: "Proj G", render: (record) => formatNumber(record.projected_games_base, 0) },
  { label: "Proj GS", render: (record) => formatNumber(record.projected_starts, 1) },
  { label: "Proj SV", render: (record) => formatNumber(record.projected_saves, 1) },
  { label: "Proj IP", render: (record) => formatNumber(record.projected_ip, 1) },
  { label: "Proj H", render: (record) => formatNumber(record.projected_hits_allowed, 0) },
  { label: "Proj ER", render: (record) => formatNumber(record.projected_earned_runs, 1) },
  { label: "Proj R", render: (record) => formatNumber(record.projected_runs_allowed, 1) },
  { label: "Proj HR", render: (record) => formatNumber(record.projected_home_runs_allowed, 0) },
  { label: "Proj BB", render: (record) => formatNumber(record.projected_walks, 0) },
  { label: "Proj K", render: (record) => formatInteger(record.projected_strikeouts) },
  { label: "Proj ERA", render: (record) => formatNumber(record.projected_era, 2) },
  { label: "Proj WHIP", render: (record) => formatNumber(record.projected_whip, 2) },
  { label: "Proj FIP", render: (record) => formatNumber(record.projected_fip, 2) },
  { label: "Proj xFIP", render: (record) => formatNumber(record.projected_xfip, 2) },
  { label: "Proj xERA", render: (record) => formatNumber(record.projected_xera, 2) },
  { label: "Proj WAR", render: (record) => formatNumber(record.projected_war, 1) },
];

function pitcherStatView() {
  return dom.pitcherStatView?.value || "decision";
}

function pitcherRowLimit() {
  return dom.pitcherRowLimit?.value || "25";
}

function pitcherColumns() {
  const statView = pitcherStatView();
  if (statView === "projection") {
    return pitcherProjectionColumns;
  }

  if (statView === "all") {
    return [...pitcherDecisionColumns, ...pitcherProjectionColumns];
  }

  return pitcherDecisionColumns;
}

function renderPitcherHead() {
  if (!dom.pitcherTableHead) {
    return;
  }
  const columns = pitcherColumns();
  dom.pitcherTableHead.innerHTML = `
    <tr>
      <th>Pick</th>
      <th>Compare</th>
      ${columns.map((column) => `<th>${column.label}</th>`).join("")}
    </tr>
  `;
}

export function updatePitcherSummary(records) {
  const totalWar = records.reduce((sum, record) => sum + (Number(record.projected_war) || 0), 0);
  const topArm = records[0];

  const cards = [
    { label: "Pitchers", value: records.length, subtext: "Current filtered staff pool" },
    { label: "Avg Team Build", value: formatNumber(average(records, "team_building_value_score"), 1), subtext: "Counting stats plus pitch-quality signal" },
    { label: "Avg Run Prevention", value: formatNumber(average(records, "blended_run_prevention_score"), 1), subtext: "Prior plus current performance blend" },
    { label: "Avg Pitch Quality", value: formatNumber(average(records, "blended_pitch_quality_score"), 1), subtext: "Historical Statcast-driven pitch quality" },
    { label: "Projected WAR", value: formatNumber(totalWar, 1), subtext: "Sum of projected pitcher WAR" },
    {
      label: "Top Arm",
      value: topArm ? topArm.player_name : "-",
      subtext: topArm ? `${topArm.roster_role} · ${teamLabel(topArm)} · ${formatNumber(topArm.team_building_value_score, 1)}` : "No matching rows",
    },
  ];

  dom.pitcherSummaryCards.innerHTML = cards
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

export function updatePitcherGuide(records) {
  if (!dom.pitcherGuide) {
    return;
  }
  const sortKey = dom.pitcherSortKeyFilter.value;
  const sortLabel = pitcherSortLabels[sortKey] || sortKey;
  const searchTerm = dom.pitcherSearchFilter.value.trim();
  const selectedTeam = dom.pitcherTeamFilter.value;
  const selectedRole = dom.pitcherRoleFilter?.value || "ALL";
  const minIp = Number(dom.pitcherMinIpFilter.value) || 0;
  const topFit = records[0];
  const safestArm = [...records].sort((a, b) => Number(b.floor_score) + Number(b.blended_playing_time_score) - (Number(a.floor_score) + Number(a.blended_playing_time_score)))[0];
  const highestCeiling = [...records].sort((a, b) => Number(b.upside_score) - Number(a.upside_score))[0];

  const activeFilters = [
    selectedTeam === "ALL" ? "all teams" : selectedTeam,
    selectedRole === "ALL" ? "all roles" : selectedRole,
    searchTerm ? `search: ${searchTerm}` : "all names",
    minIp > 0 ? `min ${minIp} IP` : "no IP floor",
    `sorted by ${sortLabel}`,
    pitcherRowLimit() === "ALL" ? "all rows visible" : `showing top ${pitcherRowLimit()}`,
  ];

  dom.pitcherGuide.innerHTML = `
    <div class="insight-header">
      <div>
        <p class="eyebrow">Reading Guide</p>
        <h3>What This Staff Slice Says</h3>
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
            : "No pitchers match the current slice."
        }</div>
      </article>
      <article class="insight-card">
        <span class="card-label">Safest Volume</span>
        <div class="card-value">${safestArm ? safestArm.player_name : "-"}</div>
        <div class="card-subtext">${
          safestArm
            ? `Floor ${formatNumber(safestArm.floor_score, 1)} · PT ${formatNumber(safestArm.blended_playing_time_score, 1)}`
            : "Need matching pitchers to estimate safety."
        }</div>
      </article>
      <article class="insight-card">
        <span class="card-label">Highest Ceiling</span>
        <div class="card-value">${highestCeiling ? highestCeiling.player_name : "-"}</div>
        <div class="card-subtext">${
          highestCeiling
            ? `Upside ${formatNumber(highestCeiling.upside_score, 1)} · Run Prev ${formatNumber(highestCeiling.blended_run_prevention_score, 1)}`
            : "Need matching pitchers to estimate upside."
        }</div>
      </article>
      <article class="insight-card">
        <span class="card-label">How To Use This Board</span>
        <div class="insight-copy">Use run prevention to find current fit, compare two arms, then separate role-stable innings from high-octane but fragile profiles.</div>
      </article>
    </div>
  `;
}

function visibleRows(records) {
  const rowLimit = pitcherRowLimit();
  if (rowLimit === "ALL") {
    return records;
  }

  const limit = Number(rowLimit);
  return Number.isNaN(limit) ? records : records.slice(0, limit);
}

function updatePitcherTableStatus(filteredRecords, visibleRecords) {
  if (!dom.pitcherTableStatus) {
    return;
  }
  const sortKey = dom.pitcherSortKeyFilter.value;
  const sortLabel = pitcherSortLabels[sortKey] || sortKey;
  const statViewLabel =
    pitcherStatView() === "projection" ? "projected stats" : pitcherStatView() === "all" ? "all stats" : "decision stats";
  const total = filteredRecords.length;
  const visible = visibleRecords.length;

  dom.pitcherTableStatus.textContent =
    total === 0
      ? "No pitchers match the current slice."
      : visible === total
        ? `Showing all ${total} pitchers in the current slice with ${statViewLabel}, ranked by ${sortLabel}.`
        : `Showing top ${visible} of ${total} pitchers in the current slice with ${statViewLabel}, ranked by ${sortLabel}. Increase Rows to scan deeper.`;
}

export function renderPitcherTable(records) {
  renderPitcherHead();

  if (!records.length) {
    dom.pitcherRows.innerHTML = `<tr><td class="empty" colspan="${pitcherColumns().length + 2}">No pitchers match the current filters.</td></tr>`;
    return;
  }

  const columns = pitcherColumns();
  dom.pitcherRows.innerHTML = records
    .map((record) => {
      const playerId = recordKey("pitcher", record);
      const selected = isSelected("pitcher", playerId);
      const target = swapTarget("pitcher", playerId);
      const rosterFull = selectedRecords("pitcher").length >= pitcherSlotDefinitions.length;
      const canAdd = !selected && !rosterFull;
      const canSwap = !selected && !!target;
      const buttonClass = selected ? "pick-button is-selected" : canAdd ? "pick-button" : "pick-button is-disabled";
      const swapClass = canSwap ? "pick-button swap-button" : buttonClass;
      const buttonLabel = selected ? "Selected" : canAdd ? "Add" : canSwap ? `Swap ${target.slot.id}` : "Full";
      const compared = isCompared("pitcher", playerId);
      const canToggleCompare = canCompare("pitcher", playerId);
      const compareClass = compared ? "pick-button is-selected" : canToggleCompare ? "pick-button compare-button" : "pick-button is-disabled";
      const compareLabel = compared ? "Comparing" : canToggleCompare ? "Compare" : "Full";

      return `
        <tr>
          <td>
            <button type="button" class="${canSwap ? swapClass : buttonClass}" data-action="toggle-roster" data-type="pitcher" data-player-id="${playerId}">
              ${buttonLabel}
            </button>
          </td>
          <td>
            <button type="button" class="${compareClass}" data-action="toggle-compare" data-type="pitcher" data-player-id="${playerId}">
              ${compareLabel}
            </button>
          </td>
          ${columns.map((column) => `<td>${column.render(record)}</td>`).join("")}
        </tr>
      `;
    })
    .join("");
}

export function applyPitcherFilters() {
  const selectedTeam = dom.pitcherTeamFilter.value;
  const selectedRole = dom.pitcherRoleFilter?.value || "ALL";
  const searchTerm = dom.pitcherSearchFilter.value.trim().toLowerCase();
  const minIp = dom.pitcherMinIpFilter.value.trim() === "" ? 0 : Number(dom.pitcherMinIpFilter.value) || 0;
  const sortKey = dom.pitcherSortKeyFilter.value;

  state.filteredPitchers = state.pitchers
    .filter((record) => selectedTeam === "ALL" || teamLabel(record) === selectedTeam)
    .filter((record) => selectedRole === "ALL" || String(record.roster_role || record.projected_role_bucket || "").trim() === selectedRole)
    .filter((record) => record.player_name.toLowerCase().includes(searchTerm))
    .filter((record) => Number(record.current_ip ?? record.projected_ip ?? 0) >= minIp)
    .sort((a, b) => {
      const left = Number(a[sortKey]);
      const right = Number(b[sortKey]);
      return (Number.isNaN(right) ? -Infinity : right) - (Number.isNaN(left) ? -Infinity : left);
    });

  const visiblePitchers = visibleRows(state.filteredPitchers);
  updatePitcherSummary(state.filteredPitchers);
  updatePitcherGuide(state.filteredPitchers);
  updatePitcherTableStatus(state.filteredPitchers, visiblePitchers);
  renderPitcherTable(visiblePitchers);
}
