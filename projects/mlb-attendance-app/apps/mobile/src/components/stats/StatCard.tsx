import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../../styles/tokens";

interface StatCardProps {
  label: string;
  value: string;
  accent?: "navy" | "green" | "amber";
}

const accentMap = {
  navy: colors.navy,
  green: colors.green,
  amber: colors.amber
};

export function StatCard({ label, value, accent = "navy" }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: accentMap[accent] }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "48%",
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.slate200,
    gap: spacing.sm,
    shadowColor: colors.slate700,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  label: {
    fontSize: 14,
    color: colors.slate500,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  value: {
    fontSize: 32,
    fontWeight: "700"
  }
});
