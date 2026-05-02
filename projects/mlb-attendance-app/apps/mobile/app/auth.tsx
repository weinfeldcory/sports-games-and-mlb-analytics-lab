import { Redirect, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LabeledInput } from "../src/components/common/LabeledInput";
import { PrimaryButton } from "../src/components/common/PrimaryButton";
import { SectionCard } from "../src/components/common/SectionCard";
import { useAppData } from "../src/providers/AppDataProvider";
import { colors, spacing } from "../src/styles/tokens";

function toFriendlyAuthErrorMessage(error: unknown, isHosted: boolean) {
  const fallbackMessage = isHosted
    ? "We could not open that hosted account."
    : "We could not open that local account.";

  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  const normalized = error.message.toLowerCase();
  if (
    isHosted
    && (normalized.includes("schema cache")
      || normalized.includes("'avatar_url' column")
      || normalized.includes("'username' column")
      || normalized.includes("'profile_visibility' column"))
  ) {
    return "Hosted account setup is still finishing. Try again shortly. If it keeps happening, run the latest Supabase profile migration.";
  }

  return error.message;
}

export default function AuthScreen() {
  const router = useRouter();
  const termsRoute = "/legal/terms" as Href;
  const privacyRoute = "/legal/privacy" as Href;
  const betaDisclaimerRoute = "/legal/beta-disclaimer" as Href;
  const { width } = useWindowDimensions();
  const { storageMode, isHydrated, isAuthenticated, profile, signIn, signUp, requestPasswordReset } = useAppData();
  const isWide = width >= 1024;
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [helpMessage, setHelpMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const isHosted = storageMode === "hosted";
  const identifierLabel = isHosted ? "Email" : "Username";
  const identifierPlaceholder = isHosted ? "fan@example.com" : "cory";
  const loadingCopy = "Loading account...";

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
    setHelpMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "signin") {
        await signIn({ identifier, password });
      } else {
        await signUp({ identifier, password, displayName });
      }
    } catch (submissionError) {
      setError(toFriendlyAuthErrorMessage(submissionError, isHosted));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordHelp() {
    setError(null);
    setHelpMessage(null);
    setIsRequestingReset(true);

    try {
      const message = await requestPasswordReset(identifier);
      setHelpMessage(message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We could not start password help.");
    } finally {
      setIsRequestingReset(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.backgroundOrbOne} />
        <View style={styles.backgroundOrbTwo} />

        <View style={styles.shell}>
          <View style={styles.hero}>
            <Text style={styles.title}>
              {mode === "signin" ? "Track every MLB game you&apos;ve attended." : "Create your baseball ledger."}
            </Text>
            <Text style={styles.subtitle}>
              {mode === "signin" ? "Log in to continue." : "Save your games and build your attendance history."}
            </Text>
          </View>

          <View style={[styles.cardWrap, isWide ? styles.cardWrapWide : null]}>
            <SectionCard title={mode === "signin" ? "Log In" : "Create Account"}>
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
                returnKeyType={mode === "signin" ? "next" : "next"}
              />
              <LabeledInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                autoCapitalize="none"
                secureTextEntry
                returnKeyType={mode === "signin" ? "go" : "done"}
                onSubmitEditing={() => {
                  if (!isSubmitting) {
                    void handleSubmit();
                  }
                }}
              />
              <PrimaryButton
                label={
                  isSubmitting
                    ? "Saving..."
                    : mode === "signin"
                      ? "Log In"
                      : "Create Account"
                }
                onPress={handleSubmit}
                disabled={isSubmitting}
              />
              {mode === "signin" ? (
                <View style={styles.secondaryActionRow}>
                  <Text style={styles.secondaryActionCopy}>Forgot your password?</Text>
                  <Pressable onPress={handlePasswordHelp} disabled={isRequestingReset}>
                    <Text style={styles.secondaryActionLink}>
                      {isRequestingReset ? "Sending reset..." : isHosted ? "Reset password" : "Get help"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              <View style={styles.secondaryActionRow}>
                <Text style={styles.secondaryActionCopy}>
                  {mode === "signin" ? "Need an account?" : "Already have an account?"}
                </Text>
                <Pressable onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
                  <Text style={styles.secondaryActionLink}>
                    {mode === "signin" ? "Create account" : "Log in"}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.legalRow}>
                <Pressable onPress={() => router.push(termsRoute)}>
                  <Text style={styles.legalLink}>Terms</Text>
                </Pressable>
                <Text style={styles.legalDivider}>•</Text>
                <Pressable onPress={() => router.push(privacyRoute)}>
                  <Text style={styles.legalLink}>Privacy</Text>
                </Pressable>
                <Text style={styles.legalDivider}>•</Text>
                <Pressable onPress={() => router.push(betaDisclaimerRoute)}>
                  <Text style={styles.legalLink}>Beta Disclaimer</Text>
                </Pressable>
              </View>
              {helpMessage ? <Text style={styles.helpText}>{helpMessage}</Text> : null}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </SectionCard>
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
    maxWidth: 760,
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
  cardWrap: {
    width: "100%"
  },
  cardWrapWide: {
    alignSelf: "center",
    maxWidth: 520
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
  legalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm
  },
  legalLink: {
    fontSize: 13,
    color: colors.slate700,
    fontWeight: "700"
  },
  legalDivider: {
    fontSize: 13,
    color: colors.slate400
  },
  errorText: {
    fontSize: 14,
    color: colors.red
  },
  helpText: {
    fontSize: 14,
    color: colors.slate700
  }
});
