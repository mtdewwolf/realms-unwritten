# Realms Unwritten

Realms Unwritten is a playable prototype of an original, Android-first fantasy world. You create an account, enter as one of eight races, explore a generated landscape, fight a shared wolf, gather, craft, and see other players on the same realm server.

The long-term reference for structure is vanilla-era World of Warcraft (1.12.1): world scale, factions, quests, combat, and professions. The factions, races, names, and art in this repository are original. See [MMORPG reference standard](docs/WOW_1121_REFERENCE_STANDARD.md).

Today’s build is one Bun process and one SQLite file: accounts, one shared wolf, one quest, and the players connected to that process. Chat, parties, guilds, merchants, and extra quests are still ahead of this tree.

## Contents

1. [Feature overview](#feature-overview)
2. [Repository layout](#repository-layout)
3. [Prerequisites](#prerequisites)
4. [Quick start](#quick-start)
5. [Configuration](#configuration)
6. [Deploy the realm server on Railway](#deploy-the-realm-server-on-railway)
7. [Ideas board](#ideas-board)
8. [Android app](#android-app)
9. [Art pipeline](#art-pipeline)
10. [Testing and CI](#testing-and-ci)
11. [Further reading](#further-reading)

## Feature overview

The client is a Three.js scene in a Vite app, wrapped for Android with Capacitor. The realm server in `apps/server` owns accounts, positions, the wolf, inventory, quests, gathering, and crafting. The wire protocol is **version 11** (`PROTOCOL_VERSION` in `apps/server/src/protocol.ts`). Client and server have to be from the same protocol generation.

| Area | What the current code does |
| --- | --- |
| Accounts | Register and sign in over the WebSocket. Passwords are Argon2id hashes. A session lasts 30 days. Each account owns one character. |
| Characters | Two factions, eight races, three classes, plus a saved appearance. |
| Inventory | Server-owned stacks, coins, and one equipped weapon. The Backpack panel shows them. |
| Quests | One quest, Wolf Hunt, offered by the Verdant Reach guard. |
| Gathering | Iron ore and Moonleaf, taken from the server position, with shared node cooldowns in SQLite. |
| Crafting | Ironblade and Healing Tonic, only beside that guard. |
| Combat | One shared starter wolf. Attack, dodge, and three class abilities are server-checked. |
| Movement | The server simulates at 20 Hz and snapshots at 10 Hz. The client predicts with the same movement step. |
| World | A 16,384 m square streamed in 64 m chunks. Discoveries and the atlas stay on the device. |
| Ideas board | Private kanban in `apps/kanban`, separate from the realm server, with its own SQLite file. |

### Accounts

The title screen talks to `ws://` or `wss://` at the path `/ws`.

- **Create account** and **Sign in** send `account_register` or `account_login`. A username is 3–24 characters, starts with a letter, and may contain letters, digits, `_`, and `-`. The server stores it in lowercase. A password is 10–128 characters. Hashing uses Argon2id (`memoryCost` 16384, `timeCost` 3) through `Bun.password`.
- A successful auth returns an `account_ready` bearer token. The client keeps it in `localStorage` under `realms-unwritten-account-session-v1`. The database stores only the SHA-256 of that token. Sessions expire after 30 days (`ACCOUNT_SESSION_DURATION_MS`).
- An account with no character receives `creation_required`. An account that already has one enters that character. A second character on the same account is rejected.
- **Continue legacy guest** still resumes a pre-account bearer token (`realms-unwritten-guest-token-v1`). **Offline demo** never creates an account, and nothing from that session is saved on the server.
- There is no email recovery, password reset, or account deletion. A socket may attempt auth five times.

### Characters and races

Creation sends `create_character` with a name, faction, race, and class. A name is 3–20 characters after trimming, starts with a letter or number, and may include letters, numbers, spaces, apostrophes, and hyphens. The race has to belong to the faction. Optional appearance is body frame (`lean` or `sturdy`), skin tone, hair style, hair color, and marking. Identity is stored in SQLite and comes back on `welcome`.

| The Radiant Accord | The Umbral Dominion |
| --- | --- |
| Sunborne, Thornkin, Stonehearth, Aetheri | Ashforged, Hornwarden, Hollowborn, Veilkin |

Classes are **Vanguard**, **Spellweaver**, and **Shadeblade**. Each pair is a rigged model, `hero-<race>-<class>.glb`, with clips `idle`, `walk`, `attack`, `dodge`, `cast`, and `death`. The creator shows a tap-selectable lineup of the four races in the chosen faction. If a GLB is missing, the procedural race mesh stays visible.

Class abilities are checked on the server against the saved class:

| Class | Ability | Server rule |
| --- | --- | --- |
| Vanguard | Bulwark | 22 stamina. For 4 seconds, the wolf bite of 12 is reduced to 6. Cooldown 14 seconds. |
| Spellweaver | Arc Bolt | 30 stamina, 28 damage, up to 9 meters. Cooldown 9 seconds. |
| Shadeblade | Quickstrike | 25 stamina, 34 damage, within 3.25 meters. Cooldown 7 seconds. |

### Inventory, quests, gathering, and crafting

A wolf kill grants each damage contributor one Wolf Pelt, one Wolf Fang, 5 coins, and 15 XP, in one SQLite transaction per contributor. Duplicate event ids do not pay twice.

**Wolf Hunt** (`verdant-wolf-hunt`) is accepted and turned in within 6 meters of the guard at (2, −3). It takes 3 shared-wolf kills. Turn-in pays 25 coins, a Fangblade, and 75 XP. The Quests panel shows stage and kill count.

Gathering uses the authoritative position. Within 5 meters, the nearer of an iron outcrop or a Moonleaf patch is harvested. An exact tie harvests the ore. Ore nodes cool down for 30 seconds and Moonleaf for 45 seconds. Those cooldowns are global and survive a restart. A gather while dead, or while out of range, is rejected. A gather packet has no position field; the server uses the simulated character.

Crafting uses the same 6-meter guard radius, which the server treats as the Verdant Reach workshop:

| Recipe | Materials | Result |
| --- | --- | --- |
| `ironblade` | 2 Iron Ore and 1 Wolf Fang | Ironblade, +12 weapon damage |
| `healing-tonic` | 2 Moonleaf | Healing Tonic |

Using a Healing Tonic consumes one tonic and restores 30 health, only for a living character who is below 100 health. The server ignores any heal amount on the packet.

Weapons are Worn Sword (+0), Fangblade (+8), and Ironblade (+12). A sword hit is `20 + floor((Strength − 5) / 2) + weapon bonus`. Strength is `5 + (level − 1) * 2`. Vitality and Agility are shown on the Character panel. Reaching level 2 takes 100 XP. The threshold for a level is `50 * (level − 1) * level`, and levels cap at 50.

Player health and stamina (both cap at 100) reset when you rejoin. Inventory, coins, gear, quest progress, XP, and x/z position persist. Stamina regenerates at 18 per second while alive. The wolf has 60 health and respawns 8 seconds after defeat. A downed player respawns after 5 seconds at (0, 0).

### Multiplayer

`GET /health` returns JSON:

```json
{"ok":true,"game":"realms-unwritten","protocol":11,"players":0,"wolfHealth":60}
```

`GET /ws` upgrades to a WebSocket. Any other path returns the text `Realms Unwritten authoritative movement prototype`.

Clients send an input vector and a rising sequence. Speed is 5.5. `moveWithCollision` clamps travel to ±8190 meters (`WORLD_MOVEMENT_LIMIT`), two meters inside the 8192-meter half-extent. Other players are included inside 160 meters. Simulation is 20 Hz and snapshots are 10 Hz. Server ticks and the client both use that collision step (`apps/client/src/world/collision.ts`). The local avatar predicts with the same step (`apps/client/src/multiplayer/prediction.ts`) so walking stays continuous between snapshots.

Each socket allows 40 messages per second and a 2,048-byte payload. The idle timeout is 90 seconds. If no input arrives for more than 400 ms, velocity is cleared. A new socket with the same character saves and detaches the previous socket (close code 4002). Transient drops retry up to 6 times. The delays are 500 ms, 1 s, 2 s, 4 s, 8 s, and 12 s. The hello and character-creation wait is 8 seconds.

The addressable world is 16,384 m × 16,384 m, divided into 64 m chunks on a 256 × 256 grid. The client keeps a radius of 2 chunks (up to 25). Terrain, biomes, roads, settlements, and landmarks are generated on the client. Explored map cells, landmark discoveries, and settlement discoveries stay in `localStorage` (`realms-unwritten-map-v1`, `realms-unwritten-discoveries-v1`, `realms-unwritten-settlement-discoveries-v1`) and are not part of the account.

In the world, **☰ MENU** opens Map, Backpack, Quests, Character, and Multiplayer. **M** opens the map. The action button reads GATHER, MINE, or PICK depending on the nearest node.

## Repository layout

```text
.
├── apps/client/                 # @realms/client — Vite, Three.js, Capacitor
│   ├── src/main.ts              # Scene, HUD, title-screen wiring
│   ├── src/characters/          # Procedural races and GLB loading
│   ├── src/multiplayer/         # WebSocket client and movement prediction
│   ├── src/ui/                  # Title, creator, menu, bag, quests, map
│   ├── src/world/               # Chunks, terrain, collision, landmarks
│   └── capacitor.config.ts
├── apps/server/                 # @realms/server — Bun HTTP + WebSocket
│   ├── src/index.ts             # Process entry, /health, /ws, shutdown
│   ├── src/protocol.ts          # Protocol 11 and message checks
│   ├── src/accounts.ts
│   ├── src/simulation.ts
│   ├── src/combat.ts
│   ├── src/inventory.ts
│   ├── src/quests.ts
│   ├── src/resources.ts
│   └── railway.json             # Health check path only
├── apps/kanban/                 # @realms/kanban — private ideas board
│   ├── src/index.ts             # HTTP API, session cookie, SQLite shutdown
│   └── railway.json             # Railpack, /health, one replica, /data volume
├── apps/shared/src/             # Faction, race, and class catalog
├── tools/blender/               # Headless GLB generators and validators
├── tools/smoke-server.ts        # Live two-client WebSocket smoke test
├── test/                        # bun test
├── docs/                        # Longer system notes
└── .github/workflows/
    ├── android-debug-apk.yml
    └── blender-assets.yml
```

Root `package.json` workspaces are `apps/*` and `packages/*`. The packages that exist are `@realms/client`, `@realms/server`, and `@realms/kanban`. `apps/shared` has no `package.json`; client and server import it by relative path. There is no `packages/` directory.

| Script | What it runs |
| --- | --- |
| `bun run dev` | Server and client together (`bun run --parallel`) |
| `bun run dev:server` | `bun --watch src/index.ts` in `apps/server` |
| `bun run dev:client` | `vite --host 0.0.0.0` in `apps/client` |
| `bun run dev:kanban` | `bun --watch src/index.ts` in `apps/kanban` (http://localhost:3002) |
| `bun run build` | Client typecheck and Vite build (`apps/client/dist`) |
| `bun run check` | `tsc --noEmit` for client, server, and kanban |
| `bun test` | Every `test/*.test.ts` file |

Stack versions in the manifests: TypeScript 5.9.x, Three.js 0.181.x, Vite 7.x, Capacitor 7.x. The Android workflow installs Bun 1.3.3 and Temurin JDK 21.

## Prerequisites

- [Bun](https://bun.sh/) for install, the server, tests, and the web client. The Android workflow pins **1.3.3**.
- Git and a current desktop browser.
- Android builds also need JDK 21 and an Android SDK with `ANDROID_HOME` set.
- Local rigged models need Blender and `python3-numpy`. Generated GLBs are build outputs and are absent from git. Without them, heroes and the wolf stay on the procedural meshes.

## Quick start

```bash
git clone https://github.com/mtdewwolf/realms-unwritten.git
cd realms-unwritten
git switch Master
bun install
bun run dev:server
```

In a second terminal, from the repository root:

```bash
bun run dev:client
```

`bun run dev` starts both. The server listens on port **3001** and prints `Realms Unwritten server on … (WebSocket: /ws)`. Vite does not set a port in `apps/client/vite.config.ts`, so it uses Vite’s default **5173** and prints another port if 5173 is taken. Open the URL Vite prints (usually `http://localhost:5173`).

The ideas board is a separate process. `bun run dev:kanban` serves it at http://localhost:3002. See [apps/kanban/README.md](apps/kanban/README.md).

On the title screen, set **Realm server** to:

```text
ws://127.0.0.1:3001/ws
```

Then **Create account** or **Sign in**. A new account opens the character creator (faction, race, and class) before the world loads. **Offline demo** skips the server. **Continue legacy guest** resumes a guest token already stored in that browser.

Check the process before connecting:

```bash
curl -fsS http://127.0.0.1:3001/health
```

The in-game Multiplayer panel, on `localhost` or `127.0.0.1`, prefills `ws://<page hostname>:3001/ws`. Its Connect button returns you to the title screen with that URL; it does not open the socket by itself.

For a phone on the same LAN, use the computer’s LAN address, for example `ws://192.168.1.50:3001/ws`, with TCP 3001 reachable. `localhost` on the phone is the phone. A public client needs `wss://`.

## Configuration

The server reads three environment variables in `apps/server/src/index.ts`. Nothing else is required for a local run.

| Variable | Default | Role |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Bind address. |
| `PORT` | `3001` | HTTP and WebSocket port. |
| `WORLD_DB_PATH` | `data/realms-world.sqlite` | SQLite file, relative to the process working directory. `:memory:` skips creating a directory and is what tests use for a throwaway database. |

`bun run dev:server` runs with working directory `apps/server`, so the default file is `apps/server/data/realms-world.sqlite`. Starting with `bun apps/server/src/index.ts` from the repository root uses `data/realms-world.sqlite` there instead. The process creates the parent directory when the path is not `:memory:`.

Positions are written about every 10 seconds, on disconnect, and on SIGINT or SIGTERM. Shutdown runs `PRAGMA wal_checkpoint(TRUNCATE)` and closes the database before exit.

Isolated database on loopback:

```bash
HOST=127.0.0.1 PORT=3001 WORLD_DB_PATH=/tmp/realms-unwritten-qa.sqlite \
  bun apps/server/src/index.ts
```

`apps/client` has no game server variables. The realm URL is typed on the title screen and remembered as `realms-unwritten-server-url`.

## Deploy the realm server on Railway

Deploy only `@realms/server`. Set the service root directory to `apps/server`. The start script in `apps/server/package.json` is `bun src/index.ts`. Leave that command as detected. This service does not build or serve the Vite client.

`apps/server/railway.json` sets the deploy health check to `GET /health` and does not override the build or start command.

Use **one replica**. The world is a single SQLite file, with no sharding. Mount a volume at `/data` and set:

```text
WORLD_DB_PATH=/data/realms-world.sqlite
```

Do not set `HOST` or `PORT`. The process binds `0.0.0.0` and uses the `PORT` Railway injects. Railway terminates TLS. Players connect with:

```text
wss://<your-domain>/ws
```

A redeploy sends SIGTERM. The handler saves positions, checkpoints the WAL into the main database file, closes it, and stops the HTTP server.

Accounts on that host are the same prototype: Argon2id hashes and 30-day sessions, without email recovery or a global rate limit beyond the per-socket cap of 40 messages per second.

## Ideas board

`apps/kanban` (`@realms/kanban`) is a private kanban for game ideas. It does not share the world database or protocol 11.

In the same Railway project, add another service from this repo with root directory `apps/kanban`. Railpack’s install step is `bun install --frozen-lockfile`. There is no `build` script. The start command is `bun src/index.ts`. `apps/kanban/railway.json` sets the health check to `GET /health`, one replica, and a required volume at `/data`. Use a different volume from the realm server.

```text
KANBAN_DB_PATH=/data/kanban.sqlite
KANBAN_PASSWORD=<shared password>
```

Leave `NODE_ENV=production` (Railpack sets it). Do not set `PORT`. The process binds `0.0.0.0` and uses Railway’s `PORT`. If `KANBAN_PASSWORD` is unset while `NODE_ENV=production`, the process exits. Locally, an unset password starts the board open and prints a warning. A redeploy sends SIGTERM; the process checkpoints the WAL and closes the database before exit. Full steps are in [apps/kanban/README.md](apps/kanban/README.md).

## Android app

Capacitor config (`apps/client/capacitor.config.ts`): app id `game.realmsunwritten.client`, app name `Realms Unwritten`, web assets from `dist`. `android.allowMixedContent` is false. The generated `apps/client/android/` project is gitignored.

### GitHub Actions

Workflow [Android Debug APK](https://github.com/mtdewwolf/realms-unwritten/actions/workflows/android-debug-apk.yml) runs on every push to `Master` or `main`, and from **Run workflow**. On `ubuntu-latest` it installs Bun 1.3.3 and JDK 21, then `bun install`, `bun run check`, `bun test`, Blender GLB generation and lineup renders, `bun tools/smoke-server.ts`, `bun run build`, `bunx cap add android`, a debug cleartext manifest, `bunx cap sync android`, and `./gradlew --no-daemon assembleDebug`.

Artifacts, kept 14 days:

- `realms-unwritten-debug-apk` — `app-debug.apk`
- `realms-unwritten-actual-race-lineups` — the two faction preview PNGs

Install the debug APK on a device and point **Realm server** at a reachable URL. Debug CI turns on cleartext so `ws://` works on the LAN. A release build should use `wss://`.

### Local debug APK

JDK 21, the Android SDK (`ANDROID_HOME`), Bun, and Blender with NumPy:

```bash
bun install
bun run check
bun test
sudo apt-get install -y --no-install-recommends blender python3-numpy
mkdir -p apps/client/public/assets
python3 -m py_compile tools/blender/generate_races.py tools/blender/render_lineup.py
blender --background --factory-startup --python-exit-code 1 \
  --python tools/blender/generate_characters.py -- \
  --out apps/client/public/assets
python3 tools/blender/validate_glb.py apps/client/public/assets
blender --background --factory-startup --python-exit-code 1 \
  --python tools/blender/generate_races.py -- \
  --out apps/client/public/assets
python3 tools/blender/validate_races.py apps/client/public/assets
bun run build
cd apps/client
bunx cap add android
mkdir -p android/app/src/debug
cat > android/app/src/debug/AndroidManifest.xml <<'MANIFEST'
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application android:usesCleartextTraffic="true" />
</manifest>
MANIFEST
bunx cap sync android
cd android
chmod +x gradlew
./gradlew --no-daemon assembleDebug
```

The APK is `apps/client/android/app/build/outputs/apk/debug/app-debug.apk`. The cleartext manifest matches the debug overlay in `.github/workflows/android-debug-apk.yml`. Omit it when the realm URL is `wss://`.

## Art pipeline

Headless Blender Python under `tools/blender/` builds the rigged prototypes. Generated files are not committed. Validators use the Python standard library. Generation and lineup renders run inside Blender and need `python3-numpy` for the exporter.

| Script | Output |
| --- | --- |
| `generate_characters.py` | `adventurer.glb` (`idle`, `walk`, `attack`, `dodge`) and `wolf.glb` (`idle`, `walk`, `attack`, `death`) |
| `generate_races.py` | 24 files, `hero-<race>-<class>.glb`, each with `idle`, `walk`, `attack`, `dodge`, `cast`, `death` |
| `render_lineup.py` | `lineup-radiant-accord.png` and `lineup-umbral-dominion.png` from the exported race GLBs |
| `validate_glb.py` | Checks `adventurer.glb` and `wolf.glb` for glTF 2, a skin, and those clips |
| `validate_races.py` | Checks all 24 race GLBs and prints `PASS 24 race/class rigs and required clips` |

The client loads `/assets/wolf.glb` and `/assets/hero-<race>-<class>.glb`. The procedural mesh stays up until that load succeeds. `adventurer.glb` is still produced and validated; the player avatar does not mount it.

Put playable files in `apps/client/public/assets` so Vite serves them at `/assets/…`:

```bash
mkdir -p apps/client/public/assets build/lineup-previews
blender --background --factory-startup --python-exit-code 1 \
  --python tools/blender/generate_characters.py -- \
  --out apps/client/public/assets
blender --background --factory-startup --python-exit-code 1 \
  --python tools/blender/generate_races.py -- \
  --out apps/client/public/assets
python3 tools/blender/validate_glb.py apps/client/public/assets
python3 tools/blender/validate_races.py apps/client/public/assets
blender --background --factory-startup --python-exit-code 1 \
  --python tools/blender/render_lineup.py -- \
  --assets apps/client/public/assets --out build/lineup-previews
```

Two workflows:

- [Build Blender Character Assets](https://github.com/mtdewwolf/realms-unwritten/actions/workflows/blender-assets.yml) runs on `ubuntu-24.04` when `tools/blender/**` or that workflow file changes on `Master` or `main`, and from **Run workflow**. It builds and validates `adventurer.glb` and `wolf.glb`, writes `SHA256SUMS`, and uploads `realms-unwritten-character-glbs` (kept 30 days). It does not build the 24 race models.
- The Android workflow builds both generators, validates them, renders the two lineup PNGs, and bundles whatever landed in `apps/client/public/assets` into the web build and the APK.

These meshes are generated blockouts: rigid skinning, no hand-painted production textures, and no device frame-time budget in CI. More detail is in [Blender pipeline](docs/assets/BLENDER_PIPELINE.md) and [eight-race lineup](docs/RACE_LINEUP_OVERHAUL.md).

## Testing and CI

From the repository root:

```bash
bun run check
bun test
```

`bun run check` is `tsc --noEmit` for `apps/client/tsconfig.json`, `apps/server/tsconfig.json`, and `apps/kanban/tsconfig.json`. `bun test` runs the files in `test/`, including accounts, character creation, the eight-race catalog, combat, gathering, crafting, quests, movement prediction, a live gather against a spawned server, SIGTERM checkpointing, and the ideas board (`test/kanban.test.ts`).

`bun run build` typechecks the client again and writes `apps/client/dist`. It succeeds without GLBs; the procedural fallbacks cover that case.

The live smoke test is separate from `bun test`. It starts a server on a temporary SQLite file, waits for `/health`, and checks two guests, shared combat, quests, equipment, rejected forged gather and craft packets, guest resume, account registration, character creation, session resume, and password sign-in:

```bash
bun tools/smoke-server.ts
```

A passing run prints:

```text
PASS account flow: register, create character, resume session and password sign-in
PASS guest reconnect: same identity, saved position, single active session and inventory
PASS multiplayer smoke: shared combat, quest, equipment and rejected forged gathering/crafting
```

The Android workflow is the full gate: `bun run check`, `bun test`, Blender generation, `bun tools/smoke-server.ts`, `bun run build`, and `assembleDebug`. The Blender workflow is the narrower asset job described above. A green Actions run shows that those commands passed on the runner. It does not record a frame rate on a phone.

## Further reading

The notes in `docs/` go into each system as it was added. Where a note still names an older protocol version, an earlier four-race roster, or a system as absent, this README and the source are the current description. Protocol 11 is the live version in `apps/server/src/protocol.ts`.

**Play**

- [Character creation](docs/CHARACTER_CREATION.md)
- [Eight-race lineup](docs/RACE_LINEUP_OVERHAUL.md)
- [Race models and class abilities](docs/RACE_MODELS_AND_CLASSES.md)
- [Character progression](docs/CHARACTER_PROGRESSION.md)
- [Inventory and loot](docs/INVENTORY_LOOT.md)
- [Wolf Hunt](docs/WOLF_HUNT_QUEST.md)
- [Gathering and crafting](docs/GATHERING_CRAFTING.md)
- [Moonleaf and tonics](docs/MOONLEAF_TONICS.md)
- [Equipment and combat stats](docs/EQUIPMENT_COMBAT.md)
- [Authoritative combat](docs/AUTHORITATIVE_COMBAT.md)
- [Atomic wolf rewards](docs/ATOMIC_WOLF_REWARDS.md)
- [Resource guidance](docs/RESOURCE_GUIDANCE.md)

**World and client**

- [World streaming](docs/WORLD_STREAMING.md)
- [Terrain and biomes](docs/TERRAIN_BIOMES.md)
- [World content](docs/WORLD_CONTENT.md)
- [Settlements and roads](docs/SETTLEMENTS_ROADS.md)
- [World atlas](docs/WORLD_ATLAS.md)
- [Building collision](docs/BUILDING_COLLISION.md)
- [Android game menu](docs/ANDROID_GAME_MENU.md)
- [Visual rebuild](docs/VISUAL_REBUILD_V1.md)
- [Graphical rebuild pass 2](docs/GRAPHICAL_REBUILD_PASS_2.md)

**Server, art, and device checks**

- [Multiplayer server](docs/MULTIPLAYER_SERVER.md)
- [Reconnection](docs/RECONNECTION.md)
- [Blender pipeline](docs/assets/BLENDER_PIPELINE.md)
- [GLB integration](docs/assets/GLB_INTEGRATION.md)
- [Asset production plan](docs/assets/PRODUCTION_PLAN.md)
- [Android QA](docs/ANDROID_QA.md)
- [Android combat slice](docs/ANDROID_COMBAT_SLICE.md)

When a gameplay rule changes, update this README in the same change so the commands, ports, and protocol version stay tied to the source.
