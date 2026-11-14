# MMORPG Reference Standard — World of Warcraft 1.12.1

**Status:** Accepted design direction, not a claim that all systems below have been implemented.
**Baseline:** World of Warcraft 1.12.1, released September 26, 2006. Patch 1.12.0 (August 22, 2006) supplied the late-vanilla content framework; 1.12.1 itself was primarily a smaller update including mount/riding changes.

## Design rule

Study the *systems, relative pacing, constraints and interdependence* of vanilla-era MMORPG design, then create **original** Realms Unwritten mechanics, lore, maps, characters, items, names, artwork, UI skin, audio and quests. No copying WoW client binaries, databases, extracted models/textures, maps, quests, spell names/icons, dialogue or other protected assets. Vanilla WoW is a reference point, not a specification we reproduce byte-for-byte. Where historical data is uncertain, explicitly mark it for verification; never use modern WoW rules as an unlabelled substitute.

## Historical reference principles

1. **Character creation:** faction determines community/starting context; race has distinct visuals, narrative and modest traits; class controls resource pool, trainer path, combat identity and talent progression. Historical vanilla WoW: 2 factions, 8 races, 9 classes, with some race/class combinations disallowed.
2. **World:** hand-curated, geographically connected regions with conspicuous landmarks, distinct biomes, towns, roads, dangerous boundaries, level bands, quest chains, exploration incentives and meaningful travel time. Procedural techniques may *support* the curated framework but must not flatten it into undifferentiated terrain.
3. **Progression:** finite, meaningful levels; discrete ability unlocks; talent specialization with respec friction; gear as a significant source of strength; class trainers, consumables and travel milestones. WoW 1.12 had a level-60 cap and 51 talent points available from levels 10–60, three trees per class. Realms Unwritten currently caps at 50; changing that requires a separate progression migration/balance ADR.
4. **Combat:** readable enemy telegraphs, real positioning and ranges, distinct classes, casting and interruption, crowd control, defensive resources, damage types, enemy aggro/threat, party tank/heal/damage cooperation, encounter preparation and recovery downtime. Server owns outcomes.
5. **Quests:** natural NPC discovery, dialogue that explains local story, kill/collect/escort/explore objectives, follow-up chains, level-relative difficulty, deliberate rewards, faction reputation and dungeon breadcrumb quests. Original vanilla quest log limit was 20; use a deliberately bounded log if beneficial for mobile.
6. **Professions:** specialize in two primary trades and optional secondary skills; gather -> process -> craft -> trade. Recipes have skill requirements, material dependencies, trainer unlocks and world-specific sources. Avoid later-expansion professions in the historical baseline.
7. **Equipment and economy:** named item slots, armor and weapon types, item quality, meaningful stat rolls, binds, durability/repair, vendor values, money sinks, loot tables and trading. Balance inflation and transactions from the start.
8. **Social features:** persistent groups, guilds, party roles, nearby chat, friend/ignore tools, cooperative rewards, guild identity and shared goals. Moderation and abuse controls are prerequisites for public deployment.
9. **Faction conflict:** distinct safe homelands and contested frontier; territorial objectives, reputation and future organized PvP. The user wants a recognizable good/evil axis, but individual characters and internal factions should have nuance. Never require involuntary PvP in new-player zones.
10. **Dungeons and raids:** authored group encounters, clear entrance/instance boundary, progressively harder boss mechanics and coordinated roles. Reference the five-player dungeon/large-raid progression *principle* but start with small-group dungeons appropriate for a mobile prototype.
11. **Travel:** road and wilderness navigation, meaningful settlement hubs, discoverable routes, transport networks and later mounts. Avoid instant unlimited fast travel that erases geography.
12. **Exploration and rest:** discoveries, resources, rare spawns, subregions, inns and rested rewards. Historical rested XP boosted monster-kill gains, not quests; implementation should have a capped offline-accrual model if adopted.
13. **UI:** mobile-first interpretation of readable health/resource bars, enemy targeting, action bars, tooltips, minimap/map, bag, character pane, quest tracking, combat feedback and social windows. Do not clone WoW UI art or layout verbatim.
14. **Networking and persistence:** server-authoritative movement, combat, loot, identity, faction, quest and trade records; latency-aware movement; transaction-safe rewards; replay protection; privacy-conscious logging and scalable area-of-interest.
15. **Art direction:** readable silhouettes, strong race/faction identities, recognizable landmarks, atmospheric lighting and restrained stylization. This borrows the lesson of clarity at a distance without tracing Warcraft designs.

## Realms Unwritten adaptation: first content architecture

