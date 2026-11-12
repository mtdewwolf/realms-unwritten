# ⚔️ Realms Unwritten

**Android-first fantasy MMORPG project — currently a playable 3D exploration and small-scale multiplayer prototype.**

Built with **Bun + TypeScript + Three.js + Vite + Capacitor**, using Blender to generate original rigged GLB character prototypes. Windows/desktop web play is supported for development and testing; Android is the priority platform.

> **Reality check:** This repository contains an original evolving prototype, **not a finished MMORPG**. World generation, local wolf combat, exploration, map, and a single-process authoritative **movement** server are implemented. Quests, inventory, crafting, economy, accounts, production-ready combat, NPC ecosystems, and MMO-scale operation are **not implemented**. **A single shared server-authoritative wolf combat vertical slice is now implemented**; it has no rewards and does not represent a completed combat system. Older "0.6" multiplayer gameplay source referenced in earlier planning has **not** been imported into this repository. See [Current status](#current-feature-matrix) and [Outstanding work](#outstanding-work).

## Contents

1. [Current feature matrix](#current-feature-matrix)
2. [Game vision and gameplay](#game-vision-and-gameplay)
3. [World generation, geography, and streaming](#world-generation-geography-and-streaming)
4. [Characters, controls, combat, and animation](#characters-controls-combat-and-animation)
5. [Exploration, discoveries, settlements, and atlas](#exploration-discoveries-settlements-and-atlas)
6. [Multiplayer architecture and persistence](#multiplayer-architecture-and-persistence)
7. [Technology and repository layout](#technology-and-repository-layout)
8. [Prerequisites and local setup](#prerequisites-and-local-setup)
9. [Building Android APKs](#building-android-apks)
10. [Blender asset pipeline](#blender-asset-pipeline)
11. [All automated and manual testing steps](#all-automated-and-manual-testing-steps)
12. [Known limitations, security, and troubleshooting](#known-limitations-security-and-troubleshooting)
13. [Outstanding work and milestones](#outstanding-work-and-milestones)
14. [Supporting design documents](#supporting-design-documents)

## Current feature matrix

Status meanings: **Implemented** = present in source and exercised by automated tests or CI; **Prototype** = runnable initial functionality without full game/business logic; **Planned** = absent or incomplete.

| Area | Status | What actually exists |
| --- | --- | --- |
| Android build pipeline | **Implemented** | CI-generated debug APK via Capacitor/Gradle; no store release |
| Bun/TypeScript monorepo | **Implemented** | Client and server workspaces, type checking, Bun tests |
| 3D rendering | **Implemented** | Three.js scene, lights, fog, zoomable orbit view, ground and props |
| Mobile and keyboard input | **Prototype** | Virtual joystick, WASD, camera drag/pinch, actions, focus reset |
| Addressable world | **Implemented** | 16,384 × 16,384-meter square; 256 × 256 logical chunks |
| World streaming | **Implemented** | 64-meter chunks; radius 2 (~25 loaded terrain chunks inland) |
| Heightfield and biomes | **Prototype** | Deterministic terrain elevation; meadow, woodland, highlands |
| Terrain-aware player/prop elevation | **Prototype** | Triangle-interpolated ground height; no physics-based collision |
| Original characters | **Prototype** | Blender-generated adventurer and wolf GLBs, rigged animation clips |
| Combat | **Prototype (online authoritative starter wolf + offline local demo)** | Bun owns one shared wolf, attacks, cooldowns, health/stamina, telegraphs, death and respawn; no XP/loot |
| Landmarks and resource imagery | **Prototype** | Ruins, ore outcrops, dens; no functional mining or harvesting |
| Roads | **Prototype** | Rectangular 512-meter-spaced road corridors, generated with chunks |
| Settlements | **Prototype** | Starter village plus deterministic hamlets/outposts and beacons |
| Atlas and fog of war | **Prototype** | 1.024-km local map, explored 64-meter cells, discovered markers, waypoints |
| Discovery storage | **Prototype (device only)** | localStorage records for visited map cells, landmarks, settlements |
| Bun networking | **Implemented vertical slice** | WebSocket handshake, guest join, input, snapshots |
| Authoritative movement | **Implemented vertical slice** | Server controls positions at 20 Hz; sends snapshots at 10 Hz |
| Nearby player visibility | **Prototype** | 160-meter interest radius, simplified other-player models |
| Character position persistence | **Prototype** | Bun SQLite guest tokens and position records |
| Real accounts / characters | **Planned** | No login, recovery, selection, multiple slots |
| Persistent shared world | **Planned** | No authoritative world mutation/structure ownership |
| Server-authoritative combat/AI | **Prototype** | One synchronized Bun wolf encounter; no broader AI/spawn/loot system |
| Inventory, equipment, loot | **Prototype** | Persistent server-owned Wolf Pelts, Fangs and coins; no equipment |
| Skills, XP, leveling, classes | **Planned** | No character progression |
| Gathering, crafting, economy | **Planned** | Gather button currently reports feature is pending |
| NPC dialogue, quests, merchants | **Prototype** | Verdant Reach guard offers one persistent Wolf Hunt quest; no dialogue trees or merchants |
| Chat, party, guilds, dungeons | **Planned** | No social or cooperative gameplay |
| Production hosting and scale | **Planned** | No managed deployment, sharding, autoscaling or load-test results |

**Last audited baseline:** branch `Master`, commit `0c24d4e` (November 2026). [Android / WebSocket smoke CI — passed](https://github.com/mtdewwolf/realms-unwritten/actions/runs/43148146024). This confirms a successful automated build and live two-client smoke test on a GitHub runner; **it is not evidence of real-device Android performance or production service reliability**.

## Game vision and gameplay

The long-term goal is a large shared fantasy world where players explore distinct regions, discover settlements and ancient locations, fight creatures, gather resources, craft equipment, progress their characters, trade, and participate in a persistent multiplayer economy. Current code demonstrates a **small fraction** of that loop:

1. Start near the Verdant Reach village.
2. Move through generated hills, forests and open terrain.
3. Discover ruins, ore outcrops, dens and named settlements.
4. Open the world atlas to review explored cells; set a directional waypoint.
5. Fight the **server-owned shared starter wolf when online**, or a local wolf demonstration when offline.
6. Optionally connect to a Bun game server to see nearby guest players and synchronize movement.

The server now shares **one starter wolf encounter**, including its movement, health, bite windup and respawn. It does **not** share loot, discoveries, economy, quests or other world state. Do not assume that actions taken in an offline session are merged into an online account.

### Platforms

- **Primary:** Android debug APK using Capacitor's WebView.
- **Development:** modern desktop web browser, Three.js and Vite.
- **Windows native executable:** not implemented; Windows users can use the web development build.
- **iOS/store distribution:** not configured.

## World generation, geography, and streaming

| Property | Current implementation |
| --- | --- |
| Logical world dimensions | **16,384 m × 16,384 m** (~268.4 km² addressable area) |
| Logical chunk grid | 256 × 256 = 65,536 possible chunk addresses |
| Chunk footprint | 64 × 64 meters |
| Render radius | 2 chunks in each direction: nominally 5 × 5 = 25 active chunks, fewer at world edges |
| Terrain grid | 17 × 17 vertices/chunk, 4-meter spacing, 512 triangles/chunk |
| Terrain height | Smooth deterministic value noise sampled in global coordinates |
| Starter village | Flat center with a gradual transition to the terrain heightfield |
| Biomes | Meadow, woodland, highlands; simple color/foliage variations |
| Placement | Seeded procedural trees/rocks and location blockouts |
| Ground samples | `groundHeightAt()` interpolates the same terrain triangles the renderer uses |
| Distant detail | Scene fog and limited chunk window; no finished terrain LOD system |

**How streaming works:** `ChunkedWorld` calculates the player's chunk from world coordinates, instantiates nearby chunks, evicts distant ones, and disposes per-chunk terrain and landmark geometry. Shared materials and standard geometries are reused. Generation is deterministic: returning to the same location recreates the same baseline terrain and objects.

**What "16 km world" does NOT mean:** it is not 268 km² of hand-authored content. There are no rivers, cliffs, bridges, terrain deformation, reliable prop collisions, weather, mounts or fast-travel networks yet. Terrain generation is client-side; an MMO will need versioned shared world seeds, persistent world deltas, and server-controlled interactions.

Source: `apps/client/src/world/chunkedWorld.ts`, `terrain.ts`, `frontierProps.ts`.

## Characters, controls, combat, and animation

### Controls

| Action | Desktop | Android / touch |
| --- | --- | --- |
| Move | W / A / S / D | Lower-left virtual joystick |
| Rotate camera | Drag on game canvas | One-finger drag over terrain |
| Zoom camera | Mouse wheel | Two-finger pinch |
| Open/close atlas | M | MAP button |
| Close atlas | Escape | Map close button |
| Attack wolf | ATTACK on-screen button | ATTACK button |
| Dodge | DODGE button | DODGE button |
| Gather | GATHER button | GATHER button; **not functional yet** |
| Connect/disconnect multiplayer | Server URL + CONNECT/OFFLINE buttons | Same on-screen panel |

Joystick/camera pointers are reset when the window loses focus or the document is hidden. Camera zoom distance is clamped to approximately 11–30 world units.

### Local combat demo

- One wolf near the start, initially 60 HP.
- Sword attacks cost **16 stamina**, deal **20 damage** if within a 3.25-meter attack range, and use a ~0.65-second attack interval.
- Dodges cost **26 stamina**, provide a short evasion window and a 2.25-meter displacement.
- Stamina cap **100**, regeneration **18/sec**.
- Wolf bite telegraph ~**0.85 sec**, bite damage **12**, cooldown approximately **1.5 sec**.
- Player has **100 HP** in the encounter; UI shows player/wolf health, stamina and combat messages.
- A defeated wolf is removed/hidden in the local demo; respawn and loot are not implemented.
- **When connected, wolf attacks, enemy health/movement, cooldowns and player health/stamina are server-owned.** Offline mode retains the local demo. No rewards, server-side physics collision or production-grade combat security exist yet.

### Character art

`tools/blender/generate_characters.py` builds **original low-poly prototype** adventurer and wolf GLBs using Blender's Python API. Required animation clips:

| Character | Clips |
| --- | --- |
| Adventurer | `idle`, `walk`, `attack`, `dodge` |
| Wolf | `idle`, `walk`, `attack`, `death` |

The client loads `/assets/adventurer.glb` and `/assets/wolf.glb` with `GLTFLoader` and animates them using `AnimationMixer`. If an asset is missing or invalid, the existing procedural character is retained as a fallback. Remote multiplayer players are currently simpler procedural avatars, not the full rigged animated GLB.

**Not production-ready:** mesh/UV quality, skeleton standards, animation transitions, weapon attachment, equipment swapping, damage reactions, LOD and actual Android GPU profiling.

## Exploration, discoveries, settlements, and atlas

### Landmark types

- **Forgotten Watchtower:** visual ruin / stone-beacon point of interest.
- **Ironstone Outcrop:** visible ore formation; no gathering economy yet.
- **Wolf Territory:** den geometry; no server-managed spawn territory yet.

Landmark IDs and positions are deterministic, based on 256-meter world regions and biome rules; they are instantiated only in their owning terrain chunk. Discovering a landmark occurs near it, within about 16 meters. The map and status UI show discovery feedback.

### Settlements and roads

- **Verdant Reach** is the starting village.
- Deterministic additional **hamlets and outposts** appear at a subset of road-grid intersections.
- Roads form a 512-meter-spaced orthogonal network and follow local height samples.
- Additional settlements contain basic cottages and a beacon. There are no actual NPCs, shop inventories, quests or services.
- Settlement discovery proximity is about 28 meters; discovered towns can appear in the atlas.

### Atlas and navigation

- MAP button or **M** toggles the atlas.
- North-up local view, approximately 1.024 km across.
- Fog-of-war cells are 64 × 64 meters.
- Discovered landmarks and settlements appear as markers.
- Tapping **explored terrain** sets a waypoint; selecting a nearby **discovered landmark** marker can snap the waypoint to that location.
- Distance and compass bearing are shown on the HUD; coming within ~8 meters clears the waypoint.
- **No route/pathfinding:** the bearing points toward the destination directly, and does not avoid hills, buildings or obstacles.
- Current map is centered on the player; there is no whole-world atlas, zoom control or shared party exploration.

### Device-local storage

Currently stored in browser/WebView `localStorage`:

| Key | Purpose |
| --- | --- |
| `realms-unwritten-map-v1` | Explored 64-meter cells |
| `realms-unwritten-discoveries-v1` | Landmark discovery IDs |
| `realms-unwritten-settlement-discoveries-v1` | Settlement discovery IDs |
| `realms-unwritten-guest-token-v1` | Guest bearer token for Bun server reconnect |

Data is **specific to that browser profile/device origin**, not synchronized across accounts. Clearing app data or browser storage can lose discoveries and the guest token. Do not treat localStorage as secure credential storage.

## Multiplayer architecture and persistence

### Topology

```text
Android Capacitor client / desktop browser
     │
     ├── Three.js terrain, map, local wolf encounter
     │
     └── WebSocket  ws://SERVER:3001/ws   (WSS required for public hosting)
                  │
                  ▼
            Bun server (single process)
              ├── Guest handshake and input validation
              ├── Fixed 20 Hz authoritative movement tick
              ├── 10 Hz nearby player snapshots
              ├── Interest radius: 160 meters
              └── SQLite guest characters / saved positions
```

Server entry point: `apps/server/src/index.ts`. Core movement: `simulation.ts`. Message validation: `protocol.ts`, with authoritative wolf combat in `combat.ts`. Client integration: `apps/client/src/multiplayer/client.ts`.

### HTTP and WebSocket

- `GET /health`: JSON with `ok`, `game`, protocol version and current online player count.
- `GET /ws` with WebSocket upgrade: multiplayer connection.
- Default port: **3001**; configurable via `PORT`.
- Bind address: `0.0.0.0` by default; override via `HOST`.
- Protocol version: **4** (client/server must use matching builds).
- Clients send `hello` with an optional existing guest token and optional sanitized display name; server sends `welcome` with player ID, token, initial position.
- Clients send numbered movement vectors, not positions; server clamps speed and world bounds.
- Server returns `snapshot` containing own authoritative position, acknowledgment sequence and nearby players.
- Basic per-WebSocket limit: 40 messages/second; maximum payload length 2,048 bytes. Input inactivity stops player motion after ~400 ms.
- Nearby-player lookup currently scans all players per client (roughly quadratic), **not** production spatial indexing.

Example messages (illustrative):

```json
{"type":"hello","name":"Adventurer"}
```

```json
{"type":"input","seq":1,"dx":1,"dz":0}
```

```json
{"type":"snapshot","tick":42,"you":{"id":"...","name":"Adventurer","x":0,"z":0,"heading":0},"others":[],"ack":1}
```

### Online starter wolf encounter

When connected to a protocol v2 server, **Bun owns the wolf and player combat vitals**. Clients send `action` packets with an increasing sequence and target ID; the server checks range, stamina, cooldown and health before updating a single shared wolf. Relevant nearby snapshots carry its position, state and remaining HP. The wolf respawns eight seconds after defeat; an incapacitated player respawns after five seconds. These are prototype rules, without loot or XP. See [Authoritative Combat](docs/AUTHORITATIVE_COMBAT.md).

### Server-owned wolf loot and inventory

A successful shared wolf kill grants each online damage contributor one **Wolf Pelt**, one **Wolf Fang**, and **five coins**. Bun creates the grant and records a SQLite receipt, stack quantities, and wallet balance inside a transaction. The Android **BAG** shows server inventory after reconnect. Offline combat awards nothing; equipment, selling and crafting are not implemented. See [Inventory and Loot](docs/INVENTORY_LOOT.md).

### Starter NPC and Wolf Hunt Quest

The Verdant Reach guard at (2,-3) offers a one-time **Wolf Hunt** quest. Accept while within 6 meters of the guard, contribute successful damage to three separate shared starter-wolf defeats, and return to claim **25 coins**. Quest state and kill receipts live in SQLite; each character receives independent progress, and a repeated turn-in cannot duplicate coins. The Android QUEST panel shows the objective and current count. Online only; no XP, dialogue trees or quest chains. See [Wolf Hunt Quest](docs/WOLF_HUNT_QUEST.md).

### Guest persistence

- SQLite via Bun's `bun:sqlite`.
- Default DB file: `data/realms-world.sqlite`, **relative to the server process's working directory** (when started via the root `dev:server` script, this is `apps/server/data/realms-world.sqlite`).
- Override with `WORLD_DB_PATH`, preferably an absolute path for deployment.
- Server stores **hashes** of guest bearer tokens, names, IDs and x/z positions.
- Positions are saved every ~10 seconds and on clean WebSocket disconnect / graceful shutdown.
- There is no account recovery, password login, session renewal or character roster.
- Two clients sharing the same stored token cannot simultaneously control the same character. For a two-player test, use separate browser profiles or devices.
- A token from one database is invalid against a new/reset database; the current client does **not** automatically register a new token after an invalid-token response.

### Boundaries of server authority

**Authoritative:** guest identities within this server, x/z movement, nearby visibility and saved positions; additionally the online starter wolf encounter's health, attacks, movement, player vitals and respawn timers (combat state resets on server restart).

**Not authoritative:** terrain collision, physics dash movement, gathering, map fog, discoveries, settlements, NPC economies, inventory, currency, world edits and building ownership. **Authoritative prototype only:** the shared starter wolf, attack/dodge validation, damage, stamina, death and respawn.

**Not production-safe:** public plain-WS exposure, localStorage bearer tokens, missing origin policy, account security, load testing, persistent shared world state and horizontal scaling. Use a private LAN for early testing; public deployment requires `wss://`, an authentication strategy and protective controls.

## Technology and repository layout

| Layer | Technology |
| --- | --- |
| Client renderer | Three.js 0.181.x |
| Game/application code | TypeScript 5.9.x |
| Package manager and server runtime | Bun (CI pinned to 1.3.3) |
| Web tooling | Vite 7.x |
| Android wrapper | Capacitor 7.x |
| Android build | Gradle + JDK 21 / Android SDK |
| 3D asset automation | Blender 4.x / headless Python |
| Multiplayer transport | Bun WebSocket |
| Guest-character storage | SQLite (`bun:sqlite`) |
| Automation | GitHub Actions |

```text
.
├── apps/
│   ├── client/
│   │   ├── src/
│   │   │   ├── main.ts                  # Three.js scene + gameplay bootstrap
│   │   │   ├── world/                   # Terrain, chunks, roads, towns, landmarks
│   │   │   ├── characters/              # Procedural rigs and GLB loader
│   │   │   ├── gameplay/combat.ts       # Local combat constants/helpers
│   │   │   ├── input/touchCamera.ts     # Touch zoom math
│   │   │   ├── ui/worldMap.ts           # Atlas and fog-of-war
│   │   │   └── multiplayer/client.ts    # WebSocket snapshots and remote avatars
│   │   └── capacitor.config.ts
│   └── server/
│       └── src/
│           ├── index.ts                # Bun HTTP/WebSocket + SQLite
│           ├── protocol.ts             # Message schemas and validation
│           └── simulation.ts           # Fixed-step movement + AOI snapshots
├── tools/
│   ├── blender/                          # GLB generator + validator
│   └── smoke-server.ts                  # Live two-client WebSocket check
├── test/                                 # Bun unit tests (11 test files)
├── docs/                                 # System-specific design and QA notes
└── .github/workflows/
    ├── android-debug-apk.yml
    └── blender-assets.yml
```

## Prerequisites and local setup

### Basic development

1. Install [Bun](https://bun.sh/) (CI uses **1.3.3**), Git and a modern browser.
2. Clone the repository and install workspaces:

```bash
git clone https://github.com/mtdewwolf/realms-unwritten.git
cd realms-unwritten
git switch Master
bun install
```

3. Validate TypeScript and tests:

```bash
bun run check
bun test
```

4. Start the server and web client in separate terminals:

```bash
bun run dev:server
# Other terminal, from repository root:
bun run dev:client
```

Or start both with `bun run dev`. Vite usually serves at `http://localhost:5173` unless that port is occupied. The Bun server is `http://localhost:3001` by default.

5. Open `http://localhost:5173`, explore offline or enter `ws://localhost:3001/ws` in the multiplayer URL field and tap **CONNECT**.

**Assets:** The CI builds the actual GLBs before building the web client. A fresh local checkout has **no committed `apps/client/public/assets/*.glb` files**; without running Blender generation, the web app should use its procedural visual fallbacks. Follow the [Blender asset pipeline](#blender-asset-pipeline) section if you want locally generated rigged models.

### LAN play on Android

The host PC and the phone need network access to each other (same LAN or permitted routed network). Start Bun on your computer and determine the computer's **LAN IP**, e.g. with `hostname -I` on Ubuntu. In the APK enter:

```text
ws://192.168.1.50:3001/ws
```

**Replace `192.168.1.50` with your computer's actual IP.** Do not use `localhost` on a phone to reach a different computer. Ensure the firewall allows TCP 3001 and avoid guest Wi-Fi/client-isolation networks. Android **debug** manifests permit cleartext networking; production needs a secure `wss://` endpoint.

## Building Android APKs

### Preferred — GitHub Actions

1. Open **[Android Debug APK](https://github.com/mtdewwolf/realms-unwritten/actions/workflows/android-debug-apk.yml)**.
2. Select **Run workflow** on branch `Master`, or push a commit to `Master`.
3. Verify each step is green: checkout, Bun install, typecheck/tests, Blender dependencies, GLB generation/validation, live WebSocket smoke test, Vite build, Capacitor sync, Gradle APK compile and artifact upload.
4. Download artifact **`realms-unwritten-debug-apk`** from the completed workflow run (GitHub may require signing in).
5. Extract the artifact and install `app-debug.apk` onto a test device.
6. Check boot, touch controls, landscape/portrait layouts, offline mode and LAN multiplayer manually.

CI **already passed** at [run #43148146024](https://github.com/mtdewwolf/realms-unwritten/actions/runs/43148146024), for source commit `0c24d4e`. Later commits should be checked independently.

**Artifact retention:** Android debug APK ~14 days; dedicated character GLBs ~30 days. Artifacts are not automatically published as releases or installed on devices.

### Local Android build (Ubuntu / suitable Windows environment)

Install **JDK 21**, a working Android SDK, Bun and Blender with NumPy available to Blender's exporter. Ensure `ANDROID_HOME` points to the SDK.

```bash
bun install
bun run check
bun test

# Ubuntu package example; use your distro-specific package manager if necessary.
sudo apt-get install blender python3-numpy
mkdir -p apps/client/public/assets
blender --background --factory-startup --python-exit-code 1 \
  --python tools/blender/generate_characters.py -- \
  --out apps/client/public/assets
python3 tools/blender/validate_glb.py apps/client/public/assets

bun run build
cd apps/client
bunx cap add android
bunx cap sync android
cd android
chmod +x gradlew
./gradlew --no-daemon assembleDebug
```

Expected APK: `apps/client/android/app/build/outputs/apk/debug/app-debug.apk`.

The repository does not commit the generated `apps/client/android/` native project; regenerate it on clean checkouts. For LAN testing, the CI adds `android:usesCleartextTraffic="true"` **only for debug builds**. If compiling locally from scratch, replicate that debug manifest as described in [the workflow](.github/workflows/android-debug-apk.yml), or use `wss://`. Do **not** enable arbitrary cleartext traffic in production.

Optional install with ADB:

```bash
adb devices
adb install -r apps/client/android/app/build/outputs/apk/debug/app-debug.apk
```

## Blender asset pipeline

**Dedicated workflow:** [Build Blender Character Assets](https://github.com/mtdewwolf/realms-unwritten/actions/workflows/blender-assets.yml).

It installs Blender + NumPy, runs the original Python generator, validates GLB v2 structure/rig/clip names, produces SHA-256 sums, and uploads the **`realms-unwritten-character-glbs`** artifact containing `adventurer.glb`, `wolf.glb`, and `SHA256SUMS`.

Local regeneration:

```bash
mkdir -p build/assets
blender --background --factory-startup --python-exit-code 1 \
  --python tools/blender/generate_characters.py -- --out build/assets
python3 tools/blender/validate_glb.py build/assets
sha256sum build/assets/*.glb
```

The Android workflow independently generates the GLBs under the client's `public/assets/` folder before Vite bundles them. Generated assets are reproducible **blockouts**, not a polished production art library.

## All automated and manual testing steps

Run tests from the **repository root**, unless a subsection explicitly changes directory. An automated pass only validates that specific contract; actual Android responsiveness and gameplay must also be checked on real hardware.

### A. Fast developer gate (every change)

```bash
bun install
bun run check
bun test
bun run build
```

**Expected:** No TypeScript errors; all Bun tests pass; Vite produces `apps/client/dist/`. `bun run build` can still use procedural visual fallbacks if local GLBs have not been generated, so additionally run the asset pipeline when testing rigged models.

Existing Bun test files cover:

| Test file | What it checks |
| --- | --- |
| `test/bootstrap.test.ts` | Project/bootstrap invariants |
| `test/assets.test.ts` | Asset catalog/limits |
| `test/glb-wiring.test.ts` | GLB URL wiring |
| `test/touch-camera.test.ts` | Pinch and camera input math |
| `test/combat-demo.test.ts` | Local attack/stamina math |
| `test/chunked-world.test.ts` | Chunk indexing, bounds and deterministic placement |
| `test/terrain.test.ts` | World seam heights, collision sampler and grid sizes |
| `test/world-landmarks.test.ts` | Landmark stability and chunk ownership |
| `test/settlements.test.ts` | Settlement locations, ownership and road-grid spacing |
| `test/world-map.test.ts` | Map projection, fog-cell addressing and compass guidance |
| `test/server-simulation.test.ts` | Authoritative movement, sequence rejection, bounds and proximity |
| `test/server-combat.test.ts` | Shared wolf health, range/cooldown/dodge validation, respawn |
| `test/inventory.test.ts` | Atomic reward grants, duplicate prevention and eligibility |
| `test/quests.test.ts` | Persistent quest progress, kill deduplication, one-time turn-in, guard range |

Focused runs:

```bash
bun test test/server-simulation.test.ts test/server-combat.test.ts
bun test test/chunked-world.test.ts test/terrain.test.ts
bun test test/world-landmarks.test.ts test/settlements.test.ts test/world-map.test.ts
bun test test/combat-demo.test.ts test/touch-camera.test.ts
```

### B. Live server integration smoke test

```bash
bun tools/smoke-server.ts
```

**Expected:** Output similar to `PASS multiplayer smoke: 2 guests, authoritative position and nearby snapshots` and exit code 0. This test starts a temporary Bun server with an isolated SQLite file, waits for `/health`, connects **two distinct guests**, sends movement input, validates that the second guest receives the moved player, shuts down the process and removes temporary data. It does **not** currently certify reconnection across server restarts, authentication security, actual phone sockets, or hundreds of concurrent players.

Run this in addition to `bun test`; it is not a normal `test/*.test.ts` unit test.

### C. Server health and direct connection

1. Start the server:

   ```bash
   bun run dev:server
   ```

2. Query health:

   ```bash
   curl -fsS http://127.0.0.1:3001/health
   ```

3. Verify response has `"ok":true`, protocol version `4`, and the online player count.
4. Open the client and connect to `ws://127.0.0.1:3001/ws` (when client and server are on the same machine).
5. Confirm the connection-status message switches to online. Disconnect and verify offline exploration continues.
6. In the terminal, check for runtime exceptions and ensure the server remains running.

For isolated testing without touching existing character data:

```bash
HOST=127.0.0.1 PORT=3001 WORLD_DB_PATH=/tmp/realms-unwritten-qa.sqlite \
  bun apps/server/src/index.ts
```

### D. Two-player LAN multiplayer manual test

**Important:** Use two distinct guest identities—e.g., a phone and a separate browser profile. Two normal tabs in the *same* browser profile share a guest token and the server rejects duplicate sessions by design.

1. Start Bun on a host accessible over the LAN, confirm TCP port 3001 is open.
2. Connect Device A and Device B to `ws://<HOST_LAN_IP>:3001/ws`.
3. Both should join without errors and show a character near the starter area.
4. Move A using its joystick/WASD; B should see A move.
5. Move B; A should see B move. Check remote facing and stop behavior.
6. Disconnect B; A should no longer render B.
7. Reconnect B with its existing token; the character should return to its saved server position.
8. Restart Bun gracefully and reconnect each client; saved x/z positions should be restored.
9. Walk beyond the **160-meter** nearby-player radius; distant players should disappear from each other's local rendering. Return and verify they reappear.
10. Switch off the server or network: gameplay should remain explorable offline and remote avatars should disappear.
11. Test from Android on both Wi-Fi and a routed network only when the server is reachable; do not use `localhost` on the phone to access a different machine.
12. Confirm no repeated console errors, runaway memory or stuck movement after reconnect.

**Expected limitations:** remote players use procedural representations, not full rigged GLBs. Combat and map discoveries are not shared. Rejoining a wiped/new server database with an existing guest token currently returns an invalid-credential error; preserving the database is required for identity continuity.

### E. Input, camera and mobile lifecycle

On an Android device or touchscreen browser:

1. Hold joystick forward, backward, left, right and diagonal; check speed does not multiply diagonally.
2. While moving, drag another finger on the terrain to rotate the camera.
3. Pinch both directions and verify the zoom remains within its minimum/maximum bounds.
4. Release one finger while pinching, then continue dragging: no camera jump or stuck gesture.
5. Hold joystick, background the app or switch apps, return: movement must stop rather than continue indefinitely.
6. Test the attack/dodge/gather buttons separately, including rapid tapping.
7. Rotate between portrait and landscape; ensure essential controls, map, multiplayer entry, and status indicators remain reachable.
8. Open the map while using touch controls and verify it does not unintentionally capture world-camera drags.
9. Test input with physical keyboard attached as well as touchscreen where available.

### F. Wolf combat gameplay (offline and authoritative online)

1. Start offline near the wolf.
2. Confirm wolf health **60**, player health **100**, stamina **100**.
3. Walk within attack range and tap ATTACK: wolf health drops by **20** and stamina drops by **16**, subject to cooldown.
4. Tap ATTACK from outside range: no wolf damage, and combat UI indicates out-of-range.
5. Allow stamina to regenerate; verify repeated attacks cannot bypass cooldown/stamina costs.
6. Walk near wolf and watch its ~850 ms attack warning.
7. Dodge during wind-up: stamina should drop by **26** and the bite should miss if within the dodge window.
8. Stay within wolf bite range without dodging: health should drop by **12** on a hit.
9. Defeat the wolf (three 20-damage successful hits); confirm the wolf cannot be damaged further.
10. Offline outcomes are local. Online, both clients must see the same server wolf HP/phase and their own authoritative vitals; combat state is not currently persisted across a server restart.
11. Check behavior with zero player health; actions/movement should be disabled appropriately.

### G. World generation and streaming

1. Start at the flat Verdant Reach area, confirm buildings/props are visible and ground is aligned.
2. Walk more than **50 m** away from the start in all four directions—the old demo boundary must not block travel.
3. Verify the chunk HUD updates and nearby chunk count stays **≤25**.
4. Cross positive and negative chunk coordinates, including at x/z = 0.
5. Inspect terrain seams: no visible holes/cracks between adjacent meshes.
6. Walk over hills and valleys; the player should visually follow the terrain without floating or sinking.
7. Leave a distant chunk and come back; trees, rocks, landmarks and settlements should reappear consistently.
8. Observe road ribbons crossing chunk borders and hills; note any floating sections, surface clipping, or incorrect alignments.
9. Check that the village remains near y=0 and hills transition gradually away from it.
10. Travel toward the world edge (using a temporary development/debug helper if necessary); x/z should remain within approximately ±8190 m.
11. Spend 10–15 minutes crossing many chunk borders while watching FPS, heat and memory. This **manual performance test has not been certified**.

### H. Landmarks, settlements, discoveries and map

1. Find a watchtower, ore outcrop, and wolf den in generated areas. Verify they are visible and stable on revisits.
2. Approach a landmark within about **16 m**; its discovery count/status should update.
3. Walk near a generated hamlet/outpost within about **28 m**; confirm settlement discovery.
4. Revisit it after leaving the chunk; its name/location should remain consistent.
5. Open MAP; initially unrevealed cells should be obscured.
6. Explore and reopen MAP; traveled 64-meter cells should be revealed.
7. Confirm only discovered landmarks/towns appear as markers.
8. Tap an **explored** cell, set a waypoint, follow distance/compass guidance; approach within ~8 m to complete.
9. Tap an **unexplored** cell: it should not set a destination.
10. Clear a destination and verify guidance resets.
11. Reload/restart the app: visited cells and discovery IDs should remain in localStorage.
12. With a separate browser profile, verify exploration progress is not automatically shared.
13. Explicitly test **GATHER** and confirm it reports pending authoritative gathering rather than inventing loot.

### I. Character asset and animation QA

1. Generate both GLBs with Blender and run the validation script:

   ```bash
   blender --background --factory-startup --python-exit-code 1 \
     --python tools/blender/generate_characters.py -- --out build/assets
   python3 tools/blender/validate_glb.py build/assets
   ```

2. Confirm both assets are nonempty GLB version 2, contain meshes/skins, and have required named clips.
3. Confirm `adventurer.glb` and `wolf.glb` load in the client and are correctly positioned relative to the ground.
4. Test idle, walking, sword attack, dodge, wolf movement, wolf attack and death transitions.
5. Verify the procedural fallback remains visible when GLBs are **deliberately absent** or invalid.
6. Inspect skeleton pivot artifacts, clipping, incorrect facing and animation loops.
7. On Android, check frame-time and GPU skinning costs rather than assuming small files guarantee good runtime performance.
8. When downloaded from Actions, verify the SHA-256 sums: `sha256sum -c SHA256SUMS` from the extracted artifact directory.

### J. Persistence and failure recovery

1. With the isolated SQLite DB, connect, move and disconnect cleanly; reconnect and verify position.
2. Restart the Bun process gracefully and reconnect; verify positions survive the restart.
3. Try a second simultaneous connection with the **same token**: expect rejection, not duplicate control.
4. Use an intentionally malformed/expired/wrong guest token; verify clear failure without server crash.
5. Send out-of-order, repeated or invalid movement messages via a test client; position should not teleport.
6. Disconnect unexpectedly; server should stop movement and remove nearby visibility.
7. Remove or rename the **test** database and reconnect with a formerly saved token; document the current invalid-token behavior.
8. Never delete a real player's DB to run these cases. Keep backups of SQLite data before schema changes.

### K. Android smoke and performance acceptance

Test on at least one actual Android phone:

| Check | Expected evidence |
| --- | --- |
| Install and launch | APK installs; no crash / blank WebView |
| Offline launch | World renders without server available |
| Assets | GLBs or intentional fallback visible |
| Controller | Joystick, camera drag, pinch, attack/dodge all respond |
| Navigation | MAP, fog, waypoint and markers are usable |
| Streaming | Many chunk crossings without terrain holes or memory runaway |
| Multiplayer | Two devices share a server; positions replicate, disconnect cleans up |
| Reconnect | Persistent guest position survives graceful server restart |
| Performance | Record frame rate (target **30 FPS**), dropped frames, RAM and temperature over 10–15 min |
| Lifecycle | Background/resume, rotation, screen lock/unlock, Wi-Fi disconnect |
| Crash diagnostics | Save `adb logcat` output and server logs when a failure occurs |

Useful Android commands:

```bash
adb devices
adb install -r apps/client/android/app/build/outputs/apk/debug/app-debug.apk
adb logcat -c
adb logcat > android-session.log
# Stop capture with Ctrl+C and attach the log to your issue report.
```

**30 FPS is a project target, not a verified benchmark.** Actual battery, CPU/GPU memory and thermal behavior must be measured on hardware.

### L. Regression gate before merging/releasing

- [ ] `bun run check` passes for **both** client and server.
- [ ] `bun test` passes.
- [ ] `bun tools/smoke-server.ts` passes.
- [ ] Blender generator and GLB validator pass.
- [ ] `bun run build` completes.
- [ ] Android Gradle `assembleDebug` succeeds and artifact exists.
- [ ] Offline exploration still works.
- [ ] Two distinct guest clients can connect and see movement.
- [ ] In protocol v4, they agree on shared wolf HP/phase and rejected forged attacks.
- [ ] Position persistence survives a graceful restart.
- [ ] World chunks, road geometry, map and discovery states remain stable.
- [ ] Real Android device boot/controls/performance verified for release candidates.
- [ ] Any failed test has a reproducible log, device/build info and tracking issue.

Suggested bug report:

```text
Commit / branch:
APK Actions run / artifact:
Device + Android version (or browser):
Server Bun version / host OS:
World coordinates / chunk:
Steps to reproduce:
Expected:
Observed:
Logcat / Bun log:
Frequency:
```

## Known limitations, security, and troubleshooting

### Current technical limitations

- Single-process server and SQLite database; no horizontal scaling, rediscovery across shards, interest spatial index or production observability.
- Local terrain/world objects are not validated by the server. Online starter wolf damage is authoritative, but terrain collision, loot, enemy-spawn scaling and other encounters are not.
- Touch UI may overlap on smaller displays; portrait and accessibility layouts require QA.
- Realtime movement uses server snapshots with simple correction rather than full client prediction/replay.
- The client does not automatically reconnect when the server returns after an outage.
- Guest token storage is local browser/WebView storage; no secure auth or account recovery.
- Static procedural character copies for other players have no full animation replication.
- World scenery is largely low-poly placeholders and may intersect roads or spawn too close to objects.
- No backend-controlled inventory, economics, or durable world entities.
- No load tests, anti-cheat threat model, player moderation or production operation runbooks.

### Troubleshooting guide

| Symptom | Likely cause / next check |
| --- | --- |
| APK Actions fails at type checking | Read the failing `bun run check` diagnostic; fix TS before retrying |
| Blender export missing GLB | Install `blender` and `python3-numpy`; run `--python-exit-code 1`; validate outputs |
| Web app shows simple procedural character | GLB file not generated / wrong `/assets/*.glb` path; fallback is intentional |
| Android cannot connect to Bun | Wrong LAN IP, host firewall, guest Wi-Fi isolation, server not started, or cleartext policy |
| Browser cannot connect to WSS | Secure page usually requires `wss://`; configure valid TLS/proxy |
| "Character already connected" | Same guest token in two browser tabs/profiles; use distinct identity stores |
| "Unknown guest token" | Connecting to a different/reset server DB; guest token cannot be recovered there |
| Client moves offline but no second player appears | Verify both clients connected; use separate guest profiles and remain within 160 m |
| Map doesn't reveal old locations on another device | Exploration is localStorage-only, not account-synced |
| Gather button doesn't produce items | Gathering feature is not implemented |
| Wolf combat differs between clients | Confirm both use protocol v2 and are online; shared wolf combat is authoritative, offline wolf fights remain local |
| Gradle fails on local build | Verify JDK 21, SDK location, Android build tools and generated Capacitor project |
| Performance drops after travel | Profile streamed geometry, chunk churn, draw calls, WebView memory and thermal throttling |

### Security rules for future public deployment

1. Put a supported TLS reverse proxy/ingress in front of the Bun server and use **WSS**.
2. Replace bearer tokens in localStorage with a proper auth/session lifecycle.
3. Add strict WebSocket origin verification, edge rate limits, audit logs, bans and abuse monitoring.
4. Validate server-driven interactions: movement with real collision, combat, loot, economy and construction.
5. Secure and back up the SQLite data store; plan migrations before adding persistent inventory/world entities.
6. Add spatial interest indexing, load testing and sharding/region partitioning when concurrency demands it.

**Do not publicly expose this prototype server as-is.**

## Outstanding work and milestones

### Priority 1 — Make the multiplayer foundation game-authoritative

- Proper movement prediction/reconciliation, server-side collision and terrain constraints.
- Stable player identity/account login and safe reconnect flows.
- Shared protocol package and strict version negotiation.
- Spatial index for nearby entities, robust disconnect/presence handling.
- Deployment, TLS, metrics and backup/recovery.

### Priority 2 — Deliver one complete RPG vertical slice

- Expand the starter guard quest to real NPC conversations and dialogue.
- Expand persistent Wolf Hunt to multiple quests, branching objectives and a proper quest log.
- Inventory, basic gear and item rewards.
- Server-owned gathering and resource depletion.
- XP, levels, stats and character persistence.

### Priority 3 — Expand the authoritative combat vertical slice

- Expand the one authoritative starter wolf into server-owned wildlife territories, multiple enemy types, threat rules and proper spawn ownership.
- Extend basic validated attack/dodge, health and respawn to real skills, spatial collision and equipment-driven damage.
- Combat feedback, targeting and loot attribution.
- Persist relevant player health/progression, synchronize combat outcomes and implement loot/death recovery.

### Priority 4 — Meaningful world and economy

- Fully designed settlements with shops, crafting stations and quests.
- Production biomes/terrain features, roads, rivers, bridges and dungeons.
- Crafting professions, resource supply/demand, trading and currency sinks.
- Travel/fog/waypoint persistence per account and groups.

### Priority 5 — MMO operations and release readiness

- Region servers, durable world state, persistence migrations and scale testing.
- Parties/guilds, chat, moderation, player safety and social features.
- Android optimization, 30 FPS performance budgets, audio, accessibility, UX polish.
- Security review, signing, testing tracks, crash reporting and Android store release.

**Recommended near-term acceptance milestone:** two independently logged-in players can join, see each other, accept the same NPC quest, interact with one server-owned resource/enemy, receive server-validated rewards, disconnect and reconnect with those rewards intact.

## Supporting design documents

- [Multiplayer Server](docs/MULTIPLAYER_SERVER.md)
- [Authoritative Combat](docs/AUTHORITATIVE_COMBAT.md)
- [Inventory and Loot](docs/INVENTORY_LOOT.md)
- [Wolf Hunt Quest](docs/WOLF_HUNT_QUEST.md)
- [World Streaming](docs/WORLD_STREAMING.md)
- [Terrain and Biomes](docs/TERRAIN_BIOMES.md)
- [World Landmarks / Content](docs/WORLD_CONTENT.md)
- [Settlements and Roads](docs/SETTLEMENTS_ROADS.md)
- [World Atlas](docs/WORLD_ATLAS.md)
- [Android QA](docs/ANDROID_QA.md)
- [Local Combat Slice](docs/ANDROID_COMBAT_SLICE.md)
- [Blender Generation Pipeline](docs/assets/BLENDER_PIPELINE.md)
- [GLB Runtime Integration](docs/assets/GLB_INTEGRATION.md)
- [Asset Production Plan](docs/assets/PRODUCTION_PLAN.md)

---

**Maintainer note:** Always update this README when a gameplay system changes. Mark real implementation separately from proposed design, keep test instructions executable, and check the latest GitHub Actions run before claiming an APK or server feature is release-ready.
