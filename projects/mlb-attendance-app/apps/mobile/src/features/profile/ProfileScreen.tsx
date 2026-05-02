import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { Screen } from "../../components/common/Screen";
import { LabeledInput } from "../../components/common/LabeledInput";
import { PrimaryButton } from "../../components/common/PrimaryButton";
import { SectionCard } from "../../components/common/SectionCard";
import { useAppData } from "../../providers/AppDataProvider";
import { colors, spacing } from "../../styles/tokens";
import { formatTimestamp } from "../../lib/runtimeInfo";

export function ProfileScreen() {
  const router = useRouter();
  const authRoute = "/auth" as Href;
  const debugRoute = "/debug" as Href;
  const termsRoute = "/legal/terms" as Href;
  const privacyRoute = "/legal/privacy" as Href;
  const betaDisclaimerRoute = "/legal/beta-disclaimer" as Href;
  const { width } = useWindowDimensions();
  const {
    storageMode,
    currentAccountLabel,
    currentUserId,
    profile,
    teams,
    friends,
    followers,
    pendingFollowRequests,
    signOut,
    updateProfile,
    searchProfiles,
    requestFollow,
    acceptFollowRequest,
    rejectFollowRequest,
    unfollowUser,
    persistenceStatus,
    persistenceError,
    lastHydratedAt,
    lastSavedAt,
    attendanceLogs,
    exportAppData,
    importAppData,
    resetAppData,
    retryHydration
  } = useAppData();
  const isHosted = storageMode === "hosted";
  const isWide = width >= 1024;
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [favoriteTeamId, setFavoriteTeamId] = useState(profile.favoriteTeamId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importExportText, setImportExportText] = useState("");
  const [peopleQuery, setPeopleQuery] = useState("");
  const [peopleResults, setPeopleResults] = useState<typeof friends>([]);
  const [isSearchingPeople, setIsSearchingPeople] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    setDisplayName(profile.displayName);
    setFavoriteTeamId(profile.favoriteTeamId ?? "");
  }, [profile.displayName, profile.favoriteTeamId]);

  async function handleSave() {
    setErrorMessage(null);
    await updateProfile({
      displayName,
      favoriteTeamId
    });
    setMessage("Profile preferences saved on this device.");
  }

  function handleExport() {
    setErrorMessage(null);
    setImportExportText(exportAppData());
    setMessage("Current local record exported into the JSON box below.");
  }

  async function handleImport() {
    try {
      await importAppData(importExportText);
      setErrorMessage(null);
      setMessage("Imported app data into this local record.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "That import payload is not valid app data.");
      setMessage(null);
    }
  }

  async function handleReset() {
    await resetAppData();
    setImportExportText("");
    setErrorMessage(null);
    setMessage("Reset the local record back to the seeded demo state.");
  }

  async function handleSearchPeople() {
    setIsSearchingPeople(true);
    try {
      const results = await searchProfiles(peopleQuery);
      setPeopleResults(results);
      setErrorMessage(null);
      setMessage(results.length ? "Found matching fan profiles." : "No fan profiles matched that search yet.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not search profiles right now.");
      setMessage(null);
    } finally {
      setIsSearchingPeople(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      await signOut();
      router.replace(authRoute);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not sign out right now.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <Screen
      title="Profile And Network"
      subtitle={
        isHosted
          ? "Set your identity, manage who you follow, and control the attendance ledger tied to your hosted account."
          : "Set your identity, manage who you follow, and control the imported attendance ledger stored on this device."
      }
    >
      <View style={[styles.layout, isWide ? styles.layoutWide : null]}>
        <View style={styles.mainColumn}>
          <SectionCard title="Identity">
            <Text style={styles.helperText}>
              Signed in as {currentAccountLabel ?? (isHosted ? "hosted user" : "local user")}
            </Text>
            <LabeledInput
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
            />
            <View style={styles.actionStack}>
              <PrimaryButton label="Save Profile" onPress={handleSave} />
              <PrimaryButton
                label={isSigningOut ? "Signing Out..." : "Sign Out"}
                onPress={handleSignOut}
                disabled={isSigningOut}
              />
            </View>
            {message ? <Text style={styles.successText}>{message}</Text> : null}
          </SectionCard>

          <SectionCard title="Favorite Team">
            <View style={[styles.teamList, isWide ? styles.teamListWide : null]}>
              {teams.map((team) => {
                const isSelected = team.id === favoriteTeamId;

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
          </SectionCard>

          <SectionCard title="People">
            <View style={styles.friendList}>
              {isHosted && pendingFollowRequests.length ? (
                <>
                  <Text style={styles.sectionLabel}>Pending requests</Text>
                  {pendingFollowRequests
                    .filter((request) => request.direction === "incoming")
                    .map((request) => (
                      <View key={request.id} style={styles.friendRow}>
                        <View style={styles.friendCopy}>
                          <Text style={styles.friendName}>{request.profile.displayName}</Text>
                          <Text style={styles.friendMeta}>
                            {request.profile.username ? `@${request.profile.username}` : "App user"} wants to follow you.
                          </Text>
                        </View>
                        <View style={styles.inlineButtonRow}>
                          <PrimaryButton label="Accept" onPress={() => void acceptFollowRequest(request.id)} />
                          <Pressable onPress={() => void rejectFollowRequest(request.id)}>
                            <Text style={styles.linkText}>Reject</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                </>
              ) : null}

              <Text style={styles.sectionLabel}>Following</Text>
              {friends.length ? friends.map((friend) => {
                const favoriteTeam = teams.find((team) => team.id === friend.favoriteTeamId);

                return (
                  <View key={friend.id} style={styles.friendRow}>
                    <Pressable style={styles.friendCopy} onPress={() => router.push((`/friends/${friend.id}`) as Href)}>
                      <Text style={styles.friendName}>{friend.displayName}</Text>
                      <Text style={styles.friendMeta}>
                        {friend.username ? `@${friend.username}` : "App user"}
                        {favoriteTeam ? ` • ${favoriteTeam.abbreviation}` : ""}
                      </Text>
                      <Text style={styles.friendMeta}>
                        {friend.sharedGamesLogged ?? 0} games shared • {friend.sharedStadiumsVisited ?? 0} stadiums
                      </Text>
                    </Pressable>
                    <View style={styles.inlineButtonRow}>
                      <PrimaryButton label="View" onPress={() => router.push((`/friends/${friend.id}`) as Href)} />
                      <Pressable onPress={() => void unfollowUser(friend.id)}>
                        <Text style={styles.linkText}>Unfollow</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }) : <Text style={styles.helperText}>No accepted follows yet. Search for a fan below to start building your circle.</Text>}

              {followers.length ? (
                <>
                  <Text style={styles.sectionLabel}>Followers</Text>
                  {followers.map((friend) => (
                    <Pressable key={friend.id} style={styles.friendRow} onPress={() => router.push((`/friends/${friend.id}`) as Href)}>
                      <View style={styles.friendCopy}>
                        <Text style={styles.friendName}>{friend.displayName}</Text>
                        <Text style={styles.friendMeta}>{friend.username ? `@${friend.username}` : "App user"}</Text>
                      </View>
                      <Text style={styles.linkText}>View</Text>
                    </Pressable>
                  ))}
                </>
              ) : null}

              <Text style={styles.sectionLabel}>Find people</Text>
              <LabeledInput
                label="Search by username or display name"
                value={peopleQuery}
                onChangeText={setPeopleQuery}
                placeholder={isHosted ? "cory, ava, queensfan..." : "Search local demo fans"}
              />
              <PrimaryButton label={isSearchingPeople ? "Searching..." : "Search Profiles"} onPress={handleSearchPeople} />
              {peopleResults.length ? peopleResults.map((friend) => {
                const favoriteTeam = teams.find((team) => team.id === friend.favoriteTeamId);
                const isAccepted = friend.relationshipStatus === "accepted";
                const isPending = friend.relationshipStatus === "pending";

                return (
                  <View key={friend.id} style={styles.friendRow}>
                    <Pressable style={styles.friendCopy} onPress={() => router.push((`/friends/${friend.id}`) as Href)}>
                      <Text style={styles.friendName}>{friend.displayName}</Text>
                      <Text style={styles.friendMeta}>
                        {friend.username ? `@${friend.username}` : "App user"}
                        {favoriteTeam ? ` • ${favoriteTeam.abbreviation}` : ""}
                      </Text>
                    </Pressable>
                    {isAccepted ? (
                      <PrimaryButton label="Following" onPress={() => router.push((`/friends/${friend.id}`) as Href)} />
                    ) : isPending ? (
                      <Text style={styles.helperText}>Requested</Text>
                    ) : (
                      <PrimaryButton label="Follow" onPress={() => void requestFollow(friend.id)} />
                    )}
                  </View>
                );
              }) : null}
            </View>
          </SectionCard>
        </View>

        <View style={styles.sideColumn}>
          <SectionCard title="Account And Sync">
            <View style={styles.statusBadgeRow}>
              <View style={[styles.modeBadge, isHosted ? styles.modeBadgeHosted : styles.modeBadgeLocal]}>
                <Text style={[styles.modeBadgeText, isHosted ? styles.modeBadgeTextHosted : styles.modeBadgeTextLocal]}>
                  {isHosted ? "Hosted Sync Active" : "Local Only"}
                </Text>
              </View>
              <Text style={styles.storageText}>Save status: {persistenceStatus}</Text>
            </View>
            <Text style={styles.helperText}>
              {isHosted
                ? "Hosted Sync Active"
                : "Local Only: data is saved only on this device/browser."}
            </Text>
            <View style={styles.metaList}>
              <Text style={styles.metaRow}>Account: {currentAccountLabel ?? "No signed-in account"}</Text>
              <Text style={styles.metaRow}>Profile ID: {currentUserId ?? profile.id}</Text>
              <Text style={styles.metaRow}>Logs loaded: {attendanceLogs.length}</Text>
              <Text style={styles.metaRow}>Last hydration: {formatTimestamp(lastHydratedAt)}</Text>
              <Text style={styles.metaRow}>Last save/sync: {formatTimestamp(lastSavedAt)}</Text>
            </View>
            {persistenceError ? <Text style={styles.errorText}>{persistenceError}</Text> : null}
            <View style={styles.actionStack}>
              {persistenceStatus === "error" ? (
                <PrimaryButton label="Retry Storage Load" onPress={retryHydration} />
              ) : null}
              <PrimaryButton label="Open Beta Debug" onPress={() => router.push(debugRoute)} />
            </View>
          </SectionCard>

          <SectionCard title="Policies">
            <Text style={styles.helperText}>
              These beta policy pages are practical placeholders and still need legal review.
            </Text>
            <View style={styles.linkList}>
              <Pressable onPress={() => router.push(termsRoute)}>
                <Text style={styles.linkText}>Terms of Service</Text>
              </Pressable>
              <Pressable onPress={() => router.push(privacyRoute)}>
                <Text style={styles.linkText}>Privacy Policy</Text>
              </Pressable>
              <Pressable onPress={() => router.push(betaDisclaimerRoute)}>
                <Text style={styles.linkText}>Beta Disclaimer</Text>
              </Pressable>
            </View>
          </SectionCard>

          <SectionCard title="Import / Export">
            <Text style={styles.helperText}>
              Export the current local record, paste an exported payload to import, or reset back to the seeded state built from your supplied game list.
            </Text>
            <LabeledInput
              label="JSON payload"
              value={importExportText}
              onChangeText={setImportExportText}
              placeholder='{"version":2,"profile":...}'
              autoCapitalize="none"
              multiline
              numberOfLines={10}
            />
            <View style={styles.actionStack}>
              <PrimaryButton label="Export Local Record" onPress={handleExport} />
              <PrimaryButton label="Import Pasted Record" onPress={handleImport} />
              <PrimaryButton label="Reset To Seeded Data" onPress={handleReset} />
            </View>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          </SectionCard>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  layout: {
    gap: spacing.lg
  },
  layoutWide: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  mainColumn: {
    flex: 1.2,
    gap: spacing.lg
  },
  sideColumn: {
    flex: 0.8,
    gap: spacing.lg
  },
  statusBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm
  },
  modeBadge: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  modeBadgeHosted: {
    backgroundColor: colors.green
  },
  modeBadgeLocal: {
    backgroundColor: colors.slate100
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3
  },
  modeBadgeTextHosted: {
    color: colors.white
  },
  modeBadgeTextLocal: {
    color: colors.slate700
  },
  teamList: {
    gap: spacing.sm
  },
  teamListWide: {
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
    flexGrow: 1,
    minWidth: 180
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
  friendList: {
    gap: spacing.md
  },
  sectionLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate500,
    fontWeight: "700"
  },
  friendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 14,
    padding: spacing.md,
    backgroundColor: colors.slate050
  },
  friendCopy: {
    flex: 1,
    gap: spacing.xs
  },
  inlineButtonRow: {
    alignItems: "flex-end",
    gap: spacing.sm
  },
  friendName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.slate900
  },
  friendMeta: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.slate500
  },
  successText: {
    fontSize: 14,
    color: colors.green
  },
  errorText: {
    fontSize: 14,
    color: colors.red
  },
  storageText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.slate900
  },
  metaList: {
    gap: spacing.xs
  },
  metaRow: {
    fontSize: 13,
    color: colors.slate700
  },
  helperText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.slate500
  },
  linkList: {
    gap: spacing.sm
  },
  linkText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy
  },
  actionStack: {
    gap: spacing.sm
  }
});
