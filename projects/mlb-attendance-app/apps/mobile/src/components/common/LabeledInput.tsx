import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing } from "../../styles/tokens";

interface LabeledInputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoCapitalize?: "none" | "characters" | "words" | "sentences";
  error?: string;
  multiline?: boolean;
  numberOfLines?: number;
}

export function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = "sentences",
  error,
  multiline = false,
  numberOfLines
}: LabeledInputProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline ? styles.inputMultiline : null, error ? styles.inputError : null]}
        placeholderTextColor={colors.slate400}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs
  },
  label: {
    fontSize: 14,
    color: colors.slate700,
    fontWeight: "600"
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.slate900,
    minHeight: 50
  },
  inputMultiline: {
    minHeight: 160
  },
  inputError: {
    borderColor: colors.red
  },
  error: {
    fontSize: 13,
    color: colors.red
  }
});
