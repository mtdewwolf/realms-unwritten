import {describe,expect,test} from "bun:test";
import {createFactionOutpost,FACTION_OUTPOSTS} from "../apps/client/src/world/factionOutposts";
import {overlapsHouse,safeSpawn,moveWithCollision} from "../apps/client/src/world/collision";
describe("original faction architectural enclaves",()=>{
 test("both rival outposts have authored, visually distinct architecture",()=>{
  expect(FACTION_OUTPOSTS).toHaveLength(2);
  const a=createFactionOutpost("accord-watch"),b=createFactionOutpost("dominion-spire");
  expect(a.name).not.toBe(b.name);
  expect(a.children.length).toBeGreaterThan(3);
  expect(b.children.length).toBeGreaterThan(3);
 });
 test("each playable building has a matching server movement collider",()=>{
  for(const p of FACTION_OUTPOSTS)for(const dx of [-9,9]){
   const x=p.x+dx,z=p.z+(p.faction==="accord"?-6:6);
   expect(overlapsHouse(x,z)).toBe(true);
   const safe=safeSpawn(x,z);
   expect(overlapsHouse(safe.x,safe.z)).toBe(false);
   const stopped=moveWithCollision(x-5,z,6,0);
   expect(stopped.x).toBeLessThan(x-1.5);
  }
 });
});
