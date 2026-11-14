# Authoritative Building Collision — Milestone 1.1

## Implemented
- One pure deterministic TypeScript collision module is imported by the Bun simulation and Android offline movement.
- Three original Verdant Reach starter houses and all procedurally generated settlement houses use the same x/z rectangular footprints as their rendered visual meshes.
- A circular 0.45m player body is tested against the house rectangles; movement resolves in <=0.2m substeps, attempting x then z for basic wall sliding.
- Client coordinates are still ignored. Bun integrates validated velocity intent into collision-checked positions at 20 Hz, then broadcasts its authoritative position.
- The Android client uses the same resolver for offline walking and local dodge visualization. Online positions still reconcile against Bun.
- Guest positions saved inside newly solid building footprints are relocated to an unobstructed nearby location when the character joins.
- World limits remain enforced. Roads, trees, rocks, terrain cliffs, wolf bodies, and decorative structures are deliberately **not yet collision obstacles**.

## Acceptance checks
Run bun run check; bun test; bun tools/smoke-server.ts; build Android APK. Manually walk into each of the three starter houses from different sides: you must slide around rather than pass through. Repeat in a generated hamlet. Sprinting/dodge must not tunnel through obstacles. Test rejoining a character whose saved position predates collision. Test both offline and online behavior on physical Android devices.

## Engineering follow-ups
The first pass uses nearby-settlement discovery per movement substep; profile this with many players before adding hundreds of obstacles. Next include stable collision definitions for interactable props and guard stations, add a uniform spatial collider index and sweep-based collision, then implement session reconnection and heartbeats. A robust production system should support server-authoritative dash actions and NPC navigation around colliders.
