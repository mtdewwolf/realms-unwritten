# Android Game Menu and HUD — v1

## What changed
- The overlapping MAP, BAG, QUEST and HERO buttons have been consolidated into one top-left **MENU** entry, with a touch-friendly five-item navigation drawer.
- The multiplayer connection controls now live under **Multiplayer** rather than occupying the exploration screen.
- The menu is mutually exclusive: entering a section closes the previous section; pressing BACK or Escape returns to the game menu or closes it. The atlas keeps its internal visibility state in sync.
- ATTACK, DODGE, GATHER and the virtual joystick remain present throughout normal exploration. GATHER is emphasized and reads **MINE** when the player is within 5 meters of ore while connected.
- CSS uses Android safe-area insets, scrollable content panels, 44px minimum targets, and compact layouts on small/short screens.
- The active game continues rendering beneath menus. Closing the menu returns to the existing game state; nothing is re-created.
- Desktop M hotkey for the atlas is retained for keyboard users.

## Testing
1. On a phone, verify the left thumb joystick and right-side ATTACK/DODGE/GATHER remain reachable without covering each other.
2. Open MENU and cycle MAP → MENU → BACKPACK → MENU → QUEST → MENU → CHARACTER → MENU → MULTIPLAYER. Only one panel should be open at a time.
3. Use the Multiplayer screen to connect and disconnect; on closing the screen, movement and combat still work.
4. Open MAP, use its own close control, then reopen through MENU. Confirm no stale/double-toggle behavior.
5. Press Escape on desktop while a panel is open. Check that focus is not trapped and no UI stays behind the backdrop.
6. Stand beside ore. MINE should highlight and work online; far from ore it reverts to GATHER.
7. Rotate the phone and test landscape, portrait, and heights below 420 CSS pixels. Scroll inventory/quest details and test the virtual keyboard in the Multiplayer URL field.
8. Confirm all existing Bun multiplayer smoke tests, unit tests, GLB generation, web build, and Android APK build pass.

## Limitations
No accessibility audit with TalkBack, one-handed layout settings, dynamic touch-zone remapping, or automated screenshot/visual-regression suite. These require on-device testing. Existing panels still use internal close buttons and are integrated through the central navigation coordinator.
