import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { attendanceLogs as seededAttendanceLogs, friendAttendanceLogs, friends, games, mockUser, teams, venues } from "../lib/data/mockSportsData";
import { buildAttendanceLog } from "../lib/api/attendanceService";
import { searchGames as searchCatalogGames } from "../lib/api/catalogService";
import { clearAppState, loadAppState, parseImportedAppState, saveAppState, serializeAppState } from "../lib/storage/appRepository";
import { calculatePersonalStats } from "@mlb-attendance/domain";
import type { AttendanceLog, CreateAttendanceInput, FriendProfile, Game, PersonalStats, Team, UserProfile, Venue } from "@mlb-attendance/domain";

interface AppDataContextValue {
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
  addAttendanceLog: (input: CreateAttendanceInput) => Promise<AttendanceLog>;
  updateProfile: (updates: { displayName?: string; favoriteTeamId?: string; followingIds?: string[] }) => Promise<UserProfile>;
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

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(mockUser);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>(
    [...seededAttendanceLogs].sort((left, right) => right.attendedOn.localeCompare(left.attendedOn))
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("loading");
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stats = useMemo(() => {
    return calculatePersonalStats({
      user: profile,
      attendanceLogs,
      games,
      teams,
      venues
    });
  }, [attendanceLogs, profile]);

  async function hydrateFromStorage() {
    setPersistenceStatus("loading");
    setPersistenceError(null);

    try {
      const persistedState = await loadAppState();
      setProfile(persistedState.profile);
      setAttendanceLogs(persistedState.attendanceLogs);
      setPersistenceStatus("idle");
    } catch {
      setPersistenceStatus("error");
      setPersistenceError("We could not load your saved record from device storage.");
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
        await saveAppState({
          profile,
          attendanceLogs,
          seededDataImported: true,
          seededDataVersion: "real-mlb-history-v1"
        });
        if (canceled) {
          return;
        }

        setPersistenceStatus("saved");
        setPersistenceError(null);
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          setPersistenceStatus("idle");
        }, 1200);
      } catch {
        if (!canceled) {
          setPersistenceStatus("error");
          setPersistenceError("We could not save your latest changes to device storage.");
        }
      }
    }

    persist();

    return () => {
      canceled = true;
    };
  }, [attendanceLogs, isHydrated, profile]);

  async function addAttendanceLog(input: CreateAttendanceInput) {
    if (attendanceLogs.some((existingLog) => existingLog.userId === input.userId && existingLog.gameId === input.gameId)) {
      throw new Error("That game is already in your history.");
    }

    const log = await buildAttendanceLog(input);
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
    await clearAppState();
    setProfile(mockUser);
    setAttendanceLogs([...seededAttendanceLogs].sort((left, right) => right.attendedOn.localeCompare(left.attendedOn)));
    setPersistenceStatus("saved");
    setPersistenceError(null);
  }

  function exportAppData() {
    return serializeAppState({
      profile,
      attendanceLogs,
      seededDataImported: true,
      seededDataVersion: "real-mlb-history-v1"
    });
  }

  async function importAppData(raw: string) {
    try {
      const importedState = parseImportedAppState(raw);
      setProfile(importedState.profile);
      setAttendanceLogs(importedState.attendanceLogs);
      setPersistenceStatus("saved");
      setPersistenceError(null);
    } catch {
      setPersistenceStatus("error");
      setPersistenceError("That import payload is not valid app data.");
      throw new Error("That import payload is not valid app data.");
    }
  }

  const value: AppDataContextValue = {
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
    addAttendanceLog,
    updateProfile,
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
