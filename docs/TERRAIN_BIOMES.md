# Terrain Elevation and Biomes — Android iteration

- Added deterministic continuous value noise sampled in **global coordinates**, not chunk-local noise.
- Three early biome palettes: meadow, woodland, highlands; broad climate field changes slowly over hundreds of meters.
- A 64-meter chunk uses a 17×17 vertex grid (4-meter spacing), with 512 triangles and per-vertex coloring.
- A **matching triangle-interpolated ground sampler** provides player elevation so visual mesh height and movement agree.
- Starter village within 24 m stays flat, transitioning smoothly to rolling terrain over the next 58 m.
- Trees and rocks are height-positioned; individual streamed chunk geometry is disposed on eviction. Shared instanced geometry/materials persist.
- Landscape currently has no water, cliffs, biome gameplay rules, server authority, terrain editing, or collision with large props.
- Large persistent MMO still needs region-based servers, persistence, interest management and dynamic content. This milestone improves the **visual world**, not network scalability.

## QA
Move from the starting village and walk across several chunks in each direction. Check terrain seam continuity, height-following, foliage alignment, memory stability and 30 FPS target on a real Android phone. In this prototype the wolf starts on flat village ground.
