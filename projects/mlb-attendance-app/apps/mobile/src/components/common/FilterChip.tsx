import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, spacing } from "../../styles/tokens";

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function FilterChip({ label, selected = false, onPress }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : null,
        pressed ? styles.pressed : null
      ]}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: 40,
    justifyContent: "center"
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  pressed: {
    opacity: 0.9
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary,
    flexShrink: 1
  },
  labelSelected: {
    color: colors.textInverse
  }
});
