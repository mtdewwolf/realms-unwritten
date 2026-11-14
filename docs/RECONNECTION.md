# Guest Reconnection and Session Recovery — Milestone 1.2

## Android client
- Transient WebSocket closures trigger bounded exponential retries: 500ms, 1s, 2s, 4s, 8s, 12s (maximum six).
- A new WebSocket sends the previously stored guest token. A join handshake that takes over eight seconds is closed and retried.
- A successful welcome resets the retry counter and action/movement sequence IDs, and reapplies the server-authoritative character position.
- Inventory, quest state and progression are sent by Bun on each new welcome.
- Explicit OFFLINE cancels timers, closes the current socket and disables reconnect.
- Invalid token, incompatible protocol, malformed hello, or policy closures terminate retrying.
- The UI displays retry counts and connection errors. A lost socket clears remote actors so stale ghosts are not displayed.

## Bun server
- A new valid hello presenting the same guest bearer token may replace the previous socket even if Bun has not observed its closure.
- Old session position is saved before replacement. World and combat state are detached; no second player entity remains.
- The old socket is closed after ownership is detached; its later close callback cannot delete the replacement.
- No character is created during a valid-token recovery. Existing SQLite quests, inventory, XP and equipment remain attached to the same character ID.

## Security and limitations
The bearer token remains a capability to take over a character. This is not durable user identity, multi-device consent, or token rotation. Production should require TLS/WSS, token revocation/rotation, origin validation, and a dedicated authentication architecture. Reconnects currently reset volatile health/stamina to the prototype defaults, and any in-flight client action without a response is not replayed. No mobile OS background task guarantee.

## QA
- Simulate switching Wi-Fi off and back on: watch retry count and recovery to same character.
- Force a server restart; reconnect automatically while retaining SQLite state.
- Reconnect with the exact token before old socket closure: server should keep one active player and preserve last position.
- Explicitly tap OFFLINE: no background retries should occur.
- Try a bad guest token: the client should show error and stop; no new character.
- Exercise movements and combat after recovery to ensure sequence counters restart safely.
- Run bun run check, bun test and the live WebSocket smoke test, followed by Android APK compilation.
