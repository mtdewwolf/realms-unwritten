# World Atlas — Android navigation prototype

## Implemented
- Overlay canvas map (320 × 320 logical pixels) showing a 1.024 km local window, centered on the player's position.
- Fog of war persisted as visited 64m cells in localStorage with a versioned key, conservative input validation, and no separate network dependency.
- Biome coloring only in visited cells; never intentionally reveals unexplored landmarks.
- Discovered landmarks rendered as small colored map markers.
- Tap a visited cell or discovered marker to set a waypoint. Distance and compass bearing display on the main HUD.
- World bounds clamp navigation targets. Arriving within 8m clears the waypoint.
- Map button, M keyboard shortcut, Escape to close.

## Limitations
Map is local-only and uses device storage; it is not shared between characters or devices. The local coordinate map is planar and north-up. No roads/routing or obstacles, no multiplayer party markers, no server exploration persistence, no global zoom yet. Map target is a directional guide, not an automatic movement path.

## QA
Launch the Android build. Open Map, explore into several new chunks, reopen to see revealed tiles, set a destination on a known cell and follow bearing. Verify reopening the app retains visited tiles; tap undiscovered cells to ensure they are not accepted. Try portrait/landscape and Android back navigation as additional manual checks.
