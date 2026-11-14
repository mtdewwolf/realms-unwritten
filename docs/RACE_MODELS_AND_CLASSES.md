# Race Models, Customization and Class Abilities — Vertical Slice

## Original art and character creation
Four procedural Three.js character silhouettes replace the generic avatar for online and offline fallback; they are not ripped Warcraft assets. Sunborne have an upright crest and luminous details; Thornkin have branching antlers and leaf-shaped ears; Ashforged have heavy plated shoulders and horns; Veilkin have extended ears and a luminous glyph. Each class also has specific gear: Vanguard (shield and sword), Spellweaver (staff and arcane focus), Shadeblade (paired blades).

The creator uses a real Three.js renderer with drag-to-rotate and rotation buttons. Body build, skin tone, hairstyle, hair color and face markings are visually reflected and validated by Bun. Appearance is stored as JSON in a migrated character_identities table, with strict index validation and defaults for legacy identities. This is a first low-poly visual language, not final rigged race animation assets.

On reconnect the chosen avatar is rebuilt. Server snapshots carry known nearby characters' identity, so nearby avatars display the right race/class appearance. The generic old adventurer GLB no longer masks the character identity; the wolf GLB remains enabled.

## Class starter abilities (protocol v10)
| Class | Ability | Effect | Stamina | Cooldown |
| --- | --- | --- | ---: | ---: |
| Vanguard | Bulwark | Halve incoming wolf bite damage for 4 sec | 22 | 14 sec |
| Spellweaver | Arc Bolt | 28 server-owned damage, 9m range | 30 | 9 sec |
| Shadeblade | Quickstrike | 34 server-owned melee damage, 3.25m range | 25 | 7 sec |

Bun determines the class from persistent SQLite identity, never the ability packet. All abilities require a living character, monotonic action sequence, enough stamina, cooldown readiness and a valid target where applicable. Ability damage uses the existing wolf defeat-and-reward pipeline. The client displays cooldowns but cannot set server damage, duration or resource values.

## QA / acceptance
- Build for Android and run Bun tests, multiplayer smoke, web compilation.
- Create one of each race and class. Change all appearance options, rotate preview, reconnect and confirm persistent visuals and HERO identity.
- Join two clients with different races; confirm distinct race and class outfits across the network.
- Trigger all three abilities and attempt forged off-class abilities and excessive damage values; server must reject or ignore attacks.
- Verify Bulwark reduces 12 bite to 6, Arc Bolt has nine-meter range, and Quickstrike requires melee distance.
- Verify cooldown recovery, stamina costs, death events, reward idempotency and action-sequence replay defenses.
- Test Android landscape/portrait performance and GPU memory; the current preview has an additional WebGL context.
- Test a database created before the appearance column existed.

## Scope limits
The class system does not yet include per-class mana/energy/rage bars, multiple spells, talent trees, class trainers or class-restricted equipment. Race animations are procedural and not final authored rigs. Multiplayer appearance metadata is currently read from SQLite when assembling snapshots; spatial-scale caching is a follow-up. This milestone deliberately prioritizes tangible character identity rather than reproducing every WoW 1.12.1 class mechanic.
