import {describe,expect,test} from "bun:test";
import {settlementAtGrid,settlementsNear,settlementsInChunk,isRoadChunk,ROAD_GRID_METERS} from "../apps/client/src/world/settlements";
describe("deterministic settlement and road graph",()=>{
 test("starter town always exists",()=>expect(settlementAtGrid(0,0)?.name).toBe("Verdant Reach"));
 test("same destination for repeat queries",()=>expect(settlementsNear(1200,-900,1500)).toEqual(settlementsNear(1200,-900,1500)));
 test("one owner chunk for every settlement",()=>{
   for(const town of settlementsNear(0,0,2500)){
     const cx=Math.floor(town.x/64),cz=Math.floor(town.z/64);
     expect(settlementsInChunk(cx,cz)).toContainEqual(town);
   }
 });
 test("road spacing matches 64m chunks",()=>{
   expect(ROAD_GRID_METERS/64).toBe(8);
   expect(isRoadChunk(8,3)).toBe(true);
   expect(isRoadChunk(-8,15)).toBe(true);
   expect(isRoadChunk(3,5)).toBe(false);
 });
 test("avoid generating beyond world edge",()=>expect(settlementAtGrid(100,100)).toBeNull());
});
