import {describe,expect,test} from "bun:test";
import * as THREE from "three";
import {floraInChunk,addBiomeFlora} from "../apps/client/src/world/biomeFlora";
describe("Android-friendly biome environment assets",()=>{
 test("flora generation is deterministic per chunk and avoids starter village",()=>{
  const first=floraInChunk(0,0),second=floraInChunk(0,0);
  expect(first).toEqual(second);
  expect(first.every(p=>Math.abs(p.x)>=18||Math.abs(p.z)>=22)).toBe(true);
  expect(floraInChunk(1,0)).not.toEqual(first);
  expect(new Set(floraInChunk(2,3).map(p=>p.kind)).size).toBeGreaterThan(2);
 });
 test("builds grouped instanced vegetation without individual scene draw calls",()=>{
  const group=new THREE.Group();
  addBiomeFlora(group,2,3,64,()=>2);
  expect(group.children.length).toBeLessThanOrEqual(6);
  expect(group.children.length).toBeGreaterThan(0);
  let count=0;
  for(const child of group.children){
   expect(child).toBeInstanceOf(THREE.InstancedMesh);
   const batch=child as THREE.InstancedMesh;count+=batch.count;
   expect(batch.geometry.getAttribute("position").count).toBeGreaterThan(0);
   expect(batch.geometry.groups.length).toBeGreaterThan(0);
  }
  expect(count).toBeGreaterThan(30);
 });
});