| Area | Vanilla design lesson | Original Realms Unwritten proposal | Current status |
| --- | --- | --- | --- |
| Factions | Two enduring sides with unique identity | Radiant Accord vs Umbral Dominion | Choice persists |
| Races | Character silhouette, origin, race limitations | Sunborne, Thornkin, Ashforged, Veilkin | Selection only, no distinct race meshes |
| Classes | Distinct tactical/resource identities | Vanguard (defense), Spellweaver (spellcasting), Shadeblade (mobility) | Choice persists; abilities not yet distinct |
| Starter regions | Race/faction homelands and initial narrative | Accord: Verdant Reach; Dominion: Ashen Verge (new) | Verdant Reach exists; Dominion region proposed |
| Mid-level territory | Shared contested regions and travel danger | The Shattered Marches (new) | Proposed |
| Class customization | Training and talent trees | Three original paths per class, unlock from level 10 | Proposed |
| Questing | Local narrative and chapter chains | Separate faction intros converging on a neutral frontier | One Wolf Hunt quest exists |
| NPC ecology | Multiple camps, patrols, rare enemies, elites | Regional family of enemies + one dungeon boss | One shared wolf exists |
| Professions | Two primary trades with recipes/trainers | Prospecting, Botany, Forging, Alchemy (original labels) | Raw ore/herb and two recipes exist |
| Equipment | Gear slots and readable loot rewards | Weapon, armor, accessories and bind/trade rules | One weapon slot exists |
| Social | Parties, guilds and role composition | Parties first, guilds later | Not implemented |
| Travel | Roads, hubs, routes, mounts | Discoverable caravan routes and later mounts | Roads/settlements exist; transport proposed |
| Conflict | Contested objectives and honor | Opt-in frontier objectives with protected starting regions | Not implemented |
| Dungeon progression | Group entry and bosses | First 3-player dungeon: Sunken Reliquary (working title) | Proposed |
| UI | Information density with accessibility | Android action deck, quest journal, class spellbook and social tabs | Unified menu exists |

### Foundational acceptance criteria

- Every race and class combination must be explicitly valid and server-validated; race, class, faction and appearance must survive reconnect/restart.
- Two faction introductions must differ visibly and narratively while converging into a shared multiplayer world.
- By the first 10 levels each playable class has at least two genuinely distinct abilities, a resource model, a trainer unlock and one meaningful specialization choice.
- Zone navigation must lead players through geographically coherent landmarks and danger progression, not just a random set of POIs.
- Every profession recipe includes a resource source, trainer/skill gate, output use and currency implications.
- Each quest must have objective verification, narrative context, repeat/claim rules, and persisted state.
- Server-side tests must reject forged XP, damage, position, items, quest completion, faction changes and purchases.
- On-device acceptance requires actual Android touch, performance, low-memory and network-interruption testing.

## Recommended sequence after the reference decision

1. **Character foundation (next):** Race silhouette/model variants, race/class availability matrix, class resource meters, first class abilities. Build a rotatable creator preview. Avoid adding 9 classes before 3 are distinct.
2. **Faction-based homelands:** Implement second starting region with faction-specific town architecture, NPC vendors/trainers and a short independent level-1-to-5 quest chain. Preserve existing saved-character placement and migration.
3. **Combat/creature ecology:** Multiple enemy families, aggro/threat, patrol/respawn, target selection, combat logging, threat and healing rules.
4. **Leveling and specialization:** Curated XP curve, training milestones, three specialization paths per class, equipment stat contributions, rest at inns.
5. **Professions/economy:** Trainer-backed skill progression, item quality/slots, shop, buy/sell transaction checks, repairs and gold sinks.
6. **Group content:** Parties, dungeon entrance and first small group instance, loot distribution and persistence/reconnect tests.
7. **World conflict and social:** Travel routes, reputation, faction-conflict objectives, social/chat moderation, guilds and optional PvP.
8. **Scale and polish:** Spatial indexing, telemetry, shard/zone design, mobile performance, art content, accessibility and security.

## Source ledger (research references)

- Patch 1.12.1 (September 26, 2006): https://warcraft.wiki.gg/wiki/Patch_1.12.1
- Patch 1.12.0 / Drums of War: https://warcraft.wiki.gg/wiki/Patch_1.12.0
- Original era character creation (historical Blizzard manual): https://us.media.blizzard.com/manuals/wow/wow-classic-manual-enUS.pdf
- Blizzard Classic primer (use for historically consistent race/class restrictions, **not** for later-system changes): https://news.blizzard.com/en-gb/article/23090134/wow-classic-primer-for-new-players
- Three-tree 1.12 talent reference: https://stonetavern.app/talents/
- Original quest log cap notes: https://warcraft.wiki.gg/wiki/Quest_log
- Profession overview (exclude later expansion additions): https://warcraft.wiki.gg/wiki/Profession
- Rest and historical rest context: https://warcraft.wiki.gg/wiki/Rest
- Threat system: https://warcraft.wiki.gg/wiki/Threat

### Reference interpretation

Patch notes are authoritative for what changed **in that patch**, not an exhaustive description of all mechanics that existed in the client. Modern wiki pages contain mechanics introduced after 2006; cross-check against historical manual, dated patch notes and 1.12-specific sources before labeling anything authentic to 1.12.1. Concrete Realms Unwritten names and system details above are **original design proposals**, not WoW source facts.
