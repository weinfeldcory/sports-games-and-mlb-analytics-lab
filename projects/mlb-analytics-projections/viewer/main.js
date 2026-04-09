const dataUrl = "./data/hitter_projection_vs_current_2026.json";

const state = {
  records: [],
  filtered: [],
};

const teamFilter = document.querySelector("#team-filter");
const searchFilter = document.querySelector("#search-filter");
const minPaFilter = document.querySelector("#min-pa-filter");
const sortKeyFilter = document.querySelector("#sort-key");
const summaryCards = document.querySelector("#summary-cards");
const projectionRows = document.querySelector("#projection-rows");
const teamTitle = document.querySelector("#team-title");
const teamCopy = document.querySelector("#team-copy");
const teamMetrics = document.querySelector("#team-metrics");
const teamLeadersList = document.querySelector("#team-leaders-list");

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

function populateTeamFilter(records) {
  const teams = [...new Set(records.map(teamLabel))].sort();
  for (const team of teams) {
    const option = document.createElement("option");
    option.value = team;
    option.textContent = team;
    teamFilter.append(option);
  }
}

function updateSummary(records) {
  const totalWar = records.reduce((sum, record) => sum + (Number(record.projected_value_war_proxy) || 0), 0);
  const totalCurrentPa = records.reduce((sum, record) => sum + (Number(record.current_pa) || 0), 0);
  const totalPaceHr = records.reduce((sum, record) => sum + (Number(record.pace_home_runs_162) || 0), 0);
  const bestPlayer = records[0];
  const avgCurrentWoba = records.length
    ? records.reduce((sum, record) => sum + (Number(record.current_woba) || 0), 0) / records.filter((record) => record.current_woba !== null).length || 0
    : 0;

  const cards = [
    {
      label: "Players",
      value: records.length,
      subtext: "Current filtered population",
    },
    {
      label: "Projected WAR",
      value: formatNumber(totalWar, 1),
      subtext: "Sum of WAR proxy",
    },
    {
      label: "Current PA",
      value: formatInteger(totalCurrentPa),
      subtext: "Season-to-date plate appearances",
    },
    {
      label: "162G HR Pace",
      value: formatNumber(totalPaceHr, 1),
      subtext: "Summed full-season HR pace",
    },
    {
      label: "Top Bat",
      value: bestPlayer ? bestPlayer.player_name : "-",
      subtext: bestPlayer
        ? `${teamLabel(bestPlayer)} · ${formatNumber(bestPlayer.projected_value_war_proxy, 2)} WAR · ${formatNumber(avgCurrentWoba, 3)} avg current wOBA`
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
  const selectedTeam = teamFilter.value;

  if (selectedTeam === "ALL") {
    teamTitle.textContent = "All Teams";
    teamCopy.textContent =
      "Select a team to see aggregate projected output and the top projected bats.";
    teamMetrics.innerHTML = `
      <article class="card">
        <span class="card-label">Teams</span>
        <div class="card-value">${new Set(state.records.map(teamLabel)).size}</div>
        <div class="card-subtext">Distinct clubs in the current file</div>
      </article>
      <article class="card">
        <span class="card-label">Players</span>
        <div class="card-value">${records.length}</div>
        <div class="card-subtext">Rows after the active filters</div>
      </article>
      <article class="card">
        <span class="card-label">Avg WAR</span>
        <div class="card-value">${formatNumber(
          records.reduce((sum, record) => sum + (Number(record.projected_value_war_proxy) || 0), 0) / (records.length || 1),
          2,
        )}</div>
        <div class="card-subtext">Average projected WAR proxy</div>
      </article>
      <article class="card">
        <span class="card-label">Avg Current wOBA</span>
        <div class="card-value">${formatNumber(
          records.reduce((sum, record) => sum + (Number(record.current_woba) || 0), 0) /
            (records.filter((record) => record.current_woba !== null).length || 1),
          3,
        )}</div>
        <div class="card-subtext">Average season-to-date offensive quality</div>
      </article>
      <article class="card">
        <span class="card-label">Avg 162G HR</span>
        <div class="card-value">${formatNumber(
          records.reduce((sum, record) => sum + (Number(record.pace_home_runs_162) || 0), 0) / (records.length || 1),
          1,
        )}</div>
        <div class="card-subtext">Average 162-game HR pace</div>
      </article>
    `;
  } else {
    const teamRecords = state.records.filter((record) => teamLabel(record) === selectedTeam);
    const totalWar = teamRecords.reduce((sum, record) => sum + (Number(record.projected_value_war_proxy) || 0), 0);
    const totalCurrentPa = teamRecords.reduce((sum, record) => sum + (Number(record.current_pa) || 0), 0);
    const totalPaceHr = teamRecords.reduce((sum, record) => sum + (Number(record.pace_home_runs_162) || 0), 0);
    const totalProjectedHr = teamRecords.reduce((sum, record) => sum + (Number(record.projected_home_runs) || 0), 0);
    const totalPaceSb = teamRecords.reduce((sum, record) => sum + (Number(record.pace_stolen_bases_162) || 0), 0);
    const totalProjectedSb = teamRecords.reduce((sum, record) => sum + (Number(record.projected_stolen_bases) || 0), 0);
    const topTeamBat = [...teamRecords].sort(
      (a, b) => Number(b.projected_value_war_proxy) - Number(a.projected_value_war_proxy),
    )[0];

    teamTitle.textContent = selectedTeam;
    teamCopy.textContent = topTeamBat
      ? `Projected leader: ${topTeamBat.player_name} at ${formatNumber(
          topTeamBat.projected_value_war_proxy,
          2,
        )} WAR. Current line: ${formatNumber(topTeamBat.current_woba, 3)} wOBA with ${formatInteger(topTeamBat.current_pa)} PA.`
      : "No rows for this team.";

    teamMetrics.innerHTML = `
      <article class="card">
        <span class="card-label">Projected WAR</span>
        <div class="card-value">${formatNumber(totalWar, 1)}</div>
        <div class="card-subtext">Team total WAR proxy</div>
      </article>
      <article class="card">
        <span class="card-label">Current PA</span>
        <div class="card-value">${formatInteger(totalCurrentPa)}</div>
        <div class="card-subtext">Season-to-date plate appearances</div>
      </article>
      <article class="card">
        <span class="card-label">162G HR vs Proj</span>
        <div class="card-value">${formatNumber(totalPaceHr, 1)} / ${formatNumber(totalProjectedHr, 1)}</div>
        <div class="card-subtext">Full-season HR pace vs projection</div>
      </article>
      <article class="card">
        <span class="card-label">162G SB vs Proj</span>
        <div class="card-value">${formatNumber(totalPaceSb, 1)} / ${formatNumber(totalProjectedSb, 1)}</div>
        <div class="card-subtext">Full-season SB pace vs projection</div>
      </article>
      <article class="card">
        <span class="card-label">Avg Current wOBA</span>
        <div class="card-value">${formatNumber(
          teamRecords.reduce((sum, record) => sum + (Number(record.current_woba) || 0), 0) /
            (teamRecords.filter((record) => record.current_woba !== null).length || 1),
          3,
        )}</div>
        <div class="card-subtext">Current offensive quality</div>
      </article>
    `;
  }

  const leaders = [...records]
    .sort((a, b) => Number(b.projected_value_war_proxy) - Number(a.projected_value_war_proxy))
    .slice(0, 3);

  teamLeadersList.innerHTML = leaders.length
    ? leaders
        .map(
          (record, index) => `
            <article class="leader-card">
              <span class="leader-rank">#${index + 1}</span>
              <strong>${record.player_name}</strong>
              <div class="leader-line">${teamLabel(record)} · ${formatNumber(
                record.projected_value_war_proxy,
                2,
              )} WAR</div>
              <div class="leader-line">${formatNumber(record.current_woba, 3)} current wOBA · ${formatNumber(
                record.pace_home_runs_162,
                1,
              )} 162G HR · ${formatNumber(record.pace_stolen_bases_162, 1)} 162G SB</div>
            </article>
          `,
        )
        .join("")
    : `<article class="leader-card"><strong>No matching hitters</strong><div class="leader-line">Adjust the filters to populate this panel.</div></article>`;
}

function renderTable(records) {
  if (!records.length) {
    projectionRows.innerHTML = `<tr><td class="empty" colspan="14">No players match the current filters.</td></tr>`;
    return;
  }

  projectionRows.innerHTML = records
    .map(
      (record) => `
        <tr>
          <td>
            <div class="player-cell">
              <strong>${record.player_name}</strong>
              <span class="player-meta">${record.team_2025 || "No prior team"}</span>
            </div>
          </td>
          <td>${teamLabel(record)}</td>
          <td>${record.roster_position || "-"}</td>
          <td>${formatNumber(record.projected_value_war_proxy, 2)}</td>
          <td>${formatInteger(record.current_games)}</td>
          <td>${formatInteger(record.current_pa)}</td>
          <td>${formatNumber(record.current_woba, 3)}</td>
          <td>${formatNumber(record.pace_pa_162, 1)}</td>
          <td>${formatNumber(record.projected_pa, 1)}</td>
          <td>${formatNumber(record.pace_pa_diff, 1)}</td>
          <td>${formatNumber(record.pace_home_runs_162, 1)}</td>
          <td>${formatNumber(record.projected_home_runs, 1)}</td>
          <td>${formatNumber(record.pace_home_runs_diff, 1)}</td>
          <td>${formatNumber(record.pace_stolen_bases_162, 1)}</td>
          <td>${formatNumber(record.projected_stolen_bases, 1)}</td>
          <td>${formatNumber(record.pace_stolen_bases_diff, 1)}</td>
        </tr>
      `,
    )
    .join("");
}

function applyFilters() {
  const selectedTeam = teamFilter.value;
  const searchTerm = searchFilter.value.trim().toLowerCase();
  const minPa = minPaFilter.value.trim() === "" ? 0 : Number(minPaFilter.value) || 0;
  const sortKey = sortKeyFilter.value;

  state.filtered = state.records
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

  updateSummary(state.filtered);
  updateTeamPanel(state.filtered);
  renderTable(state.filtered);
}

async function init() {
  const response = await fetch(dataUrl);
  state.records = await response.json();
  populateTeamFilter(state.records);
  applyFilters();
}

teamFilter.addEventListener("change", applyFilters);
searchFilter.addEventListener("input", applyFilters);
minPaFilter.addEventListener("input", applyFilters);
sortKeyFilter.addEventListener("change", applyFilters);

init().catch((error) => {
  summaryCards.innerHTML = "";
  projectionRows.innerHTML = `<tr><td class="empty" colspan="14">Failed to load data: ${error.message}</td></tr>`;
});
