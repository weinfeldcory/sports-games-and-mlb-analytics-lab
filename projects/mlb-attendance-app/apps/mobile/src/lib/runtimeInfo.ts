import { Platform } from "react-native";
import appPackage from "../../package.json";

declare const process: {
  env: Record<string, string | undefined>;
};

export const APP_VERSION = appPackage.version;
export const APP_COMMIT_SHA = process.env.EXPO_PUBLIC_APP_COMMIT_SHA?.trim() || null;

export function getDeviceInfo() {
  const base = `platform=${Platform.OS} version=${String(Platform.Version ?? "unknown")}`;

  if (Platform.OS !== "web") {
    return base;
  }

  const maybeNavigator = globalThis as { navigator?: { userAgent?: string } };
  const userAgent =
    maybeNavigator.navigator && typeof maybeNavigator.navigator.userAgent === "string"
      ? maybeNavigator.navigator.userAgent
      : "unknown";

  return `${base} userAgent=${userAgent}`;
}

export function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Date(value).toLocaleString();
}
