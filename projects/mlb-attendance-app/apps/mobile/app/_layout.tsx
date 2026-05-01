import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AppDataProvider } from "../src/providers/AppDataProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppDataProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="auth" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="debug" />
          <Stack.Screen name="legal" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AppDataProvider>
    </SafeAreaProvider>
  );
}
