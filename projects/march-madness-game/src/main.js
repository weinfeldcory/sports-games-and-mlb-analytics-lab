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
  renderOverview,
  renderMatrix,
  renderPaths,
  renderStandings,
  renderTeamTable,
  renderTeams
} from "./ui/analytics.js";
import { renderDraftRoom, renderSeasonSetup } from "./ui/draft.js";
import { createUiState } from "./ui/state.js";

async function initializeApp() {
  let appData = await loadAppState();
  const uiState = createUiState(appData);

  const setWorkspace = (workspace, options = {}) => {
    uiState.activeWorkspace = workspace;
    render();

    if (options.scroll) {
      document.querySelector("#workspace-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const render = () => {
    renderOverview(appData);
    renderDraftRoom(appData, uiState, actions);
    renderSeasonSetup(appData, uiState, actions);
    renderStandings(appData);
    renderPaths(appData);
    renderMatrix(appData);
    renderTeams(appData);
    renderTeamTable(appData);
    renderWorkspaceState(uiState);
    bindShellActions(actions);

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
    setWorkspace,
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

function renderWorkspaceState(uiState) {
  document.querySelectorAll("[data-workspace]").forEach((button) => {
    const isActive = button.dataset.workspace === uiState.activeWorkspace;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  document.querySelectorAll(".workspace-panel").forEach((panel) => {
    const workspace = panel.id.replace("workspace-panel-", "");
    panel.hidden = workspace !== uiState.activeWorkspace;
  });
}

function bindShellActions(actions) {
  document.querySelectorAll("[data-workspace]").forEach((button) => {
    button.onclick = () => {
      actions.setWorkspace(button.dataset.workspace);
    };
  });

  document.querySelectorAll("[data-nav-target]").forEach((button) => {
    button.onclick = () => {
      const surface = button.dataset.navSurface;
      if (surface) {
        actions.setWorkspace(surface);
      }

      document.getElementById(button.dataset.navTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  });
}

initializeApp();
