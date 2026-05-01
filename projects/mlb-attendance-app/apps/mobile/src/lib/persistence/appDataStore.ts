import type { AttendanceLog, UserProfile } from "@mlb-attendance/domain";

export interface AppSessionAccount {
  id: string;
  label: string;
}

export interface CurrentSessionState {
  currentUserId: string | null;
  profile: UserProfile;
  attendanceLogs: AttendanceLog[];
}

export interface HydratedAppDataState {
  accounts: AppSessionAccount[];
  currentAccount: AppSessionAccount | null;
  currentUserId: string | null;
  profile: UserProfile;
  attendanceLogs: AttendanceLog[];
}

export interface SignInParams {
  identifier: string;
  password: string;
  currentSession: CurrentSessionState;
}

export interface SignUpParams {
  identifier: string;
  password: string;
  displayName?: string;
  currentSession: CurrentSessionState;
}

export interface SignOutParams {
  currentSession: CurrentSessionState;
}

export interface PersistCurrentUserParams extends CurrentSessionState {}

export interface AppDataStore {
  kind: "local" | "hosted";
  hydrate: () => Promise<HydratedAppDataState>;
  persistCurrentUser: (params: PersistCurrentUserParams) => Promise<void>;
  signIn: (params: SignInParams) => Promise<HydratedAppDataState>;
  signUp: (params: SignUpParams) => Promise<HydratedAppDataState>;
  signOut: (params: SignOutParams) => Promise<HydratedAppDataState>;
}
