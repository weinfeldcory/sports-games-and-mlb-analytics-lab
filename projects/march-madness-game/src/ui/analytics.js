import { rounds, scoringSourceUrl } from "../data.js";
import {
  constrainedEqualValueScoring,
  equalValueScoring,
  equalValueDeviations,
  expectedStandings,
  scoringFairnessSummary,
  scoringSummary,
  standings,
  teamRows,
  trueMaxStandings
} from "../scoring.js";
import { formatNumber, formatPercent } from "../lib/format.js";

export function renderOverview(appData) {
  const standingsRows = appData.standings || [];
  const leader = standingsRows[0];
  const latestPick = (appData.draft.history || []).slice(-1)[0];
  const unresolvedCount = (appData.unresolvedGames || []).length;
  const secondPlace = standingsRows[1];
  const leaderMargin = leader && secondPlace ? leader.points - secondPlace.points : null;
  const nextAction = appData.draft.locked
    ? "Unlock the draft when the room is ready to move again."
    : appData.draft.currentOwner
      ? `${appData.draft.currentOwner} is on the clock.`
      : "Set the draft order before making picks.";

  document.querySelector("#overview").innerHTML = `
    <div class="overview-strip">
      <article class="overview-stat">
        <span class="overview-label">Leader</span>
        <strong>${leader?.owner ?? "No leader yet"}</strong>
        <p>${leader ? `${leader.points} pts · ${formatPercent(leader.winOdds, 1)} win odds` : "Standings will populate after setup."}</p>
      </article>
      <article class="overview-stat">
        <span class="overview-label">On The Clock</span>
        <strong>${appData.draft.currentOwner ?? "No owner set"}</strong>
        <p>Pick ${appData.draft.currentPickNumber} · ${appData.draft.locked ? "Draft locked" : "Draft open"}</p>
      </article>
      <article class="overview-stat">
        <span class="overview-label">Games Left</span>
        <strong>${unresolvedCount}</strong>
        <p>${unresolvedCount ? "Remaining tournament outcomes still matter." : "Tournament outcome is settled."}</p>
      </article>
    </div>
    <div class="focus-grid overview-focus-grid">
      <article class="focus-card">
        <span class="focus-label">Live</span>
        <h3>Draft Status</h3>
        <p>${nextAction}</p>
      </article>
      <article class="focus-card">
        <span class="focus-label">Recent</span>
        <h3>${latestPick ? `Latest pick: ${latestPick.teamName}` : "No picks yet"}</h3>
        <p>${latestPick ? `${latestPick.owner} made pick ${latestPick.pickNumber}.` : "The draft history will surface here once the board starts moving."}</p>
      </article>
      <article class="focus-card">
        <span class="focus-label">Watch</span>
        <h3>${leader ? `${leader.owner} holds first place` : "Standings coming into focus"}</h3>
        <p>${leader && leaderMargin != null ? `${leaderMargin === 0 ? "The top spot is currently tied." : `${leader.owner} leads by ${leaderMargin} point${leaderMargin === 1 ? "" : "s"}.`}` : "Use the workspace for deeper standings and path detail."}</p>
      </article>
    </div>
  `;
}

