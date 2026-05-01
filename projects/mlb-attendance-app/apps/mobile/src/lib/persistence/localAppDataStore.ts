import { mockUser } from "../data/mockSportsData";
import {
  createLocalAccount,
  loadRootState,
  saveRootState,
  type LocalAccountRecord
} from "../storage/appRepository";
import type { AttendanceLog, UserProfile } from "@mlb-attendance/domain";
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

function sortAttendanceLogs(logs: AttendanceLog[]) {
  return [...logs].sort((left, right) => right.attendedOn.localeCompare(left.attendedOn));
}

function summarizeAccounts(accounts: LocalAccountRecord[]): AppSessionAccount[] {
  return accounts.map((account) => ({
    id: account.id,
    label: account.username
  }));
}

function buildSignedOutState(accounts: LocalAccountRecord[]): HydratedAppDataState {
  return {
    accounts: summarizeAccounts(accounts),
    currentAccount: null,
    currentUserId: null,
    profile: mockUser,
    attendanceLogs: []
  };
}

function buildHydratedState(
  accounts: LocalAccountRecord[],
  currentUserId: string | null
): HydratedAppDataState {
  const currentAccount = accounts.find((account) => account.id === currentUserId) ?? null;
  if (!currentAccount) {
    return buildSignedOutState(accounts);
  }

  return {
    accounts: summarizeAccounts(accounts),
    currentAccount: {
      id: currentAccount.id,
      label: currentAccount.username
    },
    currentUserId: currentAccount.id,
    profile: currentAccount.profile,
    attendanceLogs: sortAttendanceLogs(currentAccount.attendanceLogs)
  };
}

function syncCurrentSessionIntoAccounts(
  accounts: LocalAccountRecord[],
  currentSession: CurrentSessionState
): LocalAccountRecord[] {
  if (!currentSession.currentUserId) {
    return accounts;
  }

  return accounts.map((account) =>
    account.id === currentSession.currentUserId
      ? {
          ...account,
          profile: currentSession.profile,
          attendanceLogs: sortAttendanceLogs(currentSession.attendanceLogs)
        }
      : account
  );
}

async function persistSignedInState(params: PersistCurrentUserParams) {
  const rootState = await loadRootState();
  const accounts = syncCurrentSessionIntoAccounts(rootState.accounts, params);
  await saveRootState({
    currentUserId: params.currentUserId,
    accounts
  });
}

async function signIn(params: SignInParams): Promise<HydratedAppDataState> {
  const rootState = await loadRootState();
  const syncedAccounts = syncCurrentSessionIntoAccounts(rootState.accounts, params.currentSession);
  const normalizedUsername = params.identifier.trim().toLowerCase();
  const account = syncedAccounts.find((candidate) => candidate.username === normalizedUsername);

  if (!account || account.password !== params.password) {
    throw new Error("That username and password do not match a saved local account.");
  }

  await saveRootState({
    currentUserId: account.id,
    accounts: syncedAccounts
  });

  return buildHydratedState(syncedAccounts, account.id);
}

async function signUp(params: SignUpParams): Promise<HydratedAppDataState> {
  const normalizedUsername = params.identifier.trim().toLowerCase();
  if (!normalizedUsername) {
    throw new Error("Choose a username.");
  }

  if (!params.password.trim()) {
    throw new Error("Add a password.");
  }

  const rootState = await loadRootState();
  const syncedAccounts = syncCurrentSessionIntoAccounts(rootState.accounts, params.currentSession);
  if (syncedAccounts.some((account) => account.username === normalizedUsername)) {
    throw new Error("That username is already taken on this device.");
  }

  const account = createLocalAccount(params);
  const nextAccounts = [...syncedAccounts, account];

  await saveRootState({
    currentUserId: account.id,
    accounts: nextAccounts
  });

  return buildHydratedState(nextAccounts, account.id);
}

async function signOut(params: SignOutParams): Promise<HydratedAppDataState> {
  const rootState = await loadRootState();
  const syncedAccounts = syncCurrentSessionIntoAccounts(rootState.accounts, params.currentSession);

  await saveRootState({
    currentUserId: null,
    accounts: syncedAccounts
  });

  return buildSignedOutState(syncedAccounts);
}

export const localAppDataStore: AppDataStore = {
  kind: "local",
  async hydrate() {
    const rootState = await loadRootState();
    return buildHydratedState(rootState.accounts, rootState.currentUserId);
  },
  persistCurrentUser: persistSignedInState,
  signIn,
  signUp,
  signOut
};
