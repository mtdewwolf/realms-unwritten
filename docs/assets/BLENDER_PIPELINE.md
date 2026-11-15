# Blender character pipeline

Original rigged GLBs are produced by the Python in `tools/blender/`. They are build outputs. None are committed, and a checkout without Blender runs on the procedural meshes.

The scripts that call `bpy` run inside Blender. `validate_glb.py` and `validate_races.py` are standard-library Python and can run with system `python3`. The workflows install Blender and `python3-numpy` with `apt-get`. This repo does not pin a Blender version; it uses the Ubuntu package those jobs install.

## Scripts

| Script | Writes |
| --- | --- |
| `generate_characters.py` | `adventurer.glb` with clips `idle`, `walk`, `attack`, `dodge`, and `wolf.glb` with `idle`, `walk`, `attack`, `death`. `--out` defaults to `build/assets`. |
| `generate_races.py` | An original `hero-<race>-<class>.glb` and a fitted `hero-<race>-<class>-female.glb` for each of the eight races and three classes (48 files). Clips are `idle`, `walk`, `attack`, `dodge`, `cast`, and `death`. `--out` defaults to `apps/client/public/assets`. |
| `render_lineup.py` | `lineup-radiant-accord.png` and `lineup-umbral-dominion.png` from already exported race GLBs. `--assets` defaults to `apps/client/public/assets`. `--out` defaults to `build/lineup-previews`. |
| `validate_glb.py <folder>` | Requires `adventurer.glb` and `wolf.glb` in that folder: glTF 2, at least one mesh, a skin, and the clips above. |
| `validate_races.py <folder>` | Requires all 24 `hero-*.glb` files and the six race clips. Prints `PASS 24 race/class rigs and required clips`. |

Races: `sunborne`, `thornkin`, `stonehearth`, `aetheri`, `ashforged`, `hornwarden`, `hollowborn`, `veilkin`. Classes: `vanguard`, `spellweaver`, `shadeblade`.

## What the client loads

- Heroes: `/assets/hero-<race>-<class>.glb` (`apps/client/src/characters/raceAsset.ts`). The procedural race stays visible until the GLB loads with all six clips.
- Wolf: `/assets/wolf.glb` (`apps/client/src/main.ts`), with the procedural wolf as fallback.
- `adventurer.glb` is still generated and checked by `validate_glb.py`. The player rig does not mount it.

Serve generated files from `apps/client/public/assets` so Vite exposes them at `/assets/`.

## Local generation

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

## GitHub Actions

**Build Blender Character Assets** (`.github/workflows/blender-assets.yml`) runs on `ubuntu-24.04` when `tools/blender/**` or the workflow file changes on `Master` or `main`, and from **Run workflow**. It generates and validates `adventurer.glb` and `wolf.glb` under `build/assets`, writes `SHA256SUMS`, and uploads `realms-unwritten-character-glbs` for 30 days. It does not generate the race GLBs.

**Android Debug APK** (`.github/workflows/android-debug-apk.yml`) compile-checks `generate_races.py` and `render_lineup.py`, runs both generators into `apps/client/public/assets`, validates them, renders the male and female faction lineup PNGs, and uploads those PNGs as `realms-unwritten-actual-race-lineups` (14 days) before the Vite build and the debug APK.

## Limits

The meshes are generated prototypes: rigid bone weights, simple materials, and no LOD chain. CI checks that the files exist and contain the named clips. It does not approve silhouette quality or Android frame time. See [eight-race lineup](../RACE_LINEUP_OVERHAUL.md) and [GLB integration](GLB_INTEGRATION.md).
