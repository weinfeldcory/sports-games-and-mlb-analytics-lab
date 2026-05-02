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
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="log-recap" />
          <Stack.Screen name="logged-game/[logId]" />
          <Stack.Screen name="friends/[userId]" />
          <Stack.Screen name="debug" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AppDataProvider>
    </SafeAreaProvider>
  );
}
