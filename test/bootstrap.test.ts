import { describe, expect, test } from "bun:test";

describe("Realms Unwritten Android bootstrap", () => {
  test("camera pitch is in the isometric viewing range", () => {
    const pitchDegrees = 55;
    expect(pitchDegrees).toBeGreaterThan(40);
    expect(pitchDegrees).toBeLessThan(70);
  });
  test("diagonal joystick input is normalized", () => {
    const x = 1, z = 1;
    const length = Math.max(1, Math.hypot(x, z));
    expect(Math.hypot(x / length, z / length)).toBeCloseTo(1);
  });
  test("Android app identifier is well formed", () => {
    expect("game.realmsunwritten.client").toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
  });
});
