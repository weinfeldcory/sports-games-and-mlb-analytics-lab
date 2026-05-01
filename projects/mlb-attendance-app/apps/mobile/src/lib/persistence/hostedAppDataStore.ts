import { attendanceLogs as seededAttendanceLogs, mockUser } from "../data/mockSportsData";
import type { AttendanceLog, UserProfile, WitnessedEvent } from "@mlb-attendance/domain";
import type {
  AppDataStore,
  AppSessionAccount,
  CurrentSessionState,
  HydratedAppDataState,
  PersistCurrentUserParams,
  SignInParams,
  SignOutParams,
  SignUpParams
} from "./appDataStore";
import { getSupabaseEnv, supabase } from "./supabaseClient";

type AttendanceLogRow = {
  id: string;
  user_id: string;
  game_id: string;
  venue_id: string;
  attended_on: string;
  seat_section: string;
  seat_row: string | null;
  seat_number: string | null;
  witnessed_events: WitnessedEvent[] | null;
  memorable_moment: string | null;
  companion: string | null;
  giveaway: string | null;
  weather: string | null;
};

type ProfileRow = {
  id: string;
  email: string;
  display_name: string;
  favorite_team_id: string | null;
  following_ids: string[] | null;
  has_completed_onboarding: boolean;
};

const RECOVERY_EMAILS = new Set(["weinfeldcory@gmail.com"]);

function sortAttendanceLogs(logs: AttendanceLog[]) {
  return [...logs].sort((left, right) => right.attendedOn.localeCompare(left.attendedOn));
}

function createSignedOutState(): HydratedAppDataState {
  return {
    accounts: [],
    currentAccount: null,
    profile: mockUser,
    attendanceLogs: sortAttendanceLogs(seededAttendanceLogs)
  };
}

function requireSupabaseClient() {
  const env = getSupabaseEnv();
  if (!env.isConfigured || !supabase) {
    throw new Error("Hosted auth is enabled but Supabase env vars are missing.");
  }

  return supabase;
}

function mapProfileRowToProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    favoriteTeamId: row.favorite_team_id ?? undefined,
    followingIds: row.following_ids ?? [],
    hasCompletedOnboarding: row.has_completed_onboarding
  };
}

function mapAttendanceRowToLog(row: AttendanceLogRow): AttendanceLog {
  return {
    id: row.id,
    userId: row.user_id,
    gameId: row.game_id,
    venueId: row.venue_id,
    attendedOn: row.attended_on,
    seat: {
      section: row.seat_section,
      row: row.seat_row ?? undefined,
      seatNumber: row.seat_number ?? undefined
    },
    witnessedEvents: row.witnessed_events ?? [],
    memorableMoment: row.memorable_moment ?? undefined,
    companion: row.companion ?? undefined,
    giveaway: row.giveaway ?? undefined,
    weather: row.weather ?? undefined
  };
}

function mapLogToAttendanceRow(log: AttendanceLog): AttendanceLogRow {
  return {
    id: log.id,
    user_id: log.userId,
    game_id: log.gameId,
    venue_id: log.venueId,
    attended_on: log.attendedOn,
    seat_section: log.seat.section.trim(),
    seat_row: log.seat.row?.trim() || null,
    seat_number: log.seat.seatNumber?.trim() || null,
    witnessed_events: log.witnessedEvents ?? [],
    memorable_moment: log.memorableMoment?.trim() || null,
    companion: log.companion?.trim() || null,
    giveaway: log.giveaway?.trim() || null,
    weather: log.weather?.trim() || null
  };
}

function buildAccount(userId: string, email: string): AppSessionAccount {
  return {
    id: userId,
    label: email
  };
}

function buildRecoveryAttendanceRows(userId: string) {
  return seededAttendanceLogs.map((log, index) =>
    mapLogToAttendanceRow({
      ...log,
      id: `recovery_${index + 1}_${log.gameId}`,
      userId
    })
  );
}

async function maybeRecoverSeededLedger(userId: string, email: string, attendanceRows: AttendanceLogRow[] | null) {
  if ((attendanceRows?.length ?? 0) > 0 || !RECOVERY_EMAILS.has(email.trim().toLowerCase())) {
    return attendanceRows ?? [];
  }

  const client = requireSupabaseClient();
  const recoveryRows = buildRecoveryAttendanceRows(userId);
  const { error: recoveryError } = await client.from("attendance_logs").upsert(recoveryRows);

  if (recoveryError) {
    throw new Error(recoveryError.message);
  }

  const { data: restoredRows, error: restoredRowsError } = await client
    .from("attendance_logs")
    .select(
      "id, user_id, game_id, venue_id, attended_on, seat_section, seat_row, seat_number, witnessed_events, memorable_moment, companion, giveaway, weather"
    )
    .eq("user_id", userId)
    .order("attended_on", { ascending: false })
    .returns<AttendanceLogRow[]>();

  if (restoredRowsError) {
    throw new Error(restoredRowsError.message);
  }

  return restoredRows ?? [];
}

