# Verdant Reach — Wolf Hunt Quest

The first persistent NPC quest is available from the low-poly guard at **(x: 2, z: -3)** in Verdant Reach. On an online client, use the QUEST button near the guard to accept **Wolf Hunt**.

## Rules
- Quest ID: `verdant-wolf-hunt` (one-time starter quest).
- Accept within 6m of the guard; only living players may interact.
- Defeat the shared starter wolf **three separate times**. Each wolf kill credits a character only if they dealt successful damage to that wolf during its current life *and* accepted the quest before the kill.
- Quest progress updates in Bun-owned SQLite, with unique per-kill receipts and a maximum of 3.
- Return to the guard and turn in the quest to receive **25 coins**, added atomically to the existing server wallet.
- A quest can be completed only once. Duplicate/replayed turn-ins cannot mint extra currency.
- Quest status is sent on login, upon credit, on status request, and after accept/turn-in.
- Protocol **v4**. An older Android APK (v3) cannot connect to this updated server.

## Testing

Run:
```bash
bun run check
bun test
bun tools/smoke-server.ts
bun run build
```

On two real devices, have both accept, collaborate on each of three wolf defeats, return to the guard, and claim rewards. Verify both see accurate independent progress and wallets. Reconnect and gracefully restart Bun between kills to confirm progress survives. A player who only stands nearby should not receive quest credit. Requests to accept/turn-in while distant must be rejected by Bun.

## Remaining gaps
This is one static guard blockout and one simple quest. No dynamic dialogue tree, multi-quest log, branching narrative, XP system, factions, automatic pathfinding or account auth. The client displays quest state from the server; no offline quest progression is merged into SQLite.
