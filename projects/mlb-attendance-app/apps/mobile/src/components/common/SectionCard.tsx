import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, shadows, spacing } from "../../styles/tokens";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.eyebrowBar} />
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    ...shadows.card
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  headerCopy: {
    flex: 1,
    gap: 2
  },
  eyebrowBar: {
    width: 10,
    height: 10,
    marginTop: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.clay
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: 0.1
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSoft
  },
  body: {
    gap: spacing.sm
  }
});
