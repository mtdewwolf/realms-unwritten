# Race Models, Customization and Class Abilities — Vertical Slice

## Original art and character creation
Four procedural Three.js character silhouettes replace the generic avatar for online and offline fallback; they are not ripped Warcraft assets. Sunborne have an upright crest and luminous details; Thornkin have branching antlers and leaf-shaped ears; Ashforged have heavy plated shoulders and horns; Veilkin have extended ears and a luminous glyph. Each class also has specific gear: Vanguard (shield and sword), Spellweaver (staff and arcane focus), Shadeblade (paired blades).

The creator uses a real Three.js renderer with drag-to-rotate and rotation buttons. Body build, skin tone, hairstyle, hair color and face markings are visually reflected and validated by Bun. Appearance is stored as JSON in a migrated character_identities table, with strict index validation and defaults for legacy identities. This is a first low-poly visual language, not final rigged race animation assets.

On reconnect the chosen avatar is rebuilt. Server snapshots carry known nearby characters' identity, so nearby avatars display the right race/class appearance. The generic old adventurer GLB no longer masks the character identity; the wolf GLB remains enabled.

## Class abilities (protocol v12)

Spellweaver is ranged magical damage and support. Shadeblade is agile melee and scouting. Vanguard remains the frontline defender. Each ability has its own cooldown. The touch ability bar shows the saved class's kit, with a cooldown count on each button. Keys 1–4 cast the same slots when no text field is focused.

| Class | Ability | Effect | Stamina | Cooldown |
| --- | --- | --- | ---: | ---: |
| Vanguard | Bulwark | Halve incoming wolf bite damage for 4 sec | 22 | 14 sec |
| Spellweaver | Arc Bolt | 28 damage to the wolf, 9m range | 30 | 9 sec |
| Spellweaver | Starfall | 18 damage if the wolf is within 6.5m of the caster | 34 | 12 sec |
| Spellweaver | Mend | Restore 22 health to the most injured ally within 10m, or to the caster | 26 | 11 sec |
| Spellweaver | Aether Ward | Reduce wolf bites by 4 for 3 sec. Prefers an injured ally within 10m. Bulwark overrides it | 20 | 13 sec |
| Shadeblade | Quickstrike | 34 melee damage, 3.25m range | 25 | 7 sec |
| Shadeblade | Shadowstep | Server dash to 2.2m from a wolf within 8m, then 18 damage. Blocked paths are rejected | 28 | 10 sec |
| Shadeblade | Veil | Wolf ignores the caster for 4 sec. Attack, Quickstrike, and Shadowstep break it | 18 | 16 sec |
| Shadeblade | Keen Senses | Report the wolf within 28m and the number of living allies within 24m. No damage | 14 | 8 sec |

Bun determines the class from persistent SQLite identity, never the ability packet. All abilities require a living character, a monotonic action sequence, enough stamina, and that ability's own cooldown. Damage, healing, duration, and Shadowstep's landing are taken from `apps/shared/src/classAbilities.ts` on the server. A client field named `damage`, `heal`, `position`, or `cooldown` is ignored. Mend and Aether Ward may name an ally id; the server still checks that the ally is alive and in range. Omitting the id mends the most injured person in range, and wards an injured ally or else the caster. Ability damage uses the existing wolf defeat-and-reward pipeline. Effects on the client are one short mesh each and are capped at 16.

## QA / acceptance
- Build for Android and run Bun tests, multiplayer smoke, web compilation.
- Create one of each race and class. Change all appearance options, rotate preview, reconnect and confirm persistent visuals and HERO identity.
- Join two clients with different races; confirm distinct race and class outfits across the network.
- Trigger every ability on the bar and attempt forged off-class abilities and excessive damage or heal values; the server must reject or ignore them.
- Verify Bulwark reduces a 12 bite to 6, Aether Ward reduces it to 8, Arc Bolt stops at 9 meters, Starfall stops at 6.5 meters, and Quickstrike and Shadowstep require the documented distances.
- Verify Mend will not heal a healthy party, Shadowstep will not spend stamina when the path is blocked, and Veil stops the wolf from biting until it expires or the Shadeblade attacks.
- Verify cooldown recovery, stamina costs, death events, reward idempotency and action-sequence replay defenses.
- Test Android landscape/portrait performance and GPU memory; the current preview has an additional WebGL context.
- Test a database created before the appearance column existed.

## Scope limits
The class system does not yet include per-class mana/energy/rage bars, talent trees, class trainers, or class-restricted equipment. Spellweaver and Shadeblade now have four-ability starter kits, and Vanguard still has Bulwark. Race animations are procedural and not final authored rigs. Multiplayer appearance metadata is currently read from SQLite when assembling snapshots; spatial-scale caching is a follow-up. This milestone deliberately prioritizes tangible character identity rather than reproducing every WoW 1.12.1 class mechanic.
