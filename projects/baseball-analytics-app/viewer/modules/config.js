export const hitterDataUrl = "./data/hitter_projection_vs_current_2026.json";
export const pitcherDataUrl = "./data/pitcher_projection_vs_current_2026.json";
export const rosterStorageKey = "mlb-team-builder-roster-v2";
export const rosterScenarioStorageKey = "mlb-team-builder-scenarios-v1";
export const comparisonStorageKey = "mlb-team-builder-compare-v1";
export const pythagoreanExponent = 1.83;
export const teamSeasonPa = 6200;
export const teamSeasonInnings = 1458;

export const hitterSlotDefinitions = [
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

export const pitcherSlotDefinitions = [
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
