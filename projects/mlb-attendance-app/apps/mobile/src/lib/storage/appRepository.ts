import AsyncStorage from "@react-native-async-storage/async-storage";
import { attendanceLogs as seededAttendanceLogs, mockUser } from "../data/mockSportsData";
import type { AttendanceLog, UserProfile } from "@mlb-attendance/domain";

const STORAGE_KEY = "mlb-attendance-app:state";
const STORAGE_VERSION = 7;
const SEEDED_DATA_VERSION = "real-mlb-history-v1";
const LEGACY_PROFILE_KEY = "profile";
const LEGACY_ATTENDANCE_LOGS_KEY = "attendanceLogs";
const LEGACY_SEEDED_DATA_IMPORTED_KEY = "seededDataImported";
const LEGACY_SEEDED_DATA_VERSION_KEY = "seededDataVersion";

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

interface PersistedAppStateV4 {
  version: 4;
  profile: UserProfile;
  attendanceLogs: AttendanceLog[];
  seededDataImported: boolean;
  seededDataVersion: string;
}

interface PersistedAppStateV5 {
  version: 5;
  currentAccountId: string | null;
  accounts: LocalAccountRecord[];
}

interface PersistedAccountStateV6 extends AppRepositoryState {
  version: 6;
}

interface PersistedAccountMetadataV6 {
  id: string;
  username: string;
  password: string;
}

interface PersistedRootStateV6 {
  version: 6;
  currentUserId: string | null;
  accounts: PersistedAccountMetadataV6[];
}

interface PersistedRootStateV7 {
  version: 7;
  currentUserId: string | null;
  hasMigratedLegacyUserScope: boolean;
  accounts: PersistedAccountMetadataV6[];
}

export interface AppRepositoryState {
  profile: UserProfile;
  attendanceLogs: AttendanceLog[];
  seededDataImported: boolean;
  seededDataVersion: string;
}

export interface LocalAccountRecord extends AppRepositoryState {
  id: string;
  username: string;
  password: string;
}

export interface PersistedRootState {
  currentUserId: string | null;
  accounts: LocalAccountRecord[];
}

function buildProfileStorageKey(accountId: string) {
  return `profile_${accountId}`;
}

function buildAttendanceLogsStorageKey(accountId: string) {
  return `attendanceLogs_${accountId}`;
}

function buildAccountMetaStorageKey(accountId: string) {
  return `accountMeta_${accountId}`;
}

function dedupeAttendanceLogs(logs: AttendanceLog[]) {
  const seenIds = new Set<string>();
  const seenGameIds = new Set<string>();

  return logs.filter((log) => {
    if (seenIds.has(log.id) || seenGameIds.has(log.gameId)) {
      return false;
    }

    seenIds.add(log.id);
    seenGameIds.add(log.gameId);
    return true;
  });
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase().replace(/\s+/g, "-");
}

function buildUserId(username: string) {
  return `user_${normalizeUsername(username).replace(/[^a-z0-9-_]/g, "") || "local"}`;
}

function createDefaultState(profileOverride?: UserProfile): AppRepositoryState {
  const normalizedProfile = normalizeProfile(profileOverride ?? mockUser);
  return {
    profile: normalizedProfile,
    attendanceLogs: seededAttendanceLogs
      .map((log) => ({
        ...log,
        userId: normalizedProfile.id
      }))
      .sort((left, right) => right.attendedOn.localeCompare(left.attendedOn)),
    seededDataImported: true,
    seededDataVersion: SEEDED_DATA_VERSION
  };
}

function createEmptyState(profileOverride?: UserProfile): AppRepositoryState {
  const normalizedProfile = normalizeProfile(profileOverride ?? mockUser);
  return {
    profile: normalizedProfile,
    attendanceLogs: [],
    seededDataImported: false,
    seededDataVersion: SEEDED_DATA_VERSION
  };
}

function normalizeProfile(input: Partial<UserProfile> | null | undefined): UserProfile {
  return {
    id: input?.id || mockUser.id,
    displayName: input?.displayName?.trim() || mockUser.displayName,
    favoriteTeamId: input?.favoriteTeamId || undefined,
    followingIds: [...new Set((input?.followingIds ?? mockUser.followingIds ?? []).filter(Boolean))],
    hasCompletedOnboarding: input?.hasCompletedOnboarding ?? false
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
    attendanceLogs: dedupeAttendanceLogs(
      input.attendanceLogs.map((log) => normalizeAttendanceLog(log))
    )
      .sort((left, right) => right.attendedOn.localeCompare(left.attendedOn)),
    seededDataImported: input.seededDataImported,
    seededDataVersion: input.seededDataVersion
  };
}

