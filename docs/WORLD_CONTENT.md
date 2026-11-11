# Discoverable World Content — Prototype v1

This iteration places deterministic world landmarks into independently streamed chunks.

## Current content
- Forgotten Watchtower: stone ruin and amber landmark beacon.
- Ironstone Outcrop: clustered metallic-looking rocks.
- Wolf Territory: a small earthen den with stylized entrance.
- Deterministic positions based on 256 m world regions, independent of which terrain chunks happen to be loaded.
- Discovery HUD shows nearby location and count; on-device discoveries are stored locally under a versioned key.

These are **exploration markers**, not fully simulated quests/mines/wolf spawners. No harvesting, combat spawn, ownership or trading authority is implied.

## Technical notes
- The POI algorithm has no server dependency yet and currently uses fixed v1 seeds.
- Chunk renderer builds one POI in the owning 64 m chunk, with no duplicate at boundaries.
- Native GLB models can replace these shapes later without changing landmark IDs.
- Model geometry is freed on chunk unload, but reusable shared materials are kept.
- Discovery uses browser localStorage; it is not shared across devices or accounts and is not secure progression data.
- Once multiplayer launches, the Bun server must become the source of truth for discovered POIs, mineral depletion, territory encounter spawns and rewards.

## Next steps
World atlas and map markers, navigation trails, terrain-safe building placement, meaningful quest hubs and networked resource nodes. Maintain mobile frame-time budgets by streaming only nearby POIs.
