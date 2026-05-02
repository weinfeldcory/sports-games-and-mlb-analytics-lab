import { Redirect, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { PrimaryButton } from "../src/components/common/PrimaryButton";
import { LabeledInput } from "../src/components/common/LabeledInput";
import { SectionCard } from "../src/components/common/SectionCard";
import { useAppData } from "../src/providers/AppDataProvider";
import { colors, spacing } from "../src/styles/tokens";

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isHydrated, isAuthenticated, profile, teams, completeOnboarding } = useAppData();
  const isWide = width >= 1024;
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [favoriteTeamId, setFavoriteTeamId] = useState(profile.favoriteTeamId ?? "");
  const [error, setError] = useState<string | null>(null);
  const totalSteps = 4;

  if (!isHydrated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingShell}>
          <Text style={styles.loadingText}>Loading your local MLB record...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href={"/auth" as Href} />;
  }

  if (profile.hasCompletedOnboarding) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleContinue() {
    if (!displayName.trim()) {
      setError("Add the name you want attached to your logbook.");
      return;
    }

    await completeOnboarding({
      displayName,
      favoriteTeamId
    });
    setError(null);
    router.replace("/(tabs)/log-game");
  }

  function goNext() {
    if (step === 1 && !displayName.trim()) {
      setError("Add the name you want attached to your ledger.");
      return;
    }

    setError(null);
    setStep((current) => Math.min(totalSteps - 1, current + 1));
  }

  function goBack() {
    setError(null);
    setStep((current) => Math.max(0, current - 1));
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardShell}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView contentContainerStyle={[styles.scroll, width < 640 ? styles.scrollCompact : null]} keyboardShouldPersistTaps="handled">
          <View style={styles.backgroundOrbOne} />
          <View style={styles.backgroundOrbTwo} />

          <View style={styles.shell}>
            <View style={[styles.hero, width < 640 ? styles.heroCompact : null]}>
              <Text style={styles.eyebrow}>First Run Setup</Text>
              <Text style={styles.title}>Build your personal MLB attendance ledger.</Text>
              <Text style={styles.subtitle}>
                A fast setup now gives your first game a home, unlocks personal stats, and keeps the next step obvious.
              </Text>
              <View style={styles.progressRow}>
                {Array.from({ length: totalSteps }).map((_, index) => (
                  <View key={index} style={[styles.progressDot, index <= step ? styles.progressDotActive : null]} />
                ))}
              </View>
            </View>

            <View style={[styles.grid, isWide ? styles.gridWide : null]}>
              <View style={styles.mainColumn}>
                <SectionCard title={`Step ${step + 1} of ${totalSteps}`}>
                {step === 0 ? (
                  <View style={styles.stepStack}>
                    <Text style={styles.stepTitle}>Build your personal MLB attendance ledger.</Text>
                    <Text style={styles.stepBody}>
                      Save every game you attend, keep the memory details you care about, and turn that record into personal baseball stats.
                    </Text>
                    <Text style={styles.stepHint}>This setup takes under a minute.</Text>
                  </View>
                ) : null}

                {step === 1 ? (
                  <View style={styles.stepStack}>
                    <Text style={styles.stepTitle}>What name should appear on your ledger?</Text>
                    <LabeledInput
                      label="Display name"
                      value={displayName}
                      onChangeText={setDisplayName}
                      placeholder="Your name"
                      error={error ?? undefined}
                    />
                  </View>
                ) : null}

                {step === 2 ? (
                  <View style={styles.stepStack}>
                    <Text style={styles.stepTitle}>Pick your favorite MLB team.</Text>
                    <Text style={styles.stepBody}>This unlocks cleaner record splits and more personal context on the dashboard.</Text>
                    <View style={[styles.teamGrid, isWide ? styles.teamGridWide : null]}>
                      {teams.map((team) => {
                        const isSelected = favoriteTeamId === team.id;

                        return (
                          <Pressable
                            key={team.id}
                            onPress={() => setFavoriteTeamId(isSelected ? "" : team.id)}
                            style={[styles.teamOption, isSelected ? styles.teamOptionSelected : null]}
                          >
                            <Text style={styles.teamTitle}>
                              {team.city} {team.name}
                            </Text>
                            <Text style={styles.teamSubtitle}>{team.abbreviation}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {step === 3 ? (
                  <View style={styles.stepStack}>
                    <Text style={styles.stepTitle}>Logged games unlock your baseball record.</Text>
                    <View style={styles.bulletStack}>
                      <Text style={styles.listItem}>See your total games, stadiums, and in-person record.</Text>
                      <Text style={styles.listItem}>Track hitters, pitchers, and witnessed home runs when player data is available.</Text>
                      <Text style={styles.listItem}>Add seat details now and memories later.</Text>
                    </View>
                    <Text style={styles.stepHint}>Next step: log your first game.</Text>
                  </View>
                ) : null}

                <View style={styles.actionRow}>
                  {step > 0 ? (
                    <Pressable onPress={goBack}>
                      <Text style={styles.linkText}>Back</Text>
                    </Pressable>
                  ) : (
                    <View />
                  )}
                  <View style={styles.primaryActionWrap}>
                    {step < totalSteps - 1 ? (
                      <PrimaryButton label="Continue" onPress={goNext} />
                    ) : (
                      <PrimaryButton label="Log your first game" onPress={handleContinue} />
                    )}
                  </View>
                </View>
                </SectionCard>
              </View>

              <View style={styles.sideColumn}>
                <SectionCard title="What You Unlock">
                  <View style={styles.list}>
                    <Text style={styles.listItem}>A personal ledger of every MLB game you’ve attended.</Text>
                    <Text style={styles.listItem}>Favorite-team record, stadium count, and progress milestones.</Text>
                    <Text style={styles.listItem}>Witnessed hitter and pitcher insights when game player data is available.</Text>
                  </View>
                </SectionCard>

                <SectionCard title="Flexible Later">
                  <View style={styles.list}>
                    <Text style={styles.listItem}>You can change your display name and favorite team later.</Text>
                    <Text style={styles.listItem}>Memory fields like companion, giveaway, and weather can wait until after the save.</Text>
                    <Text style={styles.listItem}>This is an independent fan product, not an official MLB or team app.</Text>
                  </View>
                </SectionCard>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  keyboardShell: {
    flex: 1
  },
  scroll: {
    minHeight: "100%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg
  },
  scrollCompact: {
    paddingHorizontal: spacing.sm
  },
  loadingShell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl
  },
  loadingText: {
    fontSize: 16,
    color: colors.slate700
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
  hero: {
    backgroundColor: colors.navy,
    borderRadius: 26,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.sm
  },
  heroCompact: {
    borderRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg
  },
  eyebrow: {
    color: colors.amber,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: "700"
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    color: colors.white,
    maxWidth: 720
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(255,253,248,0.86)",
    maxWidth: 840
  },
  progressRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  progressDot: {
    width: 28,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,253,248,0.2)"
  },
  progressDotActive: {
    backgroundColor: colors.amber
  },
  grid: {
    gap: spacing.lg
  },
  gridWide: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  mainColumn: {
    flex: 1,
    gap: spacing.lg
  },
  sideColumn: {
    flex: 0.95,
    gap: spacing.lg
  },
  list: {
    gap: spacing.sm
  },
  listItem: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.slate700
  },
  stepStack: {
    gap: spacing.md
  },
  stepTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: colors.slate900
  },
  stepBody: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.slate700
  },
  stepHint: {
    fontSize: 14,
    color: colors.navy,
    fontWeight: "700"
  },
  bulletStack: {
    gap: spacing.sm
  },
  teamHeader: {
    gap: spacing.xs
  },
  teamHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.slate900
  },
  teamHeaderCopy: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.slate500
  },
  teamGrid: {
    gap: spacing.sm
  },
  teamGridWide: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  teamOption: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.white,
    minWidth: 180,
    flexGrow: 1
  },
  teamOptionSelected: {
    borderColor: colors.navy,
    backgroundColor: colors.slate100
  },
  teamTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.slate900
  },
  teamSubtitle: {
    fontSize: 13,
    color: colors.slate500
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md
  },
  primaryActionWrap: {
    minWidth: 220
  },
  linkText: {
    fontSize: 14,
    color: colors.navy,
    fontWeight: "700"
  }
});