function sanitizeAccount(account: LocalAccountRecord): LocalAccountRecord {
  const sanitizedState = sanitizeState(account);
  const userId = account.id || buildUserId(account.username);

  return {
    id: userId,
    username: normalizeUsername(account.username),
    password: account.password ?? "",
    ...sanitizedState,
    profile: {
      ...sanitizedState.profile,
      id: sanitizedState.profile.id || userId
    },
    attendanceLogs: sanitizedState.attendanceLogs.map((log) => ({
      ...log,
      userId
    }))
  };
}

function createRootStateFromLegacy(state: AppRepositoryState): PersistedRootState {
  const baseUsername = normalizeUsername(state.profile.displayName || "cory");
  const account = sanitizeAccount({
    id: state.profile.id || buildUserId(baseUsername),
    username: baseUsername,
    password: "",
    ...state,
    profile: {
      ...state.profile,
      id: state.profile.id || buildUserId(baseUsername)
    }
  });

  return {
    currentUserId: account.id,
    accounts: [account]
  };
}

function migrateLegacyAppState(parsed: unknown): AppRepositoryState {
  if (!parsed || typeof parsed !== "object") {
    return createDefaultState();
  }

  const candidate = parsed as Partial<PersistedAppStateV1 | PersistedAppStateV2 | PersistedAppStateV3 | PersistedAppStateV4>;
  if (
    (candidate.version !== 1 &&
      candidate.version !== 2 &&
      candidate.version !== 3 &&
      candidate.version !== 4) ||
    !candidate.profile ||
    !Array.isArray(candidate.attendanceLogs)
  ) {
    return createDefaultState();
  }

  if (candidate.version !== 4 || candidate.seededDataVersion !== SEEDED_DATA_VERSION) {
    return {
      ...createDefaultState(candidate.profile),
      profile: normalizeProfile({
        ...candidate.profile,
        hasCompletedOnboarding: true
      })
    };
  }

  return sanitizeState({
    profile: candidate.profile,
    attendanceLogs: candidate.attendanceLogs,
    seededDataImported: candidate.seededDataImported ?? true,
    seededDataVersion: candidate.seededDataVersion ?? SEEDED_DATA_VERSION
  });
}

function migratePersistedRootState(parsed: unknown): PersistedRootState {
  if (!parsed || typeof parsed !== "object") {
    return {
      currentUserId: null,
      accounts: []
    };
  }

  const legacyCandidate = parsed as Partial<PersistedAppStateV5>;
  if (legacyCandidate.version === 5 && Array.isArray(legacyCandidate.accounts)) {
    const accounts = legacyCandidate.accounts.map(sanitizeAccount);
    const currentUserId = accounts.some((account) => account.id === legacyCandidate.currentAccountId)
      ? legacyCandidate.currentAccountId ?? null
      : accounts[0]?.id ?? null;

    return {
      currentUserId,
      accounts
    };
  }

  return createRootStateFromLegacy(migrateLegacyAppState(parsed));
}

function parsePersistedAccountState(parsed: unknown, accountId: string): AppRepositoryState {
  if (!parsed || typeof parsed !== "object") {
    return createEmptyState({
      ...mockUser,
      id: accountId
    });
  }

  const candidate = parsed as Partial<PersistedAccountStateV6>;
  return sanitizeState({
    profile: normalizeProfile({
      ...candidate.profile,
      id: candidate.profile?.id || accountId
    }),
    attendanceLogs: Array.isArray(candidate.attendanceLogs) ? candidate.attendanceLogs : [],
    seededDataImported: candidate.seededDataImported ?? true,
    seededDataVersion: candidate.seededDataVersion ?? SEEDED_DATA_VERSION
  });
}

async function loadAccountState(
  account: PersistedAccountMetadataV6
): Promise<LocalAccountRecord> {
  const [profileRaw, attendanceLogsRaw, metaRaw] = await AsyncStorage.multiGet([
    buildProfileStorageKey(account.id),
    buildAttendanceLogsStorageKey(account.id),
    buildAccountMetaStorageKey(account.id)
  ]);
  const profileValue = profileRaw[1];
  const attendanceLogsValue = attendanceLogsRaw[1];
  const metaValue = metaRaw[1];
  let state: AppRepositoryState;

  if (!profileValue && !attendanceLogsValue && !metaValue) {
    state = createEmptyState({
      ...mockUser,
      id: account.id,
      displayName: account.username
    });
  } else {
    try {
      state = parsePersistedAccountState(
        {
          profile: profileValue ? JSON.parse(profileValue) : undefined,
          attendanceLogs: attendanceLogsValue ? JSON.parse(attendanceLogsValue) : [],
          ...(metaValue ? JSON.parse(metaValue) : {})
        },
        account.id
      );
    } catch {
      await AsyncStorage.multiRemove([
        buildProfileStorageKey(account.id),
        buildAttendanceLogsStorageKey(account.id),
        buildAccountMetaStorageKey(account.id)
      ]);
      state = createEmptyState({
        ...mockUser,
        id: account.id,
        displayName: account.username
      });
    }
  }

  return sanitizeAccount({
    ...account,
    ...state
  });
}

