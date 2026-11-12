# Gathering and Crafting — Vertical Slice v1

## Gameplay
The existing Ironstone Outcrop POIs are now resource nodes. Standing within five meters of a generated ore landmark and pressing GATHER while online requests one Iron Ore. The Bun server verifies the player position and alive state; coordinates in a client packet are ignored. Each node supplies one ore, then enters a **shared 30-second cooldown** recorded in SQLite. Other players cannot double-harvest a depleted node, and its cooldown survives a server restart.

In the Verdant Reach starting village, beside the guard (within six meters), open BAG. The first recipe crafts **Ironblade** by consuming **two Iron Ore and one Wolf Fang**. A SQLite transaction checks material quantities, removes resources and creates one Ironblade. Insufficient materials, unknown recipes, dead characters, or characters outside the village workshop are rejected. Equip the blade in BAG for **+12 weapon damage** (compared with +8 Fangblade).

## Technical scope
- Authoritative Bun resource service: apps/server/src/resources.ts
- Inventory crafting transaction and gear slot: apps/server/src/inventory.ts
- Deterministic landmark locations reused from the same pure client landmark generator
- WebSocket protocol v7: gather, craft, resource_result, inventory
- No client-supplied positions, materials or craft quantities are trusted
- Resource availability stored globally in the existing SQLite DB; items stored per character
- Offline exploration continues, but gathering and crafting require the server

## Tests
Run bun run check; bun test; bun tools/smoke-server.ts; bun run build; compile Android APK. Verify two players at the same ore cannot both harvest within the 30-second window, gathering while distant is rejected, a fresh inventory cannot craft, crafting consumes exactly two ore and one fang, and equipped weapon persists across server restarts. On Android, physically test GATHER and BAG on a phone.

## Outstanding
No mining animation/tool, resource highlighting, time synchronization in map UI, recipe progression, crafting professions, equipment visuals, world economy or scalable resource partitioning. Server currently stores nodes in single SQLite database. Combat and movement collision are still prototype level.
