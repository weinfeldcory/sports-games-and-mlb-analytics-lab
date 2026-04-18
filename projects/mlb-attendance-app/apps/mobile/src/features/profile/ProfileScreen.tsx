import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useEffect, useState } from "react";
import { Screen } from "../../components/common/Screen";
import { LabeledInput } from "../../components/common/LabeledInput";
import { PrimaryButton } from "../../components/common/PrimaryButton";
import { SectionCard } from "../../components/common/SectionCard";
import { useAppData } from "../../providers/AppDataProvider";
import { colors, spacing } from "../../styles/tokens";

export function ProfileScreen() {
  const { width } = useWindowDimensions();
  const {
    profile,
    teams,
    friends,
    updateProfile,
    toggleFollowFriend,
    persistenceStatus,
    persistenceError,
    exportAppData,
    importAppData,
    resetAppData,
    retryHydration
  } = useAppData();
  const isWide = width >= 1024;
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [favoriteTeamId, setFavoriteTeamId] = useState(profile.favoriteTeamId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [importExportText, setImportExportText] = useState("");

  useEffect(() => {
    setDisplayName(profile.displayName);
    setFavoriteTeamId(profile.favoriteTeamId ?? "");
  }, [profile.displayName, profile.favoriteTeamId]);

  async function handleSave() {
    await updateProfile({
      displayName,
      favoriteTeamId
    });
    setMessage("Profile preferences saved on this device.");
  }

  function handleExport() {
    setImportExportText(exportAppData());
    setMessage("Current local record exported into the JSON box below.");
  }

  async function handleImport() {
    try {
      await importAppData(importExportText);
      setMessage("Imported app data into this local record.");
    } catch {
      setMessage(null);
    }
  }

  async function handleReset() {
    await resetAppData();
    setImportExportText("");
    setMessage("Reset the local record back to the seeded demo state.");
  }

  return (
    <Screen
      title="Profile And Network"
      subtitle="Set your identity, manage who you follow, and control the imported attendance ledger stored on this device."
    >
      <View style={[styles.layout, isWide ? styles.layoutWide : null]}>
        <View style={styles.mainColumn}>
          <SectionCard title="Identity">
            <LabeledInput
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
            />
            <PrimaryButton label="Save Profile" onPress={handleSave} />
            {message ? <Text style={styles.successText}>{message}</Text> : null}
          </SectionCard>

          <SectionCard title="Favorite Team">
            <View style={[styles.teamList, isWide ? styles.teamListWide : null]}>
              {teams.map((team) => {
                const isSelected = team.id === favoriteTeamId;

                return (
                  <Pressable
                    key={team.id}
                    onPress={() => setFavoriteTeamId(team.id)}
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

          <SectionCard title="Friends You Can Follow">
            <View style={styles.friendList}>
              {friends.map((friend) => {
                const isFollowing = (profile.followingIds ?? []).includes(friend.id);

                return (
                  <View key={friend.id} style={styles.friendRow}>
                    <View style={styles.friendCopy}>
                      <Text style={styles.friendName}>{friend.displayName}</Text>
                      <Text style={styles.friendMeta}>
                        {friend.homeCity ?? "MLB fan"} • {friend.bio}
                      </Text>
                    </View>
                    <PrimaryButton
                      label={isFollowing ? "Following" : "Follow"}
                      onPress={() => toggleFollowFriend(friend.id)}
                    />
                  </View>
                );
              })}
            </View>
          </SectionCard>
        </View>

        <View style={styles.sideColumn}>
          <SectionCard title="Storage">
            <Text style={styles.storageText}>Save status: {persistenceStatus}</Text>
            <Text style={styles.helperText}>
              Your real attendance history, follow graph, and local edits persist in browser or device storage.
            </Text>
            {persistenceError ? <Text style={styles.errorText}>{persistenceError}</Text> : null}
            {persistenceStatus === "error" ? (
              <PrimaryButton label="Retry Storage Load" onPress={retryHydration} />
            ) : null}
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
  helperText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.slate500
  },
  actionStack: {
    gap: spacing.sm
  }
});
