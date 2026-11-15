# Character Creation — Factions and Classes v1

Inspired by the design pattern of rival factions in classic faction-based MMORPGs, without copying their factions, species, character art, or lore.

## Playable factions
**The Radiant Accord** (nominally good) protects settlements and living ecosystems. Races: **Sunborne** (sunlit citadel guardians) and **Thornkin** (grove-bound defenders).
**The Umbral Dominion** (nominally evil) pursues power through forbidden knowledge and conquest. Races: **Ashforged** (volcanic smith-clans) and **Veilkin** (shadow-adapted scholars). Members of either faction can be moral or immoral as individuals.

## Starting classes
- **Vanguard:** armored frontline warrior. Starter kit: Bulwark.
- **Spellweaver:** ranged magical damage and support. Starter kit: Arc Bolt, Starfall, Mend, and Aether Ward.
- **Shadeblade:** agile melee and scouting. Starter kit: Quickstrike, Shadowstep, Veil, and Keen Senses.

The starter kits are enforced by the realm server. See [Race models and class abilities](RACE_MODELS_AND_CLASSES.md) for costs, ranges, and cooldowns. **Mana, talent trees, equipment restrictions, faction territories, racial passives, and faction PvP are still future work.**

## Server architecture
- New guests connecting without a token receive \`creation_required\`, not a created character.
- \`create_character\` includes a validated name, faction, race, and class; a single SQLite transaction inserts both the guest character and immutable identity, then the welcome gives back the generated bearer token.
- Faction/race mismatch and invalid strings are rejected. No movement, combat, quests, or inventory access until the character is accepted.
- Existing valid guest tokens resume without a creation screen. Legacy characters missing identity rows receive **Radiant Accord / Sunborne / Vanguard** without losing any XP, items, quests, or position.
- Each guest token maps to one existing character. Multi-character accounts, editing identity, renaming, deletion, and production authentication are out of scope.
- Protocol v9 adds \`creation_required\`, \`creation_result\` on invalid selection, \`create_character\`, and \`welcome.character\`. Both server and Android client must be updated.

## QA
Run Bun typecheck, unit tests, live WebSocket smoke, web build and Android APK. Test all four race choices, three classes, faction/race validation, name validation, persistent login, multiple separate guests, and the existing guest migration path. Test the creator in portrait and landscape and with the Android soft keyboard. Test multiplayer/quest access cannot bypass creation.

## Next slices
Class talent trees and balance passes beyond the starter kits; faction settlement spawns, NPC dialogue and quests; character selection for multiple heroes per account; persistence and identity security hardening.
