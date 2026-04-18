import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, spacing } from "../../styles/tokens";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, disabled = false }: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.navy,
    borderRadius: 999,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.slate200,
    minHeight: 48,
    shadowColor: colors.navy,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    cursor: "pointer"
  },
  disabled: {
    opacity: 0.45
  },
  pressed: {
    backgroundColor: colors.navySoft,
    transform: [{ translateY: 1 }]
  },
  label: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2
  }
});
