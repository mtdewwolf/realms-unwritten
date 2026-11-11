# World streaming v1 — Android-first

The former 100 x 100 m demo ground is now a deterministic **16,384 x 16,384 m** addressing envelope (approximately **268 km²**). It is subdivided into 256 x 256 chunks of 64 m each. Only the 5 x 5 chunks around the local player are instantiated. Terrain meshes and instanced tree/rock geometry share assets and are reused.

The starter village at origin remains static and visible as a prototype. Nearby resources and pathways are visually procedural; server-world persistence, collision and synchronized ownership are NOT yet implemented. Biomes are simple broad palette regions; terrain is flat for now.

The purpose is to remove the hard arena boundary without loading the whole MMO into one Android scene. A credible MMO still needs region-of-interest subscriptions, deterministic server seed, persistent construction/resource deltas, heightfield streaming, real settlements and quest content.

## Acceptance testing
- Walk beyond the old 50m boundary in every direction.
- Confirm loaded-chunk count remains at or below 25.
- Traverse 25+ chunk borders and inspect frame rate and memory on a real device.
- Compare the same remote chunk after leaving and returning; foliage placement should be unchanged.
- Confirm no objects render past world bounds at x/z = +-8192m.
