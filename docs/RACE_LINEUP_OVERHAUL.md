# Eight-race lineup overhaul

## Design goal
The prior characters had nearly identical body proportions, cube torsos, featureless heads, and minimal costume distinction. They did not visually meet the user's classic fantasy MMORPG character-lineup reference.

The previously generated illustration is **visual concept art only**, NOT a model or a screenshot from the game. All implemented designs are original Realms Unwritten IP and avoid copied Warcraft meshes, textures, lore, characters, or symbols.

## Playable factions and race designs

| Radiant Accord | Character silhouette |
| --- | --- |
| Sunborne | Tall citadel knight, gold crest, broad armor and strong jaw |
| Thornkin | Lean forest wanderer, branching antlers, leaf mantle, long ears |
| Stonehearth | Compact mountain engineer with substantial beard, goggles and riveted gear |
| Aetheri | Tall arcane scholar, jeweled circlet, sweeping ears and elaborate robes |

| Umbral Dominion | Character silhouette |
| --- | --- |
| Ashforged | Broad green-skinned forge warrior, tusks and spiked heavy armor |
| Hornwarden | Towering horned nomad with broad muzzle, ancestral totems and fur |
| Hollowborn | Gaunt blight survivor with pallid skin, torn garments and potion vials |
| Veilkin | Violet mystic, long ears, luminous eyes and shadow attire |

## Implementation
- Eight races and three classes produce 24 original rigged GLBs with idle, walk, attack, dodge, cast and death clips.
- Blender generates distinct face forms, eyes, brows, noses, jaws, accessories, hair pieces, weapon loadouts and proportions for every race.
- SQLite identity constraints migrate transactionally without resetting previous characters or appearance.
- The Android creator presents four 3D models per faction with tap-to-select and a larger individual preview.
- Local and remote world avatars use the same saved race and class model IDs, with a procedural fallback if loading fails.
- Bun remains authoritative for faction/race validity and class actions; the art changes grant no unauthorised gameplay effects.

## Acceptance
1. Run Bun checks, unit tests and WebSocket integration tests.
2. Export all 24 Blender GLBs and verify six animations and armature in every file.
3. Compile and upload the Android debug APK.
4. On physical Android, verify each of eight silhouettes, compare face/gear fidelity with the approved concept, and validate appearance persistence.
5. Profile GPU memory, two preview WebGL surfaces, loading times, and frame rate on midrange devices.

## Not finished
Generated procedural models are **not** hand-sculpted or artist-approved finished character assets. High-quality facial rigging, cloth deformation, hand-painted texture atlases, armor progression variants, professional animations, polished lighting and mobile screenshot review are still outstanding. The concept image should not be presented as proof of their in-game visual quality.
