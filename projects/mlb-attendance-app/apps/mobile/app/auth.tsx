import { Redirect } from "expo-router";
import { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LabeledInput } from "../src/components/common/LabeledInput";
import { PrimaryButton } from "../src/components/common/PrimaryButton";
import { SectionCard } from "../src/components/common/SectionCard";
import { useAppData } from "../src/providers/AppDataProvider";
import { colors, spacing } from "../src/styles/tokens";

export default function AuthScreen() {
  const { width } = useWindowDimensions();
  const { storageMode, isHydrated, isAuthenticated, profile, signIn, signUp } = useAppData();
  const isWide = width >= 1024;
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isHosted = storageMode === "hosted";
  const identifierLabel = isHosted ? "Email" : "Username";
  const identifierPlaceholder = isHosted ? "fan@example.com" : "cory";
  const loadingCopy = isHosted ? "Loading your hosted account..." : "Loading local accounts...";

  if (!isHydrated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingShell}>
          <Text style={styles.loadingText}>{loadingCopy}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isAuthenticated) {
    return <Redirect href={profile.hasCompletedOnboarding ? "/(tabs)" : "/onboarding"} />;
  }

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "signin") {
        await signIn({ identifier, password });
      } else {
        await signUp({ identifier, password, displayName });
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : isHosted
            ? "We could not open that hosted account."
            : "We could not open that local account."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.backgroundOrbOne} />
        <View style={styles.backgroundOrbTwo} />

        <View style={styles.shell}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>
              {mode === "signup" ? "Create Account" : isHosted ? "Hosted Accounts" : "Local Accounts"}
            </Text>
            <Text style={styles.title}>
              {mode === "signup"
                ? "Create your baseball ledger."
                : isHosted
                  ? "Open your MLB attendance ledger from any device and keep it synced."
                  : "Keep separate MLB ledgers for different people on one device."}
            </Text>
            <Text style={styles.subtitle}>
              {mode === "signup"
                ? "Save your games and build your attendance history."
                : isHosted
                  ? "Use an email and password to keep your attendance history, profile, and stats available anywhere you sign in."
                  : "This is lightweight local-only access control. Each username keeps its own attendance history, profile, and stats in this browser or device storage."}
            </Text>
          </View>

          <View style={[styles.grid, isWide ? styles.gridWide : null]}>
            {mode === "signin" ? (
              <View style={styles.mainColumn}>
                <SectionCard title="What This Does">
                  <View style={styles.list}>
                    <Text style={styles.listItem}>
                      {isHosted
                        ? "Each account keeps its own ledger so friends can use the same app from different devices."
                        : "Each username has a separate saved ledger and can return later."}
                    </Text>
                    <Text style={styles.listItem}>
                      {isHosted
                        ? "Your profile and attendance history sync through the hosted backend instead of staying trapped on one browser."
                        : "This is local device storage, not cloud sync or production-grade authentication."}
                    </Text>
                    <Text style={styles.listItem}>
                      {isHosted
                        ? "Import and export still work as backup rails while the product moves from local ledgers to hosted accounts."
                        : "You can still export and import an individual person’s record after signing in."}
                    </Text>
                  </View>
                </SectionCard>
              </View>
            ) : null}

            <View style={styles.sideColumn}>
              <SectionCard title={mode === "signin" ? "Sign In" : "Create account"}>
                {mode === "signin" ? (
                  <View style={styles.modeRow}>
                    <PrimaryButton label="Sign In" onPress={() => setMode("signin")} />
                    <PrimaryButton label="Create Account" onPress={() => setMode("signup")} />
                  </View>
                ) : null}
                {mode === "signup" ? (
                  <LabeledInput
                    label="Display name"
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Cory"
                  />
                ) : null}
                <LabeledInput
                  label={identifierLabel}
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder={identifierPlaceholder}
                  autoCapitalize="none"
                  keyboardType={isHosted ? "email-address" : "default"}
                />
                <LabeledInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  autoCapitalize="none"
                  secureTextEntry
                />
                <PrimaryButton
                  label={
                    isSubmitting
                      ? "Saving..."
                      : mode === "signin"
                        ? "Open Ledger"
                        : "Create account"
                  }
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                />
                {mode === "signup" ? (
                  <View style={styles.secondaryActionRow}>
                    <Text style={styles.secondaryActionCopy}>Already have an account?</Text>
                    <Pressable onPress={() => setMode("signin")}>
                      <Text style={styles.secondaryActionLink}>Log in</Text>
                    </Pressable>
                  </View>
                ) : null}
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </SectionCard>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  scroll: {
    minHeight: "100%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg
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
    maxWidth: 760
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(255,253,248,0.86)",
    maxWidth: 840
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
  modeRow: {
    gap: spacing.sm
  },
  secondaryActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs
  },
  secondaryActionCopy: {
    fontSize: 14,
    color: colors.slate500
  },
  secondaryActionLink: {
    fontSize: 14,
    color: colors.navy,
    fontWeight: "700"
  },
  errorText: {
    fontSize: 14,
    color: colors.red
  }
});
