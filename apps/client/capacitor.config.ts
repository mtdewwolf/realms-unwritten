import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "game.realmsunwritten.client",
  appName: "Realms Unwritten",
  webDir: "dist",
  android: { allowMixedContent: false },
};
export default config;
