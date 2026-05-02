import { ReactNode } from "react";
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useAppData } from "../../providers/AppDataProvider";
import { useResponsiveLayout } from "../../styles/responsive";
import { colors, radii, shadows, spacing } from "../../styles/tokens";
import { PageHeader } from "./PageHeader";
import { StatusPill } from "./StatusPill";

interface AppShellProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  scrollable?: boolean;
}

const navItems: { href: Href; label: string; shortLabel: string }[] = [
  { href: "/(tabs)", label: "Home", shortLabel: "Home" },
  { href: "/(tabs)/log-game", label: "Log Game", shortLabel: "Log Game" },
  { href: "/(tabs)/history", label: "History", shortLabel: "History" },
  { href: "/(tabs)/stats", label: "Stats", shortLabel: "Stats" },
  { href: "/(tabs)/profile", label: "Profile", shortLabel: "Profile" }
];

function normalizePathname(pathname: string) {
  if (pathname === "/" || pathname === "/index") {
    return "/(tabs)";
  }
  return pathname;
}

export function AppShell({ title, subtitle, children, scrollable = true }: AppShellProps) {
  const router = useRouter();
  const pathname = normalizePathname(usePathname());
  const isWeb = Platform.OS === "web";
  const responsive = useResponsiveLayout();
  const showTopNav = isWeb;
  const {
    currentAccountLabel,
    profile,
    persistenceStatus,
    persistenceError,
    storageMode,
    lastSavedAt
  } = useAppData();

  const statusTone =
    persistenceStatus === "error"
      ? "danger"
      : persistenceStatus === "saving"
        ? "warning"
        : storageMode === "hosted"
          ? "success"
          : "default";
  const statusLabel =
    persistenceStatus === "error"
      ? "Sync issue"
      : persistenceStatus === "saving"
        ? "Saving"
        : storageMode === "hosted"
          ? "Hosted Sync Active"
          : "Local Only";

  const header = (
    <View
      style={[
        styles.topBar,
        responsive.isDesktop ? styles.topBarDesktop : null,
        responsive.isCompact ? styles.topBarCompact : null,
        { paddingHorizontal: responsive.pagePadding, paddingVertical: responsive.isCompact ? spacing.sm : spacing.md }
      ]}
    >
      <View style={styles.brandCluster}>
        <Pressable onPress={() => router.push("/(tabs)")} style={styles.brandMark}>
          <Text style={styles.brandMarkText}>BL</Text>
        </Pressable>
        <View style={styles.brandCopy}>
          <Text style={styles.brandEyebrow}>Personal MLB Record</Text>
          <Text style={styles.brandTitle}>Ballpark Ledger</Text>
        </View>
      </View>

      {showTopNav ? (
        <View style={styles.navRow}>
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Pressable key={item.label} onPress={() => router.push(item.href)} style={[styles.navItem, active ? styles.navItemActive : null]}>
                <Text style={[styles.navItemLabel, active ? styles.navItemLabelActive : null]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={[styles.accountCluster, responsive.isCompact ? styles.accountClusterCompact : null]}>
        <StatusPill label={statusLabel} tone={statusTone} />
        <Pressable
          onPress={() => router.push("/(tabs)/profile")}
          style={[styles.accountButton, responsive.isCompact ? styles.accountButtonCompact : null]}
        >
          <Text style={styles.accountButtonLabel}>
            {profile.displayName || currentAccountLabel || "Profile"}
          </Text>
          <Text style={styles.accountButtonMeta}>
            {persistenceError
              ? persistenceError
              : lastSavedAt
                ? `Saved ${new Date(lastSavedAt).toLocaleDateString()}`
                : storageMode === "hosted"
                  ? "Hosted account"
                  : "This device"}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const body = (
    <>
      {title ? <PageHeader eyebrow="App" title={title} subtitle={subtitle} /> : null}
      <View style={styles.body}>{children}</View>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        style={[
          styles.content,
          {
            paddingHorizontal: responsive.isCompact ? spacing.sm : spacing.md,
            paddingTop: spacing.md,
            paddingBottom: spacing.md
          }
        ]}
      >
        <View style={styles.backgroundGlowTop} />
        <View style={styles.backgroundGlowBottom} />

        <View style={styles.shell}>
          {header}
          {scrollable ? (
            <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scrollArea}>
              {body}
            </ScrollView>
          ) : (
            <View style={styles.staticBody}>{body}</View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  content: {
    flex: 1,
    position: "relative"
  },
  backgroundGlowTop: {
    position: "absolute",
    top: -90,
    right: -30,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: colors.info,
    opacity: 0.75
  },
  backgroundGlowBottom: {
    position: "absolute",
    bottom: -10,
    left: -70,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: colors.surfaceWarning,
    opacity: 0.65
  },
  shell: {
    flex: 1,
    width: "100%",
    maxWidth: 1220,
    alignSelf: "center",
    gap: spacing.lg
  },
  scrollArea: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: spacing.xxl
  },
  staticBody: {
    flex: 1
  },
  topBar: {
    backgroundColor: "rgba(255,253,248,0.78)",
    borderWidth: 1,
    borderColor: "rgba(199,183,157,0.55)",
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    ...shadows.subtle
  },
  topBarCompact: {
    borderRadius: radii.lg
  },
  topBarDesktop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  brandCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center"
  },
  brandMarkText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.8
  },
  brandCopy: {
    gap: 2
  },
  brandEyebrow: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: "800",
    color: colors.clay
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.text
  },
  navRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  navItem: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    justifyContent: "center"
  },
  navItemActive: {
    backgroundColor: colors.primary
  },
  navItemLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textMuted
  },
  navItemLabelActive: {
    color: colors.textInverse
  },
  accountCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap"
  },
  accountClusterCompact: {
    alignItems: "stretch"
  },
  accountButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    justifyContent: "center"
  },
  accountButtonCompact: {
    flex: 1,
    minWidth: 180
  },
  accountButtonLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.primary
  },
  accountButtonMeta: {
    fontSize: 11,
    color: colors.textSoft
  },
  body: {
    gap: spacing.lg
  },
});
