# Authoritative multiplayer vertical slice v1

## Implemented
- Bun HTTP health endpoint at \`/health\` and WebSocket endpoint at \`/ws\`.
- A fixed 20 Hz simulation tick controls movement. Clients transmit a movement vector and increasing sequence number, **never their absolute position**.
- Direction normalization, world bounds, basic stale-message checks and 40-message/sec per-socket rate limit.
- 10 Hz nearby snapshots with a 160-meter region-of-interest radius.
- Guest character records in SQLite (\`bun:sqlite\`) with hashed bearer tokens, resumed on reconnect.
- Positions written to SQLite every 10 seconds and on a clean disconnect/shutdown.
- Android/web multiplayer panel accepts a **full WS URL**, e.g. \`ws://192.168.1.50:3001/ws\` on a LAN; local exploration remains available offline.
- Nearby players appear as procedural adventurer models. Local character receives a server position correction.

## Run locally
\`\`\`bash
bun install
bun run dev:server
bun run dev:client
\`\`\`
Connect the client to \`ws://<computer LAN IP>:3001/ws\`. Both devices must reach that IP and TCP port. For Android debug APKs, HTTP cleartext is enabled in debug only.

## Important limits and security
- Guest tokens are *bearer credentials* and localStorage is not secure storage. No real account login, identity recovery, character selection or production-ready authentication.
- No TLS termination is configured. Public services require WSS, rate limiting at the edge, origin validation, authentication and abuse controls.
- Collision, movement on slopes, authoritative combat, NPC state, chunk-state persistence and quests remain future work.
- This is a **single Bun process** simulation, not MMO scaling or multi-region orchestration.
- No server deployment is included; connecting an Android phone requires an accessible Bun host.
- Client-side camera and combat remain local. The server currently owns character positions only.
- Server trusts the movement direction but not coordinates. It does not yet provide speedhack-proof anti-cheat for network timing/clock abuse beyond fixed ticks.
- Current AOI scan is O(players²) at 10 Hz and needs spatial indexing to scale.

## Acceptance
1. Run the Bun server and check \`/health\`.
2. Connect two separate browser instances with separate guest localStorage stores.
3. Move one character; the other should see its position update, and stop seeing it beyond 160m.
4. Reconnect using the same guest token and verify stored location after server restart.
5. Disconnect the Bun server: Android client should remain explorable offline.
6. Invalid movement vector or duplicate sequence must not change server position.
