# Android character animation and combat — local gameplay slice

## What this version provides
Original procedural stylized adventurer: torso, head, tunic, boots, separate animated arm and leg pivots, sword, shield. A new wolf rig and visible bite telegraph. The local encounter supports sword damage, dodge stamina costs, health/stamina HUD, and defeated state.

## Deliberate limitations
This is **offline demonstration logic** while the Bun server remains a placeholder. Damage, wolf movement, stamina, and dodge are currently client-side and are not protected against exploits. Do not claim real multiplayer combat or retain player rewards from this demo. No glTF skeletal animation assets have been authored yet.

## Animation migration contract
- Root movement and facing come from game/simulation data.
- Visual bones never decide physics or collision.
- Required clips: idle, walk, run, attack-1, attack-2, guard, dodge, hit, death, mine, chop.
- Author meshes in Blender Y-up, in meter scale, with +Z as character forward.
- Target 30 FPS Android midrange; animation and skinning LODs use measured budgets.
- Export GLB with clips and shared skeleton naming; retain the procedural fallback until model/clip loading succeeds.

## Follow-up engineering work
1. Import the older 0.6 Bun multiplayer simulation and make server-authoritative combat.
2. Add pointer target selection with generous screen-space touch bounds.
3. Add fixed-step simulation, client prediction, and server reconciliation.
4. Replace procedural character with first original rigged GLB and verify animation state transitions on phone.
5. Profile draw calls, memory, and sustained FPS on real Android hardware.
