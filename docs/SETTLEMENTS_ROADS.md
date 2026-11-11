# First Settlement and Road Network

The 16.384km square is now overlaid with **deterministic 512m road corridors**. A road corridor extends along each global X/Z grid line; rendered road ribbons stream with the same 64m terrain chunks as the rest of the world. This is a simple rectangular prototype network rather than a terrain-slope-aware road-routing algorithm.

Some grid intersections host a hamlet or outpost selected from a stable hash and local biome. The starter village stays at the origin. New settlements consist of original, procedural low-poly cottages and a tall beacon; this is visual placement, not a fully authored town with NPCs, shops or services.

The world map reveals settlements when a player visits them and draws settlement markers for known locations. The nearest settlement can be identified while navigating. Discovery remains client-local, and the Bun world server still needs ownership and persistent entity state.

## Constraints and next steps
- Roads are 4m-wide ribbon meshes following the sampled terrain. They may clip slightly on slopes; test and add slope-aware smoothing.
- Geometry created for roads and buildings is disposed as chunks unload; shared materials persist.
- Player-facing navigation should eventually follow a graph of roads and bridges instead of straight-line compass guidance.
- Introduce real settlements with NPCs, crafting, economics, and quests after the server simulation is integrated.
- Avoid claiming every 512m crossing is a settlement; only a deterministic subset is occupied.
