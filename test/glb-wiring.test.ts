import {describe, expect, test} from "bun:test";
describe("animated GLB build wiring", () => {
 test("runtime sources use stable file locations", () => {
   const src = require("fs").readFileSync("apps/client/src/main.ts","utf8") as string;
   expect(src).toContain('"/assets/adventurer.glb"');
   expect(src).toContain('"/assets/wolf.glb"');
 });
});
