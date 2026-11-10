# Android APK verification checklist

The project is Android-first: 30 FPS landscape playability comes before desktop cosmetics.

## Current playable demo
- Original procedural adventurer and wolf.
- Client-side sword/dodge/stamina and wolf wind-up demonstration.
- Village geometry and art blockouts.
- One-finger world rotation, two-finger pinch zoom, virtual joystick.
- Gameplay state is local-only until a server simulation is integrated.

## Hands-on QA on a physical Android device
1. Install the debug APK and start in landscape. If the OS opens portrait, rotate manually; native orientation lock is planned.
2. Hold movement joystick, rotate the camera with another finger on world canvas.
3. Pinch in and out over the world; controls must not jump or become stuck.
4. Send the app into the background while holding joystick, then resume; movement must stop.
5. Approach wolf, verify visible 850 ms wind-up and damage behavior.
6. Dodge during wind-up; ensure stamina decreases and next attack waits for cooldown.
7. Leave the wolf's range; confirm attacks miss after the warning.
8. Test at 30 FPS after 10 minutes and record device model, thermal behavior and Android version.

## Known limitations
- Local demo is not authoritative multiplayer or persistent gameplay.
- Generated APK has not been verified on a physical device in this workflow.
- No production rigged GLB animations or authored terrain textures yet.
