import AsyncStorage from "@react-native-async-storage/async-storage";
import { attendanceLogs as seededAttendanceLogs, mockUser } from "../data/mockSportsData";
import type { AttendanceLog, UserProfile } from "@mlb-attendance/domain";

const STORAGE_KEY = "mlb-attendance-app:state";
const STORAGE_VERSION = 3;
const SEEDED_DATA_VERSION = "real-mlb-history-v1";

interface PersistedAppStateV1 {
  version: 1;
  profile: UserProfile;
  attendanceLogs: AttendanceLog[];
  seededDataImported: boolean;
}

interface PersistedAppStateV2 {
  version: 2;
  profile: UserProfile;
  attendanceLogs: AttendanceLog[];
  seededDataImported: boolean;
}

interface PersistedAppStateV3 {
  version: 3;
  profile: UserProfile;
  attendanceLogs: AttendanceLog[];
  seededDataImported: boolean;
  seededDataVersion: string;
}

export interface AppRepositoryState {
  profile: UserProfile;
  attendanceLogs: AttendanceLog[];
  seededDataImported: boolean;
  seededDataVersion: string;
}

function createDefaultState(profileOverride?: UserProfile): AppRepositoryState {
  return {
    profile: normalizeProfile(profileOverride ?? mockUser),
    attendanceLogs: [...seededAttendanceLogs].sort((left, right) => right.attendedOn.localeCompare(left.attendedOn)),
    seededDataImported: true,
    seededDataVersion: SEEDED_DATA_VERSION
  };
}

function normalizeProfile(input: UserProfile | null | undefined): UserProfile {
  return {
    id: input?.id || mockUser.id,
    displayName: input?.displayName?.trim() || mockUser.displayName,
    favoriteTeamId: input?.favoriteTeamId || undefined,
    followingIds: [...new Set((input?.followingIds ?? mockUser.followingIds ?? []).filter(Boolean))]
  };
}

function normalizeAttendanceLog(log: AttendanceLog): AttendanceLog {
  return {
    ...log,
    seat: {
      section: log.seat.section.trim(),
      row: log.seat.row?.trim() || undefined,
      seatNumber: log.seat.seatNumber?.trim() || undefined
    },
    memorableMoment: log.memorableMoment?.trim() || undefined,
    companion: log.companion?.trim() || undefined,
    giveaway: log.giveaway?.trim() || undefined,
    weather: log.weather?.trim() || undefined
  };
}

function sanitizeState(input: AppRepositoryState): AppRepositoryState {
  return {
    profile: normalizeProfile(input.profile),
    attendanceLogs: input.attendanceLogs
      .map((log) => normalizeAttendanceLog(log))
      .sort((left, right) => right.attendedOn.localeCompare(left.attendedOn)),
    seededDataImported: input.seededDataImported,
    seededDataVersion: input.seededDataVersion
  };
}

export function serializeAppState(state: AppRepositoryState): string {
  const sanitizedState = sanitizeState(state);
  const payload: PersistedAppStateV3 = {
    version: STORAGE_VERSION,
    profile: sanitizedState.profile,
    attendanceLogs: sanitizedState.attendanceLogs,
    seededDataImported: sanitizedState.seededDataImported,
    seededDataVersion: sanitizedState.seededDataVersion
  };

  return JSON.stringify(payload, null, 2);
}

export function parseImportedAppState(raw: string): AppRepositoryState {
  const parsed = JSON.parse(raw) as unknown;
  return migratePersistedState(parsed);
}

function migratePersistedState(parsed: unknown): AppRepositoryState {
  if (!parsed || typeof parsed !== "object") {
    return createDefaultState();
  }

  const candidate = parsed as Partial<PersistedAppStateV1 | PersistedAppStateV2 | PersistedAppStateV3>;
  if ((candidate.version !== 1 && candidate.version !== 2 && candidate.version !== STORAGE_VERSION) || !candidate.profile || !Array.isArray(candidate.attendanceLogs)) {
    return createDefaultState();
  }

  if (candidate.version !== STORAGE_VERSION || candidate.seededDataVersion !== SEEDED_DATA_VERSION) {
    return createDefaultState(candidate.profile);
  }

  return sanitizeState({
    profile: candidate.profile,
    attendanceLogs: candidate.attendanceLogs,
    seededDataImported: candidate.seededDataImported ?? true,
    seededDataVersion: candidate.seededDataVersion ?? SEEDED_DATA_VERSION
  });
}

export async function loadAppState(): Promise<AppRepositoryState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createDefaultState();
  }

  try {
    return migratePersistedState(JSON.parse(raw));
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return createDefaultState();
  }
}

export async function saveAppState(state: AppRepositoryState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, serializeAppState(state));
}

export async function clearAppState(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
