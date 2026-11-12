# Authoritative Combat — Wolf Vertical Slice v1

## Implemented

- Protocol v2 requires current client and server builds; old protocol v1 clients are rejected.
- Bun owns one shared starter wolf at (5,5). Its HP (60), movement/chase, 0.85-second bite telegraph, 12-damage bite, death and eight-second respawn are governed by the server's 20Hz simulation.
- Players have server-owned 100 health, 100 stamina, 18 stamina/second regeneration, 16-stamina attack (20 damage, 3.25-meter range, 0.65-second cooldown) and 26-stamina dodge (0.6-second window).
- The client sends only `{type:"action",seq,action:"attack",target:"starter-wolf-v1"}` and `{type:"action",seq,action:"dodge"}`, never damage or target health.
- The server validates action type, monotonically increasing action sequence, cooldown, stamina, player alive status and authoritative distance.
- Every relevant client receives the *same* wolf HP and phase through nearby snapshots. Each client receives its own health/stamina.
- Android HUD and wolf model use authoritative snapshots when connected. Local prototype wolf AI/combat remains offline-only.

## Deliberate limitations

- This milestone uses one shared test wolf, not region-based wildlife spawning.
- Player health/stamina and wolf state are not saved across server restart; guest positions remain SQLite-persisted.
- A defeated player's character respawns near Verdant Reach after five seconds.
- Dodge grants server-side invulnerability, **not** a server-side dash movement.
- No loot, XP, quest rewards, combat log attribution, pathfinding, collision, obstacle blocking or secure account login.
- Combat actions are not yet spatial-indexed; simulation uses one Bun process. For production, add server-side terrain/collision checks and anti-cheat monitoring.

## Tests

```bash
bun run check
bun test test/server-combat.test.ts
bun tools/smoke-server.ts
bun test
```

For hands-on two-device testing, connect two different guests, stand within the wolf's attack range, and attack from both. Their wolf HP must match; cooldown spam, distant hits, defeat, dodge and respawn must remain consistent.
