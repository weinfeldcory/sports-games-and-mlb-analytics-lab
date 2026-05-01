import * as Clipboard from "expo-clipboard";
import { Redirect } from "expo-router";
import type { Href } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "../src/components/common/PrimaryButton";
import { Screen } from "../src/components/common/Screen";
import { SectionCard } from "../src/components/common/SectionCard";
import { getHostedBackendMode, getSupabaseEnv } from "../src/lib/persistence/supabaseClient";
import { APP_COMMIT_SHA, APP_VERSION, formatTimestamp, getDeviceInfo } from "../src/lib/runtimeInfo";
import { useAppData } from "../src/providers/AppDataProvider";
import { colors, spacing } from "../src/styles/tokens";

function buildDebugSummary(params: {
  storageMode: "local" | "hosted";
  runtimeBackendFlag: "local" | "hosted";
  supabaseUrlConfigured: boolean;
  supabaseAnonConfigured: boolean;
  accountLabel: string | null;
  currentUserId: string | null;
  profileId: string;
  attendanceLogCount: number;
  persistenceStatus: string;
  lastHydratedAt: string | null;
  lastSavedAt: string | null;
  persistenceError: string | null;
}) {
  return [
    `appVersion=${APP_VERSION}`,
    `appCommit=${APP_COMMIT_SHA ?? "not-set"}`,
    `storageMode=${params.storageMode}`,
    `runtimeBackendFlag=${params.runtimeBackendFlag}`,
    `supabaseUrlConfigured=${params.supabaseUrlConfigured ? "yes" : "no"}`,
    `supabaseAnonConfigured=${params.supabaseAnonConfigured ? "yes" : "no"}`,
    `accountLabel=${params.accountLabel ?? "none"}`,
    `currentUserId=${params.currentUserId ?? "none"}`,
    `profileId=${params.profileId}`,
    `loadedAttendanceLogs=${String(params.attendanceLogCount)}`,
    `persistenceStatus=${params.persistenceStatus}`,
    `lastHydration=${params.lastHydratedAt ?? "none"}`,
    `lastSave=${params.lastSavedAt ?? "none"}`,
    `lastError=${params.persistenceError ?? "none"}`,
    `device=${getDeviceInfo()}`
  ].join("\n");
}

export default function DebugScreen() {
  const authRoute = "/auth" as Href;
  const {
    isHydrated,
    isAuthenticated,
    storageMode,
    currentAccountLabel,
    currentUserId,
    profile,
    attendanceLogs,
    persistenceStatus,
    persistenceError,
    lastHydratedAt,
    lastSavedAt
  } = useAppData();
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const runtimeBackendFlag = getHostedBackendMode() ? "hosted" : "local";
  const supabaseEnv = getSupabaseEnv();
  const debugSummary = buildDebugSummary({
    storageMode,
    runtimeBackendFlag,
    supabaseUrlConfigured: Boolean(supabaseEnv.url),
    supabaseAnonConfigured: Boolean(supabaseEnv.anonKey),
    accountLabel: currentAccountLabel,
    currentUserId,
    profileId: profile.id,
    attendanceLogCount: attendanceLogs.length,
    persistenceStatus,
    lastHydratedAt,
    lastSavedAt,
    persistenceError
  });

  if (isHydrated && !isAuthenticated) {
    return <Redirect href={authRoute} />;
  }

  async function handleCopyDebugInfo() {
    await Clipboard.setStringAsync(debugSummary);
    setCopyMessage("Copied sanitized beta debug info.");
  }

  return (
    <Screen
      title="Beta Debug"
      subtitle="Use this page to confirm whether the app is running in hosted sync or local-only mode and to capture a safe diagnostic summary for beta support."
    >
      <SectionCard title="Runtime">
        <View style={styles.metaList}>
          <Text style={styles.metaRow}>App version: {APP_VERSION}</Text>
          <Text style={styles.metaRow}>Commit hash: {APP_COMMIT_SHA ?? "Not set"}</Text>
          <Text style={styles.metaRow}>Storage mode: {storageMode}</Text>
          <Text style={styles.metaRow}>Backend flag: {runtimeBackendFlag}</Text>
          <Text style={styles.metaRow}>Supabase URL configured: {supabaseEnv.url ? "Yes" : "No"}</Text>
          <Text style={styles.metaRow}>Supabase anon key configured: {supabaseEnv.anonKey ? "Yes" : "No"}</Text>
          <Text style={styles.metaRow}>Device info: {getDeviceInfo()}</Text>
        </View>
      </SectionCard>

      <SectionCard title="Account">
        <View style={styles.metaList}>
          <Text style={styles.metaRow}>Signed-in account: {currentAccountLabel ?? "None"}</Text>
          <Text style={styles.metaRow}>Current user ID: {currentUserId ?? "None"}</Text>
          <Text style={styles.metaRow}>Current profile ID: {profile.id}</Text>
          <Text style={styles.metaRow}>Loaded attendance logs: {attendanceLogs.length}</Text>
        </View>
      </SectionCard>

      <SectionCard title="Sync Health">
        <View style={styles.metaList}>
          <Text style={styles.metaRow}>Persistence status: {persistenceStatus}</Text>
          <Text style={styles.metaRow}>Last hydration: {formatTimestamp(lastHydratedAt)}</Text>
          <Text style={styles.metaRow}>Last successful save: {formatTimestamp(lastSavedAt)}</Text>
        </View>
        {persistenceError ? <Text style={styles.errorText}>Last error: {persistenceError}</Text> : null}
        <View style={styles.actionStack}>
          <PrimaryButton label="Copy Debug Info" onPress={handleCopyDebugInfo} />
          <Pressable>
            <Text selectable style={styles.debugSummary}>
              {debugSummary}
            </Text>
          </Pressable>
        </View>
        {copyMessage ? <Text style={styles.successText}>{copyMessage}</Text> : null}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaList: {
    gap: spacing.xs
  },
  metaRow: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.slate700
  },
  actionStack: {
    gap: spacing.sm
  },
  debugSummary: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.slate500,
    backgroundColor: colors.slate050,
    borderRadius: 14,
    padding: spacing.md
  },
  successText: {
    fontSize: 14,
    color: colors.green
  },
  errorText: {
    fontSize: 14,
    color: colors.red
  }
});