async function loadLegacyUnscopedState(userId: string): Promise<AppRepositoryState | null> {
  const entries = await AsyncStorage.multiGet([
    LEGACY_PROFILE_KEY,
    LEGACY_ATTENDANCE_LOGS_KEY,
    LEGACY_SEEDED_DATA_IMPORTED_KEY,
    LEGACY_SEEDED_DATA_VERSION_KEY
  ]);
  const profileValue = entries[0]?.[1];
  const attendanceLogsValue = entries[1]?.[1];
  const seededDataImportedValue = entries[2]?.[1];
  const seededDataVersionValue = entries[3]?.[1];

  if (!profileValue && !attendanceLogsValue && !seededDataImportedValue && !seededDataVersionValue) {
    return null;
  }

  try {
    const parsedAttendanceLogs = attendanceLogsValue ? JSON.parse(attendanceLogsValue) : [];
    return sanitizeState({
      profile: normalizeProfile({
        ...(profileValue ? JSON.parse(profileValue) : {}),
        id: userId
      }),
      attendanceLogs: Array.isArray(parsedAttendanceLogs)
        ? (parsedAttendanceLogs as AttendanceLog[]).map((log) => ({
            ...log,
            userId
          }))
        : [],
      seededDataImported: seededDataImportedValue ? JSON.parse(seededDataImportedValue) : true,
      seededDataVersion: seededDataVersionValue ? JSON.parse(seededDataVersionValue) : SEEDED_DATA_VERSION
    });
  } catch {
    return null;
  }
}

async function removeLegacyUnscopedKeys() {
  const keys = await AsyncStorage.getAllKeys();
  const removableKeys = [
    LEGACY_PROFILE_KEY,
    LEGACY_ATTENDANCE_LOGS_KEY,
    LEGACY_SEEDED_DATA_IMPORTED_KEY,
    LEGACY_SEEDED_DATA_VERSION_KEY
  ].filter((key) => keys.includes(key));

  if (removableKeys.length) {
    await AsyncStorage.multiRemove(removableKeys);
  }
}

async function migrateLegacyUnscopedStateIntoAccounts(
  accounts: LocalAccountRecord[],
  currentUserId: string | null
): Promise<{ accounts: LocalAccountRecord[]; hasMigratedLegacyUserScope: boolean }> {
  const targetUserId = currentUserId ?? accounts[0]?.id ?? null;
  if (!targetUserId) {
    return {
      accounts,
      hasMigratedLegacyUserScope: false
    };
  }

  const legacyState = await loadLegacyUnscopedState(targetUserId);
  if (!legacyState) {
    return {
      accounts,
      hasMigratedLegacyUserScope: true
    };
  }

  const nextAccounts = accounts.map((account) => {
    if (account.id !== targetUserId) {
      return account;
    }

    return sanitizeAccount({
      ...account,
      profile: {
        ...account.profile,
        ...legacyState.profile,
        id: targetUserId
      },
      attendanceLogs: [
        ...legacyState.attendanceLogs.map((log) => ({
          ...log,
          userId: targetUserId
        })),
        ...account.attendanceLogs.map((log) => ({
          ...log,
          userId: targetUserId
        }))
      ],
      seededDataImported: legacyState.seededDataImported,
      seededDataVersion: legacyState.seededDataVersion
    });
  });

  await removeLegacyUnscopedKeys();

  return {
    accounts: nextAccounts,
    hasMigratedLegacyUserScope: true
  };
}

export function createLocalAccount(params: {
  identifier: string;
  password: string;
  displayName?: string;
}): LocalAccountRecord {
  const username = normalizeUsername(params.identifier);
  const userId = buildUserId(username);
  const defaultState = createEmptyState({
    ...mockUser,
    id: userId,
    displayName: params.displayName?.trim() || params.identifier.trim() || mockUser.displayName,
    hasCompletedOnboarding: false
  });

  return sanitizeAccount({
    id: userId,
    username,
    password: params.password,
    ...defaultState,
    profile: {
      ...defaultState.profile,
      id: userId
    }
  });
}

