# Blender character build pipeline

The first two original character assets are authored by the repository's Blender Python script, not downloaded from a marketplace.

## Run locally
Blender 4.x recommended:

```bash
blender --background --factory-startup --python tools/blender/generate_characters.py -- --out build/assets
python3 tools/blender/validate_glb.py build/assets
```

## GitHub Actions
The **Build Blender Character Assets** workflow runs when the Blender scripts change or via Run workflow. It installs Blender in the GitHub-hosted Ubuntu runner, generates \`adventurer.glb\` and \`wolf.glb\`, verifies they contain a rig and expected clips, and publishes a ZIP artifact.

Both models are original low-poly *prototype* assets and use rigid bone-assigned skinning. They do not yet contain production painted textures, optimized skeletons, mesh LODs or polished motion. Expected clips: adventurer \`idle\`, \`walk\`, \`attack\`, \`dodge\`; wolf \`idle\`, \`walk\`, \`attack\`, \`death\`.

## Integration checklist
1. Download generated GLBs from Actions.
2. Verify their size/orientation/animations with Three.js GLTFLoader.
3. Add an asset loader with a procedural model fallback; don't remove existing models until integration tests pass.
4. Measure GPU skinning and runtime memory on a physical Android device.
5. Pin and review GLBs before bundling into the production APK.

The asset workflow is intentionally separate from Android APK CI so a Blender export regression does not interrupt the working mobile build.
