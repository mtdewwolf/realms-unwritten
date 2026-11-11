# Rigged GLB Integration

The original adventurer and wolf GLBs are generated during Android CI by Blender 4.x using `tools/blender/generate_characters.py`. The source of truth is the generator, not binary files stored in Git. They are copied to `apps/client/public/assets/` before Vite builds the APK so `/assets/adventurer.glb` and `/assets/wolf.glb` are bundled in the webview.

At runtime `mountAnimatedAsset` loads both via Three.js GLTFLoader and plays clips with AnimationMixer. The simulation transforms remain on stable parent groups; loading only replaces their visual children. If download or animation validation fails the old procedural models remain visible.

Game states: adventurer idle / walk / attack / dodge; wolf idle / walk / attack / death. These clips are prototype hard-keyed animation; they are not polished character motion. Local combat remains client-only. Verify foot alignment, orientations and FPS on a physical Android device.

For local development:
```bash
sudo apt-get install blender python3-numpy
bun install
mkdir -p apps/client/public/assets
blender --background --factory-startup --python-exit-code 1 --python tools/blender/generate_characters.py -- --out apps/client/public/assets
python3 tools/blender/validate_glb.py apps/client/public/assets
bun run dev:client
```

The Android CI workflow installs Blender and generates the assets before `bun run build`. The separate Blender workflow remains available to obtain individual GLBs. This adds several minutes to fresh APK builds; switch to cached immutable artifact hashes when finalized.
