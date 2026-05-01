import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { colors, spacing } from "../../styles/tokens";

type PolicySection = {
  title: string;
  body: string[];
};

interface PolicyScreenProps {
  title: string;
  summary: string;
  sections: PolicySection[];
}

export function PolicyScreen({ title, summary, sections }: PolicyScreenProps) {
  const router = useRouter();
  const authRoute = "/auth" as Href;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.shell}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.push(authRoute))}>
            <Text style={styles.backLink}>Back</Text>
          </Pressable>

          <View style={styles.hero}>
            <Text style={styles.kicker}>Beta Legal Placeholder</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.summary}>{summary}</Text>
            <Text style={styles.notice}>
              This page is practical placeholder product language, not final legal advice. Review it with an attorney before wider release or monetization.
            </Text>
          </View>

          <View style={styles.body}>
            {sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.body.map((paragraph, index) => (
                  <Text key={`${section.title}-${index}`} style={styles.paragraph}>
                    {paragraph}
                  </Text>
                ))}
              </View>
            ))}
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg
  },
  shell: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    gap: spacing.lg
  },
  backLink: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy
  },
  hero: {
    backgroundColor: colors.navy,
    borderRadius: 26,
    padding: spacing.xl,
    gap: spacing.sm
  },
  kicker: {
    color: colors.amber,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: "700"
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: colors.white
  },
  summary: {
    fontSize: 15,
    lineHeight: 23,
    color: "rgba(255,253,248,0.88)"
  },
  notice: {
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(255,253,248,0.72)"
  },
  body: {
    gap: spacing.md
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.xl,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.slate200
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.slate900
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.slate700
  }
});
