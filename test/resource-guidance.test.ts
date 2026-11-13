import {describe,expect,test} from "bun:test";
import {closestOre,workshopDistance,missingMaterials,ORE_INTERACT_RANGE} from "../apps/client/src/ui/resourceGuidance";
import {landmarksNear} from "../apps/client/src/world/landmarks";
describe("resource UX guidance",()=>{
 test("ore tracker returns real nearest POI and consistent range",()=>{
   const ore=landmarksNear(0,0,1600).find(p=>p.type==="ore");
   expect(ore).toBeDefined();
   const target=closestOre(ore!.x,ore!.z);
   expect(target?.id).toBe(ore!.id);
   expect(target?.inRange).toBe(true);
   expect(target?.distance).toBe(0);
   expect(closestOre(ore!.x+ORE_INTERACT_RANGE+.1,ore!.z,ORE_INTERACT_RANGE-1)).toBeNull();
 });
 test("track does not use invalid inputs",()=>{
   expect(closestOre(NaN,0)).toBeNull();
   expect(closestOre(0,Infinity)).toBeNull();
   expect(closestOre(0,0,-5)).toBeNull();
 });
 test("workshop proximity and missing ingredients",()=>{
   expect(workshopDistance(2,-3)).toBe(0);
   expect(missingMaterials([])).toEqual({ore:2,fang:1});
   expect(missingMaterials([{id:"iron-ore",quantity:1},{id:"wolf-fang",quantity:3}])).toEqual({ore:1,fang:0});
   expect(missingMaterials([{id:"iron-ore",quantity:4},{id:"wolf-fang",quantity:1}])).toEqual({ore:0,fang:0});
 });
});
