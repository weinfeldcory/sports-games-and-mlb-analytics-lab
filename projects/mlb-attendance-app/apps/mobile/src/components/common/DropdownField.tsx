import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../../styles/tokens";

export interface DropdownOption<T extends string | number> {
  label: string;
  value: T;
}

interface DropdownFieldProps<T extends string | number> {
  label: string;
  options: Array<DropdownOption<T>>;
  value: T;
  onChange: (value: T) => void;
  isOpen: boolean;
  onToggle: () => void;
  minWidth?: number;
}

export function DropdownField<T extends string | number>(props: DropdownFieldProps<T>) {
  const { label, options, value, onChange, isOpen, onToggle, minWidth = 180 } = props;
  const activeOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <View style={[styles.wrapper, { minWidth }]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onToggle} style={styles.trigger}>
        <Text style={styles.triggerText}>{activeOption?.label ?? "Select"}</Text>
        <Text style={styles.caret}>{isOpen ? "▲" : "▼"}</Text>
      </Pressable>
      {isOpen ? (
        <View style={styles.menu}>
          {options.map((option, index) => (
            <Pressable
              key={`${label}-${option.value}`}
              onPress={() => onChange(option.value)}
              style={[
                styles.option,
                index > 0 ? styles.optionBorder : null,
                option.value === value ? styles.optionActive : null
              ]}
            >
              <Text style={[styles.optionText, option.value === value ? styles.optionTextActive : null]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
    maxWidth: "100%"
  },
  label: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.slate500,
    fontWeight: "700"
  },
  trigger: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  triggerText: {
    flex: 1,
    fontSize: 13,
    color: colors.slate900,
    fontWeight: "600"
  },
  caret: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.slate700
  },
  menu: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.white
  },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  optionBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.slate100
  },
  optionActive: {
    backgroundColor: colors.slate050
  },
  optionText: {
    fontSize: 13,
    color: colors.slate700
  },
  optionTextActive: {
    color: colors.navy,
    fontWeight: "700"
  }
});
