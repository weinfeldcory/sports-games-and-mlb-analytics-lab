import { ReactNode } from "react";
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { usePathname, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { colors, spacing } from "../../styles/tokens";

interface ScreenProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  scrollable?: boolean;
}

export function Screen({ title, subtitle, children, scrollable = true }: ScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isWide = width >= 960;
  const navItems: { href: Href; label: string }[] = [
    { href: "/(tabs)", label: "Home" },
    { href: "/(tabs)/log-game", label: "Log Game" },
    { href: "/(tabs)/history", label: "History" },
    { href: "/(tabs)/stats", label: "Stats" },
    { href: "/(tabs)/profile", label: "Profile" }
  ];

  const content = (
    <View style={styles.content}>
      <View style={styles.backgroundOrbOne} />
      <View style={styles.backgroundOrbTwo} />

      <View style={styles.shell}>
        <View style={[styles.topBar, isWide ? styles.topBarWide : null]}>
          <View style={styles.brandBlock}>
            <Text style={styles.eyebrow}>Personal MLB Record</Text>
            <Text style={styles.brandTitle}>Ballpark Ledger</Text>
          </View>

          <View style={[styles.navRow, isWide ? styles.navRowWide : null]}>
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Pressable
                  key={item.label}
                  onPress={() => router.push(item.href)}
                  style={[styles.navChip, isActive ? styles.navChipActive : null]}
                >
                  <Text style={[styles.navLabel, isActive ? styles.navLabelActive : null]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={styles.kicker}>Web-first attendance journal</Text>
              <Text style={styles.title}>{title}</Text>
            </View>
            <Text style={styles.heroBadge}>MLB</Text>
          </View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.body}>{children}</View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {scrollable ? <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  scroll: {
    paddingBottom: spacing.xxl
  },
  content: {
    minHeight: "100%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    position: "relative"
  },
  backgroundOrbOne: {
    position: "absolute",
    top: -80,
    right: -30,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: colors.sky,
    opacity: 0.8
  },
  backgroundOrbTwo: {
    position: "absolute",
    bottom: 40,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: colors.slate100,
    opacity: 0.75
  },
  shell: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    gap: spacing.lg
  },
  topBar: {
    gap: spacing.md
  },
  topBarWide: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  brandBlock: {
    gap: spacing.xs
  },
  eyebrow: {
    color: colors.clay,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: "700"
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.slate900
  },
  navRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  navRowWide: {
    justifyContent: "flex-end"
  },
  navChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: "rgba(255,253,248,0.8)",
    cursor: "pointer"
  },
  navChipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy
  },
  navLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.slate700
  },
  navLabelActive: {
    color: colors.white
  },
  hero: {
    backgroundColor: colors.navy,
    borderRadius: 26,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
    shadowColor: colors.navy,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs
  },
  heroBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.navy,
    backgroundColor: colors.amber,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden"
  },
  kicker: {
    color: colors.amber,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: "700"
  },
  body: {
    gap: spacing.md
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.white,
    lineHeight: 36
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,253,248,0.82)",
    maxWidth: 840
  }
});
