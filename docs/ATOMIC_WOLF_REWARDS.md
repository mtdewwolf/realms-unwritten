# Atomic Wolf Reward Settlement — Milestone 1.3

All server-created wolf kill rewards are now settled in **one SQLite transaction per contributor**. The reward coordinator invokes the existing idempotent inventory receipt, quest kill receipt and XP receipt inside a single outer transaction. If any grant fails, all effects of that event roll back (loot, coins, quest kills and XP). A duplicate event returns no additional rewards. The server commits the settlement before sending notifications, and disconnected contributors can still be settled when present in the authoritative contributor list.

## Guarantees
- Each (character, wolf-kill-event) gets one inventory reward receipt, and its XP grant is part of the same commit.
- Quest progress advances only when the quest was accepted, and in the same transaction as loot and XP.
- A conflicting XP receipt raises an error and rolls back inventory and quest mutations, instead of leaving partial rewards.
- No client-supplied reward events are accepted.

## Boundaries
This is not a full durable event/outbox architecture. A server crash after the transaction but before notification leaves the committed state recoverable from SQLite, but the client may not see the one-time reward toast. Future work: durable outbox and explicit replay acknowledgements; persistent combat health; robust shutdown recovery; command idempotency for consumables and crafting; integration fault injection.

## Verification
Run bun run check, bun test, live WebSocket smoke test, and Android CI. Tests cover duplicate rewards, multiple contributors, rollback on conflicting XP receipts, unknown characters, and quest-absent kills.
