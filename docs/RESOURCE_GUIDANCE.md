# Android Resource Discovery and Crafting UX (v1)

This milestone addresses a practical problem: mining worked only when the player happened to stand next to a generated ore landmark. It now has:
- A compact Ironstone tracker showing the nearest ore up to 1.2 km away, bearing and distance, plus a TRACK ORE button.
- TRACK ORE creates a map navigation waypoint **without revealing fog-of-war cells** or changing discovery progress.
- Near an ore landmark, the HUD prompts GATHER and a cyan ground ring highlights the ore.
- After a successful gather or depleted attempt, the HUD shows time until the local node replenishes. The *server remains authoritative*; the timer is a UI hint, not a source of availability truth.
- The BAG panel explains exact missing recipe ingredients and how to reach the workshop. Server craft checks remain unchanged.
- Workstation distance is shown on the tracker.

## Manual validation
1. Start the updated Bun server and install the matching debug APK.
2. Walk away from town, inspect nearest ore distance, tap TRACK ORE, and confirm map guidance leads to the ore without artificially uncovering unexplored terrain.
3. Within ~75 meters inspect the cyan ground ring; within 5m the tracker must say to press GATHER.
4. Gather online; verify inventory +1 ore and tracker shows approximately 30s cooldown. Try again immediately and verify server rejection.
5. Go to Verdant Reach; inspect workshop distance and missing materials in BAG. Obtain 2 ore and one wolf fang, craft Ironblade, then equip.
6. Repeat with two clients near one node; ensure the authoritative resource cooldown prevents duplicate harvest.
7. Test small Android screens and background/resume for overlapping HUD or stale timing.

## Limits
No map zoom/full-world resource search, ore tool/animation, recipe book or server-wide countdown broadcast. The nearest ore comes from deterministic location generation on the client; only Bun decides whether gathering is valid. Fog-of-war is not bypassed by tracking a resource. Android on-device UX still needs human validation.
