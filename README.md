# ⚔️ Realms Unwritten

Android-first isometric fantasy MMORPG built with Bun, TypeScript, Three.js, and Capacitor.

## Current repository status

This is an **Android build-and-CI bootstrap**, not yet the previously developed 0.6 multiplayer gameplay source. The original 0.6 source archive must be imported before this can be called the full game. The minimal Three.js client here exists to validate APK packaging end to end.

## Local web preview

```bash
bun install
bun run dev:client
```

## Android debug APK

GitHub Actions automatically runs **Android Debug APK** on pushes to `Master` or `main`. Its successful artifact is named `realms-unwritten-debug-apk`. You can also use **Actions → Android Debug APK → Run workflow**.

To compile locally, install Bun, JDK 21 and Android SDK, then:

```bash
bun install
bun run check
bun test
bun run build
cd apps/client
bunx cap add android
bunx cap sync android
cd android
./gradlew assembleDebug
```

The resulting file is `apps/client/android/app/build/outputs/apk/debug/app-debug.apk`.

Debug builds permit cleartext local networking. Production multiplayer must use TLS (`wss://`) and an externally hosted authoritative Bun server. The bundled server is currently only a health-check placeholder.

## Asset development

The Android client now adds original procedural village-market stalls, rock clusters, flowers, a campfire and a signpost. These are first-pass geometry blockouts, not external model assets. See [Android asset production plan](docs/assets/PRODUCTION_PLAN.md) and the typed [asset catalog](apps/client/src/assets/catalog.ts) for the replacement pipeline and budgets.
