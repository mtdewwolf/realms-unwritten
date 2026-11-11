import {describe,expect,test} from "bun:test";
import { landmarksNear, landmarkInChunk, discoverableLandmarks } from "../apps/client/src/world/landmarks";
describe("deterministic points of interest",()=>{
 test("same coordinate query is stable",()=>{
   expect(landmarksNear(1400,900,600)).toEqual(landmarksNear(1400,900,600));
 });
 test("landmark never changes when crossing a chunk boundary",()=>{
   const points=landmarksNear(0,0,1100);
   expect(points.length).toBeGreaterThan(2);
   for(const poi of points){
     const cx=Math.floor(poi.x/64),cz=Math.floor(poi.z/64);
     expect(landmarkInChunk(cx,cz)).toContainEqual(poi);
   }
 });
 test("all generated landmarks have stable unique IDs",()=>{
   const all=landmarksNear(1500,1300,1300);
   expect(new Set(all.map(p=>p.id)).size).toBe(all.length);
   expect(all.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z))).toBe(true);
 });
 test("discovery radius is bounded",()=>{
   const all=discoverableLandmarks(1000,1000);
   expect(all.every(p=>Math.hypot(p.x-1000,p.z-1000)<=16)).toBe(true);
 });
 test("no landmark replaces the starter market",()=>{
   expect(landmarksNear(0,0,60)).toEqual([]);
 });
});
