import { rounds, scoringSourceUrl } from "./data.js";
import {
  assignDraftTeam,
  loadAppState,
  makeDraftPick,
  resetDraft,
  undoDraftPick,
  unassignDraftTeam,
  updateDraftSettings,
  updateSeasonConfig
} from "./api.js";
import {
  constrainedEqualValueScoring,
  equalValueScoring,
  expectedStandings,
  inferredRoundExpectedValues,
  probabilityBasedScoring,
  scoringFairnessSummary,
  scoringSummary,
  standings,
  teamRows,
  trueMaxStandings
} from "./scoring.js";

function formatNumber(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function formatPercent(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${formatNumber(value * 100, digits)}%`;
}

function teamsToText(teams) {
  return teams
    .slice()
    .sort((a, b) => a.seed - b.seed || a.name.localeCompare(b.name))
    .map((team) => `${team.seed}, ${team.name}`)
    .join("\n");
}

function scoringToText(currentScoring) {
  return JSON.stringify(currentScoring, null, 2);
}

function parseTeamsText(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [seed, ...rest] = line.split(",");
      return {
        seed: Number(seed.trim()),
        name: rest.join(",").trim(),
        owner: null
      };
    });
}

function createUiState(appData) {
  return {
    manualOwner: appData.draft.currentOwner || appData.owners[0] || "",
    setupMessage: "",
    setupError: "",
    savingSetup: false
  };
}

function draftStats(appData) {
  const totalTeams = appData.teams.length;
  const draftedTeams = appData.teams.filter((team) => team.owner).length;
  return {
    totalTeams,
    draftedTeams,
    availableTeams: totalTeams - draftedTeams
  };
}

function renderDraftRoom(appData, uiState, actions) {
  const stats = draftStats(appData);
  const ownerCounts = new Map(appData.owners.map((owner) => [owner, 0]));

  for (const team of appData.teams) {
    if (team.owner) {
      ownerCounts.set(team.owner, ownerCounts.get(team.owner) + 1);
    }
  }

  const groupedBySeed = Object.groupBy(
    appData.teams.filter((team) => !team.owner),
    ({ seed }) => String(seed)
  );
  const draftedByOwner = Map.groupBy(
    appData.teams.filter((team) => team.owner),
    ({ owner }) => owner
  );

  document.querySelector("#draft-room").innerHTML = `
    <div class="draft-commissioner">
      <div class="draft-status-card">
        <span class="eyebrow">Current Pick</span>
        <h3>${appData.draft.currentOwner ?? "No owner set"}</h3>
        <p>Pick ${appData.draft.currentPickNumber} · ${appData.draft.snake ? "Snake draft" : "Linear draft"} · ${appData.draft.locked ? "Locked" : "Open"}</p>
        <div class="draft-meta">
          <span>${stats.draftedTeams}/${stats.totalTeams} drafted</span>
          <span>${stats.availableTeams} available</span>
        </div>
        <div class="draft-controls">
          <button type="button" data-action="toggle-lock">${appData.draft.locked ? "Unlock Draft" : "Lock Draft"}</button>
          <button type="button" data-action="undo">Undo Pick</button>
          <button type="button" data-action="reset-empty">Start Empty Draft</button>
          <button type="button" data-action="restore-sheet">Restore Sheet</button>
        </div>
      </div>
      <div class="draft-settings-card">
        <div class="draft-panel-head">
          <h3>Commissioner Settings</h3>
          <p>Control order and use manual assignment when needed.</p>
        </div>
        <label class="field-label" for="draft-order">Draft order</label>
        <textarea id="draft-order" class="setup-input setup-textarea" rows="3">${appData.draft.order.join("\n")}</textarea>
        <label class="checkbox-row">
          <input id="snake-mode" type="checkbox" ${appData.draft.snake ? "checked" : ""} />
          <span>Snake draft</span>
        </label>
        <button type="button" data-action="save-draft-settings">Save Draft Settings</button>
        <label class="field-label" for="manual-owner">Manual assign owner</label>
        <select id="manual-owner" class="setup-input">
          ${appData.owners.map((owner) => `<option value="${owner}" ${uiState.manualOwner === owner ? "selected" : ""}>${owner}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="draft-grid">
      <section class="draft-panel">
        <div class="draft-panel-head">
          <h3>Available Teams</h3>
          <p>Click a team to draft it to the current owner. Use commissioner controls above only when you need to override.</p>
        </div>
        <div class="seed-grid">
          ${Array.from({ length: 16 }, (_, index) => index + 1).map((seed) => `
            <article class="seed-column">
              <div class="seed-head">
                <h4>${seed}-Seed</h4>
                <span>${(groupedBySeed[String(seed)] || []).length} left</span>
              </div>
              <div class="seed-list">
                ${(groupedBySeed[String(seed)] || []).map((team) => `
                  <button class="draft-team draft-team-compact" type="button" data-team="${team.name}">
                    <strong>${team.name}</strong>
                    <span>${seed}-seed</span>
                  </button>
                `).join("") || '<p class="empty-state">No teams left</p>'}
              </div>
            </article>
          `).join("")}
        </div>
      </section>
      <section class="draft-panel">
        <div class="draft-panel-head">
          <h3>Drafted Teams</h3>
          <p>Click a team to return it to the pool. Order history is tracked for undo.</p>
        </div>
        <div class="drafted-grid">
          ${appData.owners.map((owner) => `
            <article class="draft-owner-card">
              <div class="draft-owner-head">
                <h4>${owner}</h4>
                <span>${ownerCounts.get(owner)} teams</span>
              </div>
              <div class="seed-list">
                ${(draftedByOwner.get(owner) || [])
                  .sort((a, b) => a.seed - b.seed || a.name.localeCompare(b.name))
                  .map((team) => `
                    <button class="draft-team is-owned" type="button" data-team-unassign="${team.name}">
                      <strong>${team.name}</strong>
                      <span>${team.seed}-seed</span>
                    </button>
                  `).join("") || '<p class="empty-state">No teams drafted</p>'}
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    </div>
    <div class="draft-history">
      <div class="draft-panel-head">
        <h3>Recent Picks</h3>
        <p>Most recent picks first.</p>
      </div>
      <div class="history-list">
        ${(appData.draft.history || []).slice().reverse().map((entry) => `
          <div class="history-row">
            <strong>Pick ${entry.pickNumber}</strong>
            <span>${entry.owner}</span>
            <span>${entry.teamName}</span>
          </div>
        `).join("") || '<p class="empty-state">No picks yet</p>'}
      </div>
    </div>
  `;

  document.querySelector("#manual-owner")?.addEventListener("change", (event) => {
    uiState.manualOwner = event.target.value;
    actions.render();
  });

  document.querySelector("[data-action='toggle-lock']")?.addEventListener("click", () => {
    actions.toggleLock(!appData.draft.locked);
  });

  document.querySelector("[data-action='undo']")?.addEventListener("click", () => {
    actions.undo();
  });

  document.querySelector("[data-action='reset-empty']")?.addEventListener("click", () => {
    actions.reset("empty");
  });

  document.querySelector("[data-action='restore-sheet']")?.addEventListener("click", () => {
    actions.reset("sheet");
  });

  document.querySelector("[data-action='save-draft-settings']")?.addEventListener("click", () => {
    const order = document.querySelector("#draft-order").value
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
    const snake = document.querySelector("#snake-mode").checked;
    actions.saveDraftSettings({ order, snake });
  });

  document.querySelectorAll("[data-team]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.pick(button.dataset.team);
    });
  });

  document.querySelectorAll("[data-team-unassign]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.unassign(button.dataset.teamUnassign);
    });
  });
}

function renderSeasonSetup(appData, uiState, actions) {
  document.querySelector("#season-setup").innerHTML = `
    <form id="season-setup-form" class="setup-form">
      <div class="setup-grid">
        <label class="setup-field">
          <span>Season Year</span>
          <input id="setup-season" class="setup-input" type="number" value="${appData.season}" />
        </label>
        <label class="setup-field">
          <span>Owners</span>
          <textarea id="setup-owners" class="setup-input setup-textarea" rows="6">${appData.owners.join("\n")}</textarea>
        </label>
      </div>
      <div class="setup-grid setup-grid-wide">
        <label class="setup-field">
          <span>Teams</span>
          <textarea id="setup-teams" class="setup-input setup-textarea" rows="18">${teamsToText(appData.teams)}</textarea>
          <small>One team per line: <code>seed, team name</code></small>
        </label>
        <label class="setup-field">
          <span>Scoring Matrix</span>
          <textarea id="setup-scoring" class="setup-input setup-textarea" rows="18">${scoringToText(appData.currentScoring)}</textarea>
          <small>JSON object keyed by seed with ${rounds.length} values per seed.</small>
        </label>
      </div>
      <div class="setup-actions">
        <button type="submit" ${uiState.savingSetup ? "disabled" : ""}>${uiState.savingSetup ? "Saving…" : "Save Season Config"}</button>
      </div>
      ${uiState.setupMessage ? `<p class="setup-message">${uiState.setupMessage}</p>` : ""}
      ${uiState.setupError ? `<p class="setup-error">${uiState.setupError}</p>` : ""}
    </form>
  `;

  document.querySelector("#season-setup-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    uiState.savingSetup = true;
    uiState.setupMessage = "";
    uiState.setupError = "";
    actions.render();

    try {
      const season = Number(document.querySelector("#setup-season").value);
      const owners = document.querySelector("#setup-owners").value
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean);
      const teams = parseTeamsText(document.querySelector("#setup-teams").value);
      const currentScoring = JSON.parse(document.querySelector("#setup-scoring").value);

      await actions.saveSeasonConfig({ season, owners, teams, currentScoring });
      uiState.setupMessage = "Season configuration saved.";
    } catch (error) {
      uiState.setupError = error.message;
    } finally {
      uiState.savingSetup = false;
      actions.render();
    }
  });
}

function renderStandings(appData) {
  const { currentScoring, games, teams } = appData;
  const current = standings(teams, games, currentScoring);
  const max = new Map(trueMaxStandings(teams, games, currentScoring).map((row) => [row.owner, row.max]));
  const expected = new Map(expectedStandings(teams, games, currentScoring).map((row) => [row.owner, row.expected]));
  const summaryByOwner = new Map((appData.standings || []).map((row) => [row.owner, row]));
  const optimized = probabilityBasedScoring();
  const optimizedCurrent = new Map(standings(teams, games, optimized).map((row) => [row.owner, row.points]));
  const optimizedExpected = new Map(expectedStandings(teams, games, optimized).map((row) => [row.owner, row.expected]));

  document.querySelector("#standings").innerHTML = `
    <div class="standings-cards">
      ${current.map((row, index) => `
        <article class="rank-card">
          <span class="rank">#${summaryByOwner.get(row.owner)?.place ?? index + 1}</span>
          <h3>${row.owner}</h3>
          <p class="score">${summaryByOwner.get(row.owner)?.points ?? row.points}</p>
          <dl>
            <div><dt>Win odds</dt><dd>${formatPercent(summaryByOwner.get(row.owner)?.winOdds, 1)}</dd></div>
            <div><dt>Expected</dt><dd>${formatNumber(expected.get(row.owner))}</dd></div>
            <div><dt>True max</dt><dd>${summaryByOwner.get(row.owner)?.max ?? max.get(row.owner)}</dd></div>
            <div><dt>Optimized now</dt><dd>${optimizedCurrent.get(row.owner)}</dd></div>
            <div><dt>Optimized exp.</dt><dd>${formatNumber(optimizedExpected.get(row.owner))}</dd></div>
          </dl>
        </article>
      `).join("")}
    </div>
    <table>
      <thead>
        <tr><th>Owner</th><th>Current</th><th>Win Odds</th><th>Expected</th><th>True Max</th><th>Optimized Current</th><th>Optimized Expected</th></tr>
      </thead>
      <tbody>
        ${current.map((row) => `
          <tr>
            <td>${row.owner}</td>
            <td>${summaryByOwner.get(row.owner)?.points ?? row.points}</td>
            <td>${formatPercent(summaryByOwner.get(row.owner)?.winOdds, 1)}</td>
            <td>${formatNumber(expected.get(row.owner))}</td>
            <td>${summaryByOwner.get(row.owner)?.max ?? max.get(row.owner)}</td>
            <td>${optimizedCurrent.get(row.owner)}</td>
            <td>${formatNumber(optimizedExpected.get(row.owner))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderPaths(appData) {
  const rows = appData.paths || [];
  document.querySelector("#paths").innerHTML = `
    <div class="paths-intro">
      <p>
        These are not exact scripts. They are the results that show up more often than normal in each owner's winning simulations.
        Read them as: if this owner wins the pool, these outcomes usually helped get them there.
      </p>
    </div>
    <div class="path-grid">
      ${rows.map((row) => `
        <article class="path-card">
          <div class="path-card-head">
            <div>
              <span class="pill">${formatPercent(row.odds, 1)} to win</span>
              <h3>${row.owner}</h3>
            </div>
            <div class="path-score">
              <strong>${row.currentPoints}</strong>
              <span>${row.pointsBehind ? `${row.pointsBehind} back` : "leader"}</span>
            </div>
          </div>
          <p class="path-summary">${row.summary || "No strong path signal surfaced."}</p>
          <div class="path-sections">
            <div class="path-section">
              <h4>Needs</h4>
              <div class="path-tags">
                ${row.mustHave.map((outcome) => `
                  <span class="path-tag">
                    ${outcome.team}
                    <small>shows up in ${formatPercent(outcome.conditionalProbability, 0)} of this owner's wins</small>
                  </span>
                `).join("") || '<span class="path-tag is-muted">No true must-have outcome surfaced</span>'}
              </div>
            </div>
            <div class="path-section">
              <h4>Helps</h4>
              <div class="path-tags">
                ${row.favorable.map((outcome) => `
                  <span class="path-tag">
                    ${outcome.team}
                    <small>${formatPercent(outcome.lift, 0)} more common than baseline</small>
                  </span>
                `).join("") || '<span class="path-tag is-muted">No strongly favorable swing left</span>'}
              </div>
            </div>
            <div class="path-section">
              <h4>Hurts</h4>
              <div class="path-tags">
                ${row.avoid.map((outcome) => `
                  <span class="path-tag is-danger">
                    ${outcome.team}
                    <small>${formatPercent(Math.abs(outcome.lift), 0)} less common in winning paths</small>
                  </span>
                `).join("") || '<span class="path-tag is-muted">No major spoiler left</span>'}
              </div>
            </div>
          </div>
        </article>
      `).join("") || `
        <article class="path-card">
          <h3>No Paths Left</h3>
          <p>No remaining games. The result is already decided.</p>
        </article>
      `}
    </div>
  `;
}

function renderMatrix(appData) {
  const strict = equalValueScoring(appData.currentScoring);
  const proposed = constrainedEqualValueScoring(appData.currentScoring);
  const summary = scoringSummary(appData.currentScoring, proposed);
  const currentFairness = scoringFairnessSummary(appData.currentScoring);
  const strictFairness = scoringFairnessSummary(strict);
  const optimizedFairness = scoringFairnessSummary(proposed);
  const roundTargets = inferredRoundExpectedValues(appData.currentScoring);
  document.querySelector("#matrix").innerHTML = `
    <div class="model-note">
      <h3>Constrained Equal-EV model</h3>
      <p>
        This version starts from the rigorous equal-EV solution, then applies human-usable round caps and monotonic rules so
        late-round underdog payouts do not explode while seed EV stays much flatter than the current system.
      </p>
      <a href="${scoringSourceUrl}" target="_blank" rel="noreferrer">Historical seed table source</a>
    </div>
    <div class="fairness-strip">
      <div><dt>Current EV spread</dt><dd>${formatNumber(currentFairness.spread, 2)}</dd></div>
      <div><dt>Strict EV spread</dt><dd>${formatNumber(strictFairness.spread, 2)}</dd></div>
      <div><dt>Constrained EV spread</dt><dd>${formatNumber(optimizedFairness.spread, 2)}</dd></div>
      <div><dt>Current CV</dt><dd>${formatNumber(currentFairness.coefficientOfVariation, 3)}</dd></div>
      <div><dt>Constrained CV</dt><dd>${formatNumber(optimizedFairness.coefficientOfVariation, 3)}</dd></div>
    </div>
    <div class="table-scroll compact">
      <table>
        <thead>
          <tr><th>Round</th><th>Target EV</th><th>Current 1-seed</th><th>Current 12-seed</th><th>Constrained 1-seed</th><th>Constrained 12-seed</th></tr>
        </thead>
        <tbody>
          ${summary.map((row, index) => `
            <tr>
              <td>${row.round.replace(" Appearance", "")}</td>
              <td>${formatNumber(roundTargets[index], 2)}</td>
              <td>${row.currentOneSeed}</td>
              <td>${row.currentCinderella}</td>
              <td>${row.optimizedOneSeed}</td>
              <td>${row.optimizedCinderella}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <div class="table-scroll compact">
      <table>
        <thead>
          <tr><th>Round</th><th>Strict 1-seed</th><th>Strict 12-seed</th><th>Strict 16-seed</th></tr>
        </thead>
        <tbody>
          ${rounds.map((round, index) => `
            <tr>
              <td>${round.replace(" Appearance", "")}</td>
              <td>${strict[1][index]}</td>
              <td>${strict[12][index]}</td>
              <td>${strict[16][index]}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Seed</th>
            ${rounds.map((round) => `<th>${round.replace(" Appearance", "")}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${Object.keys(appData.currentScoring).map((seed) => `
            <tr>
              <td>${seed}</td>
              ${appData.currentScoring[seed].map((points, index) => `
                <td><strong>${points}</strong><span>${proposed[seed][index]}</span></td>
              `).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <p class="note">Bold is current app scoring. Small numbers are the constrained equal-EV recommendation. The strict table above shows the unconstrained math-only solution for comparison.</p>
  `;
}

function renderTeams(appData) {
  const rows = (appData.teamRows || teamRows(appData.teams, appData.games, appData.currentScoring))
    .filter((team) => team.owner && (team.points || team.remaining))
    .sort((a, b) => b.points - a.points || b.remaining - a.remaining);
  const byOwner = Map.groupBy(rows, (team) => team.owner);

  document.querySelector("#teams").innerHTML = `
    <div class="owner-grid">
      ${[...byOwner.entries()].map(([owner, ownerTeams]) => `
        <article class="owner-card">
          <div class="owner-header">
            <h3>${owner}</h3>
            <span>${ownerTeams.reduce((sum, team) => sum + team.points, 0)} pts</span>
          </div>
          <div class="team-list">
            ${ownerTeams.map((team) => `
              <div class="team-row">
                <div>
                  <strong>${team.name}</strong>
                  <span>${team.seed}-seed</span>
                </div>
                <div class="team-metrics">
                  <span>${team.points} pts</span>
                  ${team.remaining ? `<span>${formatNumber(team.expectedRemaining)} exp. left</span>` : `<span>done</span>`}
                </div>
              </div>
            `).join("")}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderTeamTable(appData) {
  const rows = (appData.teamRows || teamRows(appData.teams, appData.games, appData.currentScoring))
    .filter((team) => team.points || team.remaining)
    .sort((a, b) => b.points - a.points || b.remaining - a.remaining);

  document.querySelector("#team-table").innerHTML = `
    <div class="table-scroll">
      <table>
        <thead>
          <tr><th>Team</th><th>Owner</th><th>Seed</th><th>Points</th><th>Max Left</th><th>Expected Left</th></tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${row.name}</td>
              <td>${row.owner ?? "—"}</td>
              <td>${row.seed}</td>
              <td>${row.points}</td>
              <td>${row.remaining}</td>
              <td>${formatNumber(row.expectedRemaining)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function initializeApp() {
  let appData = await loadAppState();
  const uiState = createUiState(appData);

  const render = () => {
    renderDraftRoom(appData, uiState, actions);
    renderSeasonSetup(appData, uiState, actions);
    renderStandings(appData);
    renderPaths(appData);
    renderMatrix(appData);
    renderTeams(appData);
    renderTeamTable(appData);

    const status = document.querySelector("#data-status");
    if (status) {
      status.textContent = `App backend live · updated ${new Date(appData.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    }
  };

  const refresh = async () => {
    appData = await loadAppState();
    if (!appData.owners.includes(uiState.manualOwner)) {
      uiState.manualOwner = appData.draft.currentOwner || appData.owners[0] || "";
    }
    render();
  };

  const actions = {
    render,
    pick: async (teamName) => {
      await makeDraftPick(teamName);
      await refresh();
    },
    manualAssign: async (teamName, owner) => {
      await assignDraftTeam(teamName, owner);
      await refresh();
    },
    unassign: async (teamName) => {
      await unassignDraftTeam(teamName);
      await refresh();
    },
    undo: async () => {
      await undoDraftPick();
      await refresh();
    },
    reset: async (mode) => {
      await resetDraft(mode);
      await refresh();
    },
    toggleLock: async (locked) => {
      await updateDraftSettings({ locked });
      await refresh();
    },
    saveDraftSettings: async (payload) => {
      await updateDraftSettings(payload);
      await refresh();
    },
    saveSeasonConfig: async (payload) => {
      await updateSeasonConfig(payload);
      await refresh();
    }
  };

  render();
}

initializeApp();
