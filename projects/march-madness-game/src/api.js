export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  return payload;
}

export function loadAppState() {
  return fetchJson("/api/state");
}

export function assignDraftTeam(teamName, owner) {
  return fetchJson("/api/draft/assign", {
    method: "POST",
    body: JSON.stringify({ teamName, owner })
  });
}

export function makeDraftPick(teamName) {
  return fetchJson("/api/draft/pick", {
    method: "POST",
    body: JSON.stringify({ teamName })
  });
}

export function unassignDraftTeam(teamName) {
  return fetchJson("/api/draft/unassign", {
    method: "POST",
    body: JSON.stringify({ teamName })
  });
}

export function resetDraft(mode) {
  return fetchJson("/api/draft/reset", {
    method: "POST",
    body: JSON.stringify({ mode })
  });
}

export function undoDraftPick() {
  return fetchJson("/api/draft/undo", {
    method: "POST"
  });
}

export function updateDraftSettings(payload) {
  return fetchJson("/api/draft/settings", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateSeasonConfig(payload) {
  return fetchJson("/api/season/config", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