export function serializeAppState(state: AppRepositoryState): string {
  const sanitizedState = sanitizeState(state);
  const payload: PersistedAppStateV4 = {
    version: 4,
    profile: sanitizedState.profile,
    attendanceLogs: sanitizedState.attendanceLogs,
    seededDataImported: sanitizedState.seededDataImported,
    seededDataVersion: sanitizedState.seededDataVersion
  };

  return JSON.stringify(payload, null, 2);
}

export function parseImportedAppState(raw: string): AppRepositoryState {
  const parsed = JSON.parse(raw) as unknown;
  return migrateLegacyAppState(parsed);
}

export async function loadRootState(): Promise<PersistedRootState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      currentUserId: null,
      accounts: []
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      const candidate = parsed as Partial<PersistedRootStateV6 | PersistedRootStateV7>;
      if ((candidate.version === 6 || candidate.version === STORAGE_VERSION) && Array.isArray(candidate.accounts)) {
        const accounts = await Promise.all(candidate.accounts.map((account) => loadAccountState(account)));
        const persistedCurrentUserId = candidate.currentUserId;
        const currentUserId = accounts.some((account) => account.id === persistedCurrentUserId)
          ? persistedCurrentUserId ?? null
          : accounts[0]?.id ?? null;

        return {
          currentUserId,
          accounts
        };
      }
    }

    return migratePersistedRootState(parsed);
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return {
      currentUserId: null,
      accounts: []
    };
  }
}

export async function saveRootState(state: PersistedRootState): Promise<void> {
  const sanitizedAccounts = state.accounts.map(sanitizeAccount);
  const rootRaw = await AsyncStorage.getItem(STORAGE_KEY);
  const parsedRoot = rootRaw ? (JSON.parse(rootRaw) as Partial<PersistedRootStateV7>) : null;
  const hasMigratedLegacyUserScope = parsedRoot?.version === STORAGE_VERSION && parsedRoot.hasMigratedLegacyUserScope === true;
  const migrationResult = hasMigratedLegacyUserScope
    ? {
        accounts: sanitizedAccounts,
        hasMigratedLegacyUserScope
      }
    : await migrateLegacyUnscopedStateIntoAccounts(sanitizedAccounts, state.currentUserId);
  const accounts = migrationResult.accounts.map(sanitizeAccount);
  const payload: PersistedRootStateV7 = {
    version: STORAGE_VERSION,
    currentUserId: state.currentUserId,
    hasMigratedLegacyUserScope: migrationResult.hasMigratedLegacyUserScope,
    accounts: accounts.map((account) => ({
      id: account.id,
      username: account.username,
      password: account.password
    }))
  };

  const existingKeys = (await AsyncStorage.getAllKeys()).filter(
    (key) =>
      key.startsWith("profile_") ||
      key.startsWith("attendanceLogs_") ||
      key.startsWith("accountMeta_")
  );
  const nextKeys = new Set(
    accounts.flatMap((account) => [
      buildProfileStorageKey(account.id),
      buildAttendanceLogsStorageKey(account.id),
      buildAccountMetaStorageKey(account.id)
    ])
  );
  const removedKeys = existingKeys.filter((key) => !nextKeys.has(key));

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload, null, 2));
  await Promise.all(
    accounts.map((account) =>
      AsyncStorage.multiSet(
        [
          [buildProfileStorageKey(account.id), JSON.stringify(account.profile, null, 2)],
          [buildAttendanceLogsStorageKey(account.id), JSON.stringify(account.attendanceLogs, null, 2)],
          [
            buildAccountMetaStorageKey(account.id),
            JSON.stringify(
              {
                version: STORAGE_VERSION,
                seededDataImported: account.seededDataImported,
                seededDataVersion: account.seededDataVersion
              },
              null,
              2
            )
          ]
        ]
      )
    )
  );
  if (removedKeys.length) {
    await AsyncStorage.multiRemove(removedKeys);
  }
}

export async function clearAllAppState(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const removableKeys = keys.filter(
    (key) =>
      key === STORAGE_KEY ||
      key === LEGACY_PROFILE_KEY ||
      key === LEGACY_ATTENDANCE_LOGS_KEY ||
      key === LEGACY_SEEDED_DATA_IMPORTED_KEY ||
      key === LEGACY_SEEDED_DATA_VERSION_KEY ||
      key.startsWith("profile_") ||
      key.startsWith("attendanceLogs_") ||
      key.startsWith("accountMeta_")
  );
  if (removableKeys.length) {
    await AsyncStorage.multiRemove(removableKeys);
  }
}