export function renderStandings(appData) {
  const { currentScoring, games, teams } = appData;
  const current = standings(teams, games, currentScoring, appData.owners);
  const max = new Map(trueMaxStandings(teams, games, currentScoring, appData.owners).map((row) => [row.owner, row.max]));
  const expected = new Map(expectedStandings(teams, games, currentScoring, undefined, appData.owners).map((row) => [row.owner, row.expected]));
  const summaryByOwner = new Map((appData.standings || []).map((row) => [row.owner, row]));
  const alternate = constrainedEqualValueScoring(appData.currentScoring);
  const alternateCurrent = new Map(standings(teams, games, alternate, appData.owners).map((row) => [row.owner, row.points]));
  const alternateExpected = new Map(expectedStandings(teams, games, alternate, undefined, appData.owners).map((row) => [row.owner, row.expected]));

  const markup = `
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
            <div><dt>Alt now</dt><dd>${formatNumber(alternateCurrent.get(row.owner))}</dd></div>
            <div><dt>Alt exp.</dt><dd>${formatNumber(alternateExpected.get(row.owner))}</dd></div>
          </dl>
        </article>
      `).join("")}
    </div>
    <table>
      <thead>
        <tr><th>Owner</th><th>Current</th><th>Win Odds</th><th>Expected</th><th>True Max</th><th>Alt Current</th><th>Alt Expected</th></tr>
      </thead>
      <tbody>
        ${current.map((row) => `
          <tr>
            <td>${row.owner}</td>
            <td>${summaryByOwner.get(row.owner)?.points ?? row.points}</td>
            <td>${formatPercent(summaryByOwner.get(row.owner)?.winOdds, 1)}</td>
            <td>${formatNumber(expected.get(row.owner))}</td>
            <td>${summaryByOwner.get(row.owner)?.max ?? max.get(row.owner)}</td>
            <td>${formatNumber(alternateCurrent.get(row.owner))}</td>
            <td>${formatNumber(alternateExpected.get(row.owner))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  const snapshot = document.querySelector("#standings");
  if (snapshot) {
    snapshot.innerHTML = markup;
  }

  const detail = document.querySelector("#standings-detail");
  if (detail) {
    detail.innerHTML = markup;
  }
}

export function renderPaths(appData) {
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

export function renderMatrix(appData) {
  const strict = equalValueScoring(appData.currentScoring);
  const proposed = constrainedEqualValueScoring(appData.currentScoring);
  const summary = scoringSummary(appData.currentScoring, proposed);
  const currentFairness = scoringFairnessSummary(appData.currentScoring);
  const strictFairness = scoringFairnessSummary(strict);
  const constrainedFairness = scoringFairnessSummary(proposed);
  const strictDeviations = equalValueDeviations(strict);
  const currentDeviations = equalValueDeviations(appData.currentScoring);
  document.querySelector("#matrix").innerHTML = `
    <div class="model-note">
      <h3>Equal-EV scoring</h3>
      <p>
        The strict matrix sets each seed's points from the same formula:
        round points = target expected value divided by that seed's smoothed probability of winning that round.
        That makes each seed's total expected value equal before the tournament starts. The constrained matrix below keeps the
        same logic but applies practical caps so the numbers stay usable.
      </p>
      <a href="${scoringSourceUrl}" target="_blank" rel="noreferrer">Historical seed table source</a>
    </div>
    <div class="fairness-strip">
      <div><dt>Current EV spread</dt><dd>${formatNumber(currentFairness.spread, 2)}</dd></div>
      <div><dt>Strict EV spread</dt><dd>${formatNumber(strictFairness.spread, 2)}</dd></div>
      <div><dt>Constrained EV spread</dt><dd>${formatNumber(constrainedFairness.spread, 2)}</dd></div>
      <div><dt>Current CV</dt><dd>${formatNumber(currentFairness.coefficientOfVariation, 3)}</dd></div>
      <div><dt>Constrained CV</dt><dd>${formatNumber(constrainedFairness.coefficientOfVariation, 3)}</dd></div>
    </div>
    <div class="table-scroll compact">
      <table>
        <thead>
          <tr><th>Round</th><th>Strict 1-seed</th><th>Strict 12-seed</th><th>Current 1-seed</th><th>Current 12-seed</th><th>Constrained 1-seed</th><th>Constrained 12-seed</th></tr>
        </thead>
        <tbody>
          ${summary.map((row) => `
            <tr>
              <td>${row.round.replace(" Appearance", "")}</td>
              <td>${formatNumber(strict[1][rounds.indexOf(row.round)], 2)}</td>
              <td>${formatNumber(strict[12][rounds.indexOf(row.round)], 2)}</td>
              <td>${row.currentOneSeed}</td>
              <td>${row.currentCinderella}</td>
              <td>${formatNumber(row.optimizedOneSeed, 2)}</td>
              <td>${formatNumber(row.optimizedCinderella, 2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <div class="table-scroll compact">
      <table>
        <thead>
          <tr><th>Seed</th><th>Current EV</th><th>Strict EV</th><th>Delta From Mean</th></tr>
        </thead>
        <tbody>
          ${strictDeviations.map((row, index) => `
            <tr>
              <td>${row.seed}</td>
              <td>${formatNumber(currentDeviations[index].expectedValue, 2)}</td>
              <td>${formatNumber(row.expectedValue, 2)}</td>
              <td>${formatNumber(row.deltaFromMean, 2)}</td>
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
    <p class="note">Bold is the current matrix. Small numbers are the constrained equal-EV recommendation. The strict comparison above shows the mathematically exact equal-EV output before usability caps are applied.</p>
  `;
}

export function renderTeams(appData) {
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

export function renderTeamTable(appData) {
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
