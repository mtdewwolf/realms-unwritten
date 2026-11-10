# Realms Unwritten — Android Asset Production Plan v1

## North star
Original stylized 3D fantasy, readable on a 6-inch Android screen from a 40–70° downward camera. Strong silhouettes and purposeful landmarks instead of photorealism or visually noisy detail. The current procedural objects are *blockout assets*, not final shipped art.

## Initial deliverables and order
| Sprint | Deliverables | Acceptance criteria |
|---|---|---|
| A — Art direction | Color palette, 1-page lighting guide, 3 screenshot compositions, hero/architecture silhouette sheet | Readable at 720p landscape, visual identity distinct from existing games |
| B — Verdant Reach environment | 3 trees, 3 rocks, 4 ground textures, shrubs/flowers, signposts, crates | Shared meshes and materials, 3 distance LODs for hero props |
| C — Village kit | Cottage, market stall, forge, sawmill, fence, 2 roads, foundation/under-construction states | Grid-aligned modular footprints, stable pivots and collision proxies |
| D — Characters | Adventurer base rig, 2 outfit sets, sword/shield, wolf rig | Idle/walk/run/attack/hit/dodge/death animation clips; clear telegraphs |
| E — UI/VFX/audio | Ability icons, status bars, placement rings, hit VFX, sword/footstep/crafting cues | Thumb-size controls, legible HUD, short and limited particle lifetimes |

## Production file layout
- `assets/source/`: Blender .blend, layered textures and authored source (large binaries use Git LFS or object storage).
- `assets/export/`: exported `.glb` and `.ktx2` assets delivered to the client, grouped into small install-time or streamable bundles.
- `apps/client/public/assets/`: curated, versioned runtime output only.
- `apps/client/src/assets/catalog.ts`: stable IDs and budget metadata; validate in CI.
- `docs/assets/`: concepts, references, licenses, naming rules, export checklist.

## Conventions
- Y-up, meters, +Z forward for humanoid models. Ground pivots on (0,0,0); consistent scale.
- Names: `category/name-variant_LOD0.glb` and `name-color.ktx2`. Never rename stable gameplay IDs.
- Prefer one shared material family for village props; avoid unique shaders for every mesh.
- Create 3 LODs for large structures and characters as profiling demands; impostors for very distant vegetation.
- Separate render meshes from simplified collision proxies; never trust art meshes for server building validity.
- Bake AO where useful; limit alpha-blended foliage. Keep accessible silhouettes for touch targeting.

## Android provisional art budgets (per asset)
| Asset | LOD0 triangle ceiling | Main texture |
|---|---:|---:|
| Adventurer | 7,500 | 1024 px |
| Wolf | 4,500 | 1024 px |
| Cottage | 3,000 | 1024 px |
| Market stall | 1,000 | 512 px |
| Tree | 500 | 512 px |
| Rock cluster | 400 | 512 px |
| Small prop | 250–450 | 256–512 px |

These are planning ceilings, not measured device budgets. Target 30 FPS on midrange Android first. Record real-device frame times, memory, draw calls, skinning and texture budgets before locking production limits.

## Export pipeline
Blender → validate scale/pivots/material slots → glTF/GLB → geometry compression (Meshopt or Draco, with compatible loaders) → KTX2/Basis textures → glTF validation → per-asset budget check → manifest/hash → Android load test.
Use glTF/GLB for mesh, skeleton, and animation; KTX2 for GPU texture variants. Keep source files editable and track asset provenance and licenses. Procedural art in the current client is authored in code and needs no third-party asset license.

## Asset acceptance checklist
1. Original design, rights recorded, approved silhouette and palette.
2. GLB loads in the game, correctly scaled and oriented.
3. Rigged animations work without root-motion disagreement with server movement.
4. Material count, triangle count, size and texture bounds inspected.
5. Cheap collider provided for interaction/building; LOD switch does not affect gameplay.
6. Verified on midrange Android in a crowded village, not only a desktop screenshot.

## Concrete next implementation
Replace procedural wolf/avatar placeholders with the first internally authored GLBs while preserving combat state and collision data. Add a deterministic asset loader with fallback proxies and explicit download/error telemetry. Establish screenshots from the actual running APK in CI/emulator or a physical device.
