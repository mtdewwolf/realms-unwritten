# Moonleaf and Healing Tonics — Vertical Slice

Moonleaf is a new deterministic gatherable plant in meadow and woodland biomes. Plants are generated from versioned 128m cells and rendered with shared Three.js meshes in streamed terrain chunks. The server imports the same pure generator and checks the player's authoritative position before granting resources.

## Rules
- Gathering within 5m of a Moonleaf patch yields 1 Moonleaf, shared with a 45-second persisted SQLite depletion cooldown.
- Ore harvesting remains unchanged; GATHER automatically picks the nearest eligible ore or Moonleaf patch within range.
- Resource tracker highlights and navigates to whichever resource is closest.
- At the Verdant Reach crafting area, **2 Moonleaf → 1 Healing Tonic**.
- In BAG, **Use Healing Tonic** consumes one tonic and restores 30 health, capped at max health. The Bun server verifies the item, that the player is alive, and that healing is necessary. Clients cannot submit arbitrary healing totals.
- Tonic inventory is persisted. Player health itself still resets when reconnecting to the prototype server.

## Protocol
Version 8 adds a craft recipe ID \`healing-tonic\`, command \`{type:"use",item:"healing-tonic"}\`, and \`use_result\` response. New resource result packets may include resource-kind metadata.

## QA
Run \`bun run check\`, \`bun test\`, \`bun tools/smoke-server.ts\`, web build and Android CI. Confirm two guests cannot harvest the same node within 45 seconds; the second can gather after replenishment. Crafting must reject insufficient herbs or being outside the workshop. Tonic use at full health must preserve the tonic. When injured, one tonic restores up to 30 HP and decrements inventory once. Reconnect confirms materials and tonics remain.

## Limitations
One herb archetype and one potion; no profession skill system, cooldown animation, health-state persistence, crafting station visuals, live sync of resource states, or real-world device QA.
