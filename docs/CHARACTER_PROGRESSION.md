# Persistent Character Progression — v1

Bun is authoritative for XP and levels. A shared wolf kill grants **15 XP** to each connected contributing attacker; the one-time Verdant Reach Wolf Hunt turn-in grants **75 XP**. No client packet can request XP or modify attributes.

## Rules
- New characters begin at level 1 with 0 XP.
- Total XP required to reach level L is 50 × (L−1) × L (level 2 at 100 XP, level 3 at 300 XP).
- Maximum level 50. XP remains capped at 2 billion.
- Derived display attributes: Strength = 5 + 2 × (level−1); Vitality = 5 + (level−1); Agility = 5 + floor((level−1)/2).
- **Attributes are informational in this phase**; combat damage, max health, stamina and movement speed are not yet scaled with them.
- The server's character_progression table stores total XP; progression_receipts keeps per-character event IDs to make each kill or quest reward idempotent.
- Quest completion and its XP grant run in the same SQLite transaction; duplicate quest claims are rejected.
- Protocol version 5. Client and server must be updated together.

## Android
A HERO button opens the character panel showing level, total XP, progress to next level and derived attributes. The server sends progression on login and after rewards. Offline mode displays the unavailable state; no local XP is fabricated.

## QA
Run bun run check, bun test, bun tools/smoke-server.ts and the Android CI pipeline. Verify the starter character has level 1 / 0 XP, a qualified wolf kill adds 15 XP, completing Wolf Hunt after three qualifying kills adds 75 more, and total 120 XP reaches level 2. Disconnect/reconnect and restart Bun without deleting SQLite: XP must remain. Replayed reward events must not duplicate XP.

## Future work
Server-side application of attributes to combat math, character classes, experience balancing, equipment-derived modifiers, talent points, and secure accounts.