async function ensureHostedProfile(userId: string, email: string, fallbackDisplayName?: string) {
  const client = requireSupabaseClient();
  const { data: existingProfile, error: fetchError } = await client
    .from("profiles")
    .select("id, email, display_name, favorite_team_id, following_ids, has_completed_onboarding")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (existingProfile) {
    return existingProfile;
  }

  const seedProfile = {
    id: userId,
    email,
    display_name: fallbackDisplayName?.trim() || email.split("@")[0] || "Fan",
    favorite_team_id: null,
    following_ids: [],
    has_completed_onboarding: false
  };

  const { data: insertedProfile, error: insertError } = await client
    .from("profiles")
    .upsert(seedProfile)
    .select("id, email, display_name, favorite_team_id, following_ids, has_completed_onboarding")
    .single<ProfileRow>();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return insertedProfile;
}

async function fetchHydratedStateForUser(userId: string, email: string, fallbackDisplayName?: string) {
  const client = requireSupabaseClient();
  const profileRow = await ensureHostedProfile(userId, email, fallbackDisplayName);
  const { data: rawAttendanceRows, error: attendanceError } = await client
    .from("attendance_logs")
    .select(
      "id, user_id, game_id, venue_id, attended_on, seat_section, seat_row, seat_number, witnessed_events, memorable_moment, companion, giveaway, weather"
    )
    .eq("user_id", userId)
    .order("attended_on", { ascending: false })
    .returns<AttendanceLogRow[]>();

  if (attendanceError) {
    throw new Error(attendanceError.message);
  }

  const attendanceRows = await maybeRecoverSeededLedger(userId, email, rawAttendanceRows ?? []);

  return {
    accounts: [buildAccount(userId, email)],
    currentAccount: buildAccount(userId, email),
    profile: mapProfileRowToProfile(profileRow),
    attendanceLogs: (attendanceRows ?? []).map(mapAttendanceRowToLog)
  } satisfies HydratedAppDataState;
}

async function syncHostedState(params: PersistCurrentUserParams) {
  if (!params.currentAccountId) {
    return;
  }

  const client = requireSupabaseClient();
  const {
    data: { session },
    error: sessionError
  } = await client.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session?.user) {
    throw new Error("Your hosted session expired. Sign in again.");
  }

  const email = session.user.email;
  if (!email) {
    throw new Error("Hosted account is missing an email address.");
  }

  const { error: profileError } = await client.from("profiles").upsert({
    id: session.user.id,
    email,
    display_name: params.profile.displayName.trim(),
    favorite_team_id: params.profile.favoriteTeamId ?? null,
    following_ids: params.profile.followingIds ?? [],
    has_completed_onboarding: params.profile.hasCompletedOnboarding ?? false
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  const nextRows = params.attendanceLogs.map((log) =>
    mapLogToAttendanceRow({
      ...log,
      userId: session.user.id
    })
  );

  const { data: existingRows, error: existingRowsError } = await client
    .from("attendance_logs")
    .select("id")
    .eq("user_id", session.user.id)
    .returns<Array<{ id: string }>>();

  if (existingRowsError) {
    throw new Error(existingRowsError.message);
  }

  const nextIds = new Set(nextRows.map((row) => row.id));
  const idsToDelete = (existingRows ?? []).map((row) => row.id).filter((id) => !nextIds.has(id));

  if (nextRows.length > 0) {
    const { error: upsertLogsError } = await client.from("attendance_logs").upsert(nextRows);
    if (upsertLogsError) {
      throw new Error(upsertLogsError.message);
    }
  }

  if (idsToDelete.length > 0) {
    const { error: deleteLogsError } = await client
      .from("attendance_logs")
      .delete()
      .eq("user_id", session.user.id)
      .in("id", idsToDelete);

    if (deleteLogsError) {
      throw new Error(deleteLogsError.message);
    }
  }
}

export const hostedAppDataStore: AppDataStore = {
  kind: "hosted",
  async hydrate() {
    const client = requireSupabaseClient();
    const {
      data: { session },
      error
    } = await client.auth.getSession();

    if (error) {
      throw new Error(error.message);
    }

    if (!session?.user?.email) {
      return createSignedOutState();
    }

    return fetchHydratedStateForUser(
      session.user.id,
      session.user.email,
      session.user.user_metadata?.display_name as string | undefined
    );
  },
  persistCurrentUser: syncHostedState,
  async signIn(params: SignInParams) {
    const client = requireSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: params.identifier.trim(),
      password: params.password
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user?.email) {
      throw new Error("Hosted sign-in did not return a usable session.");
    }

    return fetchHydratedStateForUser(data.user.id, data.user.email, data.user.user_metadata?.display_name as string | undefined);
  },
  async signUp(params: SignUpParams) {
    const client = requireSupabaseClient();
    const { data, error } = await client.auth.signUp({
      email: params.identifier.trim(),
      password: params.password,
      options: {
        data: {
          display_name: params.displayName?.trim() || params.identifier.trim().split("@")[0] || "Fan"
        }
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user?.email) {
      throw new Error("Hosted sign-up did not return a usable account.");
    }

    if (!data.session) {
      throw new Error("Sign-up succeeded, but email confirmation is still required before the ledger can open.");
    }

    return fetchHydratedStateForUser(
      data.user.id,
      data.user.email,
      (data.user.user_metadata?.display_name as string | undefined) ?? params.displayName
    );
  },
  async signOut(params: SignOutParams) {
    await syncHostedState(params.currentSession);

    const client = requireSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }

    return createSignedOutState();
  }
};
