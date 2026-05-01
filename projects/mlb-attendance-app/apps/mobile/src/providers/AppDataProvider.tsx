import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { attendanceLogs as seededAttendanceLogs, friendAttendanceLogs, friends, games, mockUser, teams, venues } from "../lib/data/mockSportsData";
import { buildAttendanceLog } from "../lib/api/attendanceService";
import { searchGames as searchCatalogGames } from "../lib/api/catalogService";
import {
  parseImportedAppState,
  serializeAppState
} from "../lib/storage/appRepository";
import { appDataStore } from "../lib/persistence";
import type { AppSessionAccount, HydratedAppDataState } from "../lib/persistence/appDataStore";
import { calculatePersonalStats } from "@mlb-attendance/domain";
import type { AttendanceLog, CreateAttendanceInput, FriendProfile, Game, PersonalStats, Team, UserProfile, Venue } from "@mlb-attendance/domain";

interface AppDataContextValue {
  storageMode: "local" | "hosted";
  currentUserId: string | null;
  currentAccountLabel: string | null;
  isAuthenticated: boolean;
  profile: UserProfile;
  friends: FriendProfile[];
  teams: Team[];
  venues: Venue[];
  games: Game[];
  attendanceLogs: AttendanceLog[];
  friendAttendanceLogs: AttendanceLog[];
  stats: PersonalStats;
  isHydrated: boolean;
  persistenceStatus: "idle" | "loading" | "saving" | "saved" | "error";
  persistenceError: string | null;
  lastHydratedAt: string | null;
  lastSavedAt: string | null;
  signIn: (params: { identifier: string; password: string }) => Promise<void>;
  signUp: (params: { identifier: string; password: string; displayName?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (identifier: string) => Promise<string>;
  addAttendanceLog: (input: CreateAttendanceInput) => Promise<AttendanceLog>;
  updateProfile: (updates: { displayName?: string; favoriteTeamId?: string; followingIds?: string[] }) => Promise<UserProfile>;
  completeOnboarding: (updates: { displayName?: string; favoriteTeamId?: string }) => Promise<UserProfile>;
  toggleFollowFriend: (friendId: string) => Promise<UserProfile>;
  updateAttendanceLog: (
    logId: string,
    updates: {
      seat: AttendanceLog["seat"];
      memorableMoment?: string;
      companion?: string;
      giveaway?: string;
      weather?: string;
    }
  ) => Promise<AttendanceLog>;
  deleteAttendanceLog: (logId: string) => Promise<void>;
  retryHydration: () => Promise<void>;
  resetAppData: () => Promise<void>;
  exportAppData: () => string;
  importAppData: (raw: string) => Promise<void>;
  searchGames: (filters: { query?: string; date?: string; stadium?: string }) => Promise<Game[]>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);
const SEEDED_DATA_VERSION = "real-mlb-history-v1";

function sortAttendanceLogs(logs: AttendanceLog[]) {
  return [...logs].sort((left, right) => right.attendedOn.localeCompare(left.attendedOn));
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const storageMode = appDataStore.kind;
  const [accounts, setAccounts] = useState<AppSessionAccount[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>(mockUser);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>(sortAttendanceLogs(seededAttendanceLogs));
  const [isHydrated, setIsHydrated] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("loading");
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [lastHydratedAt, setLastHydratedAt] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentAccount = useMemo(
    () => accounts.find((account) => account.id === currentUserId) ?? null,
    [accounts, currentUserId]
  );

  function getCurrentSessionState() {
    return {
      currentUserId,
      profile,
      attendanceLogs
    };
  }

  function applyHydratedState(nextState: HydratedAppDataState) {
    setAccounts(nextState.accounts);
    setCurrentUserId(nextState.currentUserId ?? nextState.currentAccount?.id ?? null);
    setProfile(nextState.profile);
    setAttendanceLogs(sortAttendanceLogs(nextState.attendanceLogs));
  }

  const stats = useMemo(() => {
    return calculatePersonalStats({
      user: profile,
      attendanceLogs,
      games,
      teams,
      venues
    });
  }, [attendanceLogs, profile]);

  function markHydratedNow() {
    setLastHydratedAt(new Date().toISOString());
  }

  function markSavedNow() {
    setLastSavedAt(new Date().toISOString());
  }

  function buildHydrationErrorMessage() {
    return storageMode === "hosted"
      ? "We could not load your hosted record right now."
      : "We could not load your saved local record from this device.";
  }

  function buildPersistenceErrorMessage() {
    return storageMode === "hosted"
      ? "We could not sync your latest changes to the hosted record."
      : "We could not save your latest changes on this device.";
  }

  async function hydrateFromStorage() {
    setPersistenceStatus("loading");
    setPersistenceError(null);

    try {
      const hydratedState = await appDataStore.hydrate();
      applyHydratedState(hydratedState);
      markHydratedNow();
      setPersistenceStatus("idle");
    } catch {
      setPersistenceStatus("error");
      setPersistenceError(buildHydrationErrorMessage());
    } finally {
      setIsHydrated(true);
    }
  }

  useEffect(() => {
    hydrateFromStorage();

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    let canceled = false;

    async function persist() {
      setPersistenceStatus("saving");

      try {
        await appDataStore.persistCurrentUser({
          currentUserId,
          profile,
          attendanceLogs
        });
        if (canceled) {
          return;
        }

        setPersistenceStatus("saved");
        setPersistenceError(null);
        markSavedNow();
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          setPersistenceStatus("idle");
        }, 1200);
      } catch {
        if (!canceled) {
          setPersistenceStatus("error");
          setPersistenceError(buildPersistenceErrorMessage());
        }
      }
    }

    persist();

    return () => {
      canceled = true;
    };
  }, [accounts, attendanceLogs, currentUserId, isHydrated, profile]);

  async function signIn(params: { identifier: string; password: string }) {
    const nextState = await appDataStore.signIn({
      ...params,
      currentSession: getCurrentSessionState()
    });
    applyHydratedState(nextState);
    markHydratedNow();
    setPersistenceStatus("idle");
    setPersistenceError(null);
  }

  async function signUp(params: { identifier: string; password: string; displayName?: string }) {
    const nextState = await appDataStore.signUp({
      ...params,
      currentSession: getCurrentSessionState()
    });
    applyHydratedState(nextState);
    markHydratedNow();
    markSavedNow();
    setPersistenceStatus("saved");
    setPersistenceError(null);
  }

  async function signOut() {
    const nextState = await appDataStore.signOut({
      currentSession: getCurrentSessionState()
    });
    applyHydratedState(nextState);
    markHydratedNow();
    markSavedNow();
    setPersistenceStatus("saved");
    setPersistenceError(null);
  }

  async function requestPasswordReset(identifier: string) {
    return appDataStore.requestPasswordReset(identifier);
  }

  async function addAttendanceLog(input: CreateAttendanceInput) {
    if (!currentUserId) {
      throw new Error("Log in to save a game.");
    }

    if (attendanceLogs.some((existingLog) => existingLog.userId === currentUserId && existingLog.gameId === input.gameId)) {
      throw new Error("That game is already in your history.");
    }

    const log = await buildAttendanceLog({
      ...input,
      userId: currentUserId
    });
    setAttendanceLogs((currentLogs) => [log, ...currentLogs]);
    return log;
  }

  async function updateProfile(updates: { displayName?: string; favoriteTeamId?: string; followingIds?: string[] }) {
    const nextProfile: UserProfile = {
      ...profile,
      displayName: updates.displayName?.trim() || profile.displayName,
      favoriteTeamId: updates.favoriteTeamId || undefined,
      followingIds: updates.followingIds ? [...new Set(updates.followingIds.filter(Boolean))] : profile.followingIds
    };

    setProfile(nextProfile);
    return nextProfile;
  }

  async function completeOnboarding(updates: { displayName?: string; favoriteTeamId?: string }) {
    const nextProfile: UserProfile = {
      ...profile,
      displayName: updates.displayName?.trim() || profile.displayName,
      favoriteTeamId: updates.favoriteTeamId || undefined,
      hasCompletedOnboarding: true
    };

    setProfile(nextProfile);
    return nextProfile;
  }

  async function toggleFollowFriend(friendId: string) {
    const currentFollowing = profile.followingIds ?? [];
    const isFollowing = currentFollowing.includes(friendId);
    const nextFollowing = isFollowing
      ? currentFollowing.filter((existingId) => existingId !== friendId)
      : [...currentFollowing, friendId];

    return updateProfile({
      followingIds: nextFollowing
    });
  }

  async function updateAttendanceLog(
    logId: string,
    updates: {
      seat: AttendanceLog["seat"];
      memorableMoment?: string;
      companion?: string;
      giveaway?: string;
      weather?: string;
    }
  ) {
    let updatedLog: AttendanceLog | undefined;

    setAttendanceLogs((currentLogs) =>
      currentLogs.map((log) => {
        if (log.id !== logId) {
          return log;
        }

        updatedLog = {
          ...log,
          seat: {
            section: updates.seat.section.trim(),
            row: updates.seat.row?.trim() || undefined,
            seatNumber: updates.seat.seatNumber?.trim() || undefined
          },
          memorableMoment: updates.memorableMoment?.trim() || undefined,
          companion: updates.companion?.trim() || undefined,
          giveaway: updates.giveaway?.trim() || undefined,
          weather: updates.weather?.trim() || undefined
        };

        return updatedLog;
      })
    );

    if (!updatedLog) {
      throw new Error("That attendance log could not be found.");
    }

    return updatedLog;
  }

  async function deleteAttendanceLog(logId: string) {
    let deleted = false;

    setAttendanceLogs((currentLogs) =>
      currentLogs.filter((log) => {
        const shouldKeep = log.id !== logId;
        if (!shouldKeep) {
          deleted = true;
        }
        return shouldKeep;
      })
    );

    if (!deleted) {
      throw new Error("That attendance log could not be found.");
    }
  }

  async function searchGames(filters: { query?: string; date?: string; stadium?: string }) {
    return searchCatalogGames(filters);
  }

  async function retryHydration() {
    await hydrateFromStorage();
  }

  async function resetAppData() {
    if (!currentAccount) {
      return;
    }

    const nextProfile = {
      ...mockUser,
      id: profile.id,
      displayName: profile.displayName,
      hasCompletedOnboarding: profile.hasCompletedOnboarding ?? true
    };
    const nextAttendanceLogs = sortAttendanceLogs(seededAttendanceLogs);

    setProfile(nextProfile);
    setAttendanceLogs(nextAttendanceLogs);
    setPersistenceStatus("saved");
    setPersistenceError(null);
  }

  function exportAppData() {
    return serializeAppState({
      profile,
      attendanceLogs,
      seededDataImported: true,
      seededDataVersion: SEEDED_DATA_VERSION
    });
  }

  async function importAppData(raw: string) {
    try {
      const importedState = parseImportedAppState(raw);
      setProfile({
        ...importedState.profile,
        id: currentUserId ?? profile.id,
        hasCompletedOnboarding: true
      });
      setAttendanceLogs(
        sortAttendanceLogs(
          importedState.attendanceLogs.map((log) => ({
            ...log,
            userId: currentUserId ?? profile.id
          }))
        )
      );
      markSavedNow();
      setPersistenceStatus("saved");
      setPersistenceError(null);
    } catch {
      setPersistenceStatus("error");
      setPersistenceError("That import payload is not valid app data.");
      throw new Error("That import payload is not valid app data.");
    }
  }

  const value: AppDataContextValue = {
    storageMode,
    currentUserId,
    currentAccountLabel: currentAccount?.label ?? null,
    isAuthenticated: Boolean(currentUserId),
    profile,
    friends,
    teams,
    venues,
    games,
    attendanceLogs,
    friendAttendanceLogs,
    stats,
    isHydrated,
    persistenceStatus,
    persistenceError,
    lastHydratedAt,
    lastSavedAt,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    addAttendanceLog,
    updateProfile,
    completeOnboarding,
    toggleFollowFriend,
    updateAttendanceLog,
    deleteAttendanceLog,
    retryHydration,
    resetAppData,
    exportAppData,
    importAppData,
    searchGames
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider.");
  }

  return context;
}
