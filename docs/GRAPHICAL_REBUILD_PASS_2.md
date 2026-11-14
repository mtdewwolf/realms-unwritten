# Realms Unwritten — Graphical Rebuild, Pass 2

**Status:** Implemented and submitted to CI; production visual-quality acceptance remains open until physical Android captures and profiling.

## Reference and original-IP boundary

Design benchmark: the legible silhouettes, hand-painted material language, readable town architecture, and geographically distinct faction homelands of **World of Warcraft 1.12.1 (2006)**. All source code, models, meshes, palettes, materials, factions, names, clips and artwork here are original Realms Unwritten creations. No extracted Blizzard client assets, textures, map placements, audio, icons, UI artwork, character likenesses or copyrighted lore.

## Asset matrix

The Blender pipeline creates every combination below in apps/client/public/assets/ during CI:

| Race | Vanguard | Spellweaver | Shadeblade |
| --- | --- | --- | --- |
| Sunborne | hero-sunborne-vanguard.glb | hero-sunborne-spellweaver.glb | hero-sunborne-shadeblade.glb |
| Thornkin | hero-thornkin-vanguard.glb | hero-thornkin-spellweaver.glb | hero-thornkin-shadeblade.glb |
| Ashforged | hero-ashforged-vanguard.glb | hero-ashforged-spellweaver.glb | hero-ashforged-shadeblade.glb |
| Veilkin | hero-veilkin-vanguard.glb | hero-veilkin-spellweaver.glb | hero-veilkin-shadeblade.glb |

Every file includes a skeleton and clips: idle, walk, attack, dodge, cast, death. Blender source: tools/blender/generate_races.py. GLB structural verification: tools/blender/validate_races.py. The original wolf animation pack remains separately generated and validated.

### Runtime model selection and appearance

- apps/client/src/characters/raceAsset.ts caches downloaded templates and uses SkeletonUtils.clone for independent skeleton pose/animation state between multiplayer characters.
- Each avatar clones its appearance materials: race skin-tone palette, hair color, lean/sturdy frame, hair style and markings. No other player's selection mutates the shared source template.
- The generic adventurer GLB remains a legacy build artifact but **is not used to override race-specific player models**. The procedural model is displayed while streaming and as a fallback after asset failure.
- The character creator also upgrades from procedural preview to the selected rigged GLB when it becomes available.
- The client uses a 30 FPS-capable render path but **actual Android FPS has not been measured**; do not confuse CI green status with on-device quality.

### Regional assets and atmosphere

- Two original faction enclaves near the common starter town: Accord Watch with warm stone and teal banners, and Dominion Spire with dark masonry, violet accents and sharp rooftop forms.
- Buildings match shared Bun+Android collision in collision.ts. Decorative towers, flags and arches intentionally remain without physical collision.
- A single-draw-call shader sky creates daytime/dusk/night gradients and low-cost wispy cloud patterns; sun direction, light intensity and fog change together.
- A transparent circular contact shadow anchors the avatar without enabling costly shadow-map rendering.
- Previously completed passes provide stone/timber/plaster/slate paint-like material textures, original cottages, ground texture, and six instanced vegetation archetypes by biome.

## Build and QA

1. bun install; bun run check; bun test.
2. blender --background --factory-startup --python-exit-code 1 --python tools/blender/generate_characters.py -- --out apps/client/public/assets
3. blender --background --factory-startup --python-exit-code 1 --python tools/blender/generate_races.py -- --out apps/client/public/assets
4. python3 tools/blender/validate_glb.py apps/client/public/assets
5. python3 tools/blender/validate_races.py apps/client/public/assets
6. bun tools/smoke-server.ts; bun run build; capacitor sync and Gradle assembleDebug (GitHub Actions).
7. On physical Android, capture title, account entry, character creator (all four races and three classes), Verdant Reach, Accord Watch and Dominion Spire. Verify custom skin/hair/marking choices persist across reconnect.
8. Verify nearby players show independent walk animations and class gear; check memory after repeated character preview updates.
9. Profile at least a midrange Android device for FPS, memory, battery drain and shader compilation; measure cost of all 12 GLBs and fallback frequency.

## Not done — no production quality claim

The work is **not a complete AAA/MMORPG graphical overhaul**. Unfinished: hand-sculpted faces, advanced shading/normal maps, original faction-specific major cities and multiple level-gated zones, finished animation blending for every combat state, 3D class spell VFX, facial expressions, armor sets/gear deformation, original creature families, dungeons, water/bridges/weather, comprehensive UI icons, sound/music, multiple distance LODs, GPU texture compression, real mobile visual tests and full accessibility. The two enclaves are **visual outposts**, not separate functional faction quest hubs. Do not describe these unfinished systems as implemented.

Next art-production work should be driven by screenshots and explicit mobile acceptance metrics rather than by source-code feature counts.
