import {describe,expect,test} from "bun:test";
import {readFileSync} from "node:fs";
describe("character and wolf asset wiring",()=>{
 test("race-specific avatars replace the generic adventurer GLB",()=>{
   const source=readFileSync("apps/client/src/main.ts","utf8");
   expect(source).toContain('createRaceCharacter(identity)');
   expect(source).toContain('"/assets/wolf.glb"');
   expect(source).not.toContain('mountAnimatedAsset(avatar, adventurer.root');
 });
 test("race mesh has a live creator preview and server-owned identity",()=>{
   const creator=readFileSync("apps/client/src/ui/characterCreator.ts","utf8");
   const client=readFileSync("apps/client/src/multiplayer/client.ts","utf8");
   expect(creator).toContain("new RacePreview(");
   expect(client).toContain("createRaceCharacter(other.character");
 });
});
