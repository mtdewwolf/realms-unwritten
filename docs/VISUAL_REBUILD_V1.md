# Realms Unwritten — Visual Rebuild and Launch UX v1

## Objective
Use verified **2004–2006 World of Warcraft / patch 1.12.1 era** visual references to rebuild Realms Unwritten's world and characters in an **original** fantasy style. Do not copy Warcraft models, map layouts, textures, icons, UI artwork, names, sound, or game data. The goal is the same quality bar for distinctive silhouettes, hand-painted-looking materials, warm atmospheric lighting, recognizable towns, and unmistakable onboarding—not an asset swap.

## Visual references inspected
- Blizzard, *Restoring History: Creating WoW Classic*: https://worldofwarcraft.blizzard.com/en-gb/news/22646759/restoring-history-creating-wow-classic-panel-recap — importance of original models, character-screen backgrounds and zone lighting, not just mechanics.
- 2004–2006 archived screenshots: https://vanilla-archive.thealphaproject.eu/ — historical era examples of textured houses, layered trees, settlements and readable environment composition.
- Our older design reference: docs/WOW_1121_REFERENCE_STANDARD.md

## Implemented in this pass
1. **Explicit launch:** the APK starts at the title/account screen. Gameplay controls are hidden and the movement loop is gated until authenticated or explicit OFFLINE DEMO is selected.
2. **Registered accounts:** username/password account registration and login using Bun Argon2id hashes, time-limited 30-day random session tokens (only hashed on server), one persistent character per account, automatic account resume, guest migration preserved separately. No account credentials are created without user action.
3. **Character entry:** users registering a new account are routed into the already implemented race/class/appearance creation screen. Existing accounts load their saved character directly, not a new duplicate character.
4. **Art direction:** original low-poly modular village kit: pitched overlapping roof rows, shingles, roof finials, wooden framing, lit windows, door hardware, chimney, lanterns, well, banner and fencing. These preserve the server's existing 3x3m building collision footprint.
5. **Material detail:** generated original low-resolution plaster, timber, stone and slate surface textures. No downloaded Warcraft textures.
6. **World palette:** foliage trees now use layered broad-canopy meshes rather than single pointed cones; warmer grassland palette, sun and fog.
7. **Character creation setting:** 3D rotatable character with faction-dependent architecture, lighting and floor; retains customized race, class outfit and appearance.
8. **Multiplayer return:** a stale-position bug during reconnect session takeover is corrected by rereading saved character position after the previous socket has been disconnected and persisted.
9. **Tests:** account store validation, account registration → custom character → reconnect → password-login WebSocket smoke, painted materials, fantasy cottage, gated entry screen.

## Explicitly not finished
These are **not yet** a full recreation of vanilla-era graphical richness. We still need original authored/rigged character GLBs, walk/run/cast/damage/death animation sets for all four races, cloth/hair rigging, full environment tile texture atlases, terrain normals and hand-authored biome transitions, winding roads, dense vegetation/bush/flower variants, water surfaces and rivers, sky/time/weather, settlement interiors, varied faction homelands/capital towns, unique props/creatures/NPC outfits, quest presentation art, sound and music, UI icons, screenshot-based visual QA and GPU/device profiling. The initial procedural art is a stepping stone for that production-quality asset pipeline.

## Android acceptance path
1. Install matching protocol v11 Android APK. Launch app: should show **REALMS UNWRITTEN**, server URL, **CREATE ACCOUNT**, **SIGN IN**, legacy guest and offline demo. The player must **not** be immediately controllable.
2. Start updated Bun server, enter a trusted local ws:// address (or production WSS URL), register a new username/password, choose faction/race/class and appearance, and enter the world.
3. Sign out via Multiplayer → OFFLINE, then sign back in with the same username/password. Same race, location, appearance and character inventory must return.
4. Create a second device session and test single-active-character handover and character persistence. Try a wrong password or duplicate username; no character should spawn.
5. Test OFFLINE DEMO and confirm it is visibly an unsaved demo, not an account.
6. Walk through Verdant Reach: verify pitched layered roofs, warm windows, painted surface grain, layered foliage, well/banner and updated color palette. Test Android GPU memory and FPS in both portrait and landscape.

## Quality targets for the next art pass
- Original race silhouettes recognizable at 15m, with expressive idle/walk/cast animations and class gear.
- At least 3 distinctive buildings per faction starter zone, 5 plant/tree variants per biome, 4 enemy archetypes, and hand-authored paths/landmarks.
- A real material atlas with controlled palette and UV consistency, LOD / instancing / texture compression; target at least stable 30 FPS on midrange Android with transparent performance reporting.
- Screen captures on a physical Android device at launch, character creation, Verdant Reach, and a second faction homeland, reviewed side by side with historical reference for **composition only**, not traced geometry.

## Security boundaries
This account implementation is for a controlled prototype. It lacks email verification, password recovery, 2FA, IP/device rate limiting, audit controls, account deletion, account migration of legacy guests, WSS termination and cloud backups. Never publish it as a production account service in this state. Plain ws:// transmits passwords without transport encryption; only test it over a trusted local environment. Deploy behind WSS and hardened network perimeter before accepting real user passwords.
