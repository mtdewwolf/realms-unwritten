import {describe,expect,test} from "bun:test";
import * as THREE from "three";
import {terrainHeightAt,terrainColorAt,biomeAt} from "../apps/client/src/world/terrain";
import {buildTerrainChunkGeometry,groundHeightAt,CHUNK_SIZE} from "../apps/client/src/world/chunkedWorld";
describe("deterministic heightfield",()=>{
  test("starter settlement remains flat",()=>{
    for(const x of [-20,-10,0,10,20])for(const z of [-10,0,10])
      expect(terrainHeightAt(x,z)).toBe(0);
  });
  test("same world sample across independently built chunk borders",()=>{
    const west=buildTerrainChunkGeometry(-1,3);
    const east=buildTerrainChunkGeometry(0,3);
    const westPos=west.getAttribute("position") as THREE.BufferAttribute;
    const eastPos=east.getAttribute("position") as THREE.BufferAttribute;
    for(let z=0;z<=16;z++){
      const westY=westPos.getY(z*17+16),eastY=eastPos.getY(z*17);
      expect(Math.abs(westY-eastY)).toBeLessThan(1e-5);
    }
    west.dispose();east.dispose();
  });
  test("collision height matches rendered terrain at grid vertices",()=>{
    for(const [x,z] of [[0,0],[64,128],[-64,-124],[413,292],[-115,-402]]){
      expect(Number.isFinite(groundHeightAt(x,z))).toBe(true);
      if(x%4===0&&z%4===0)expect(groundHeightAt(x,z)).toBeCloseTo(terrainHeightAt(x,z),5);
    }
  });
  test("biome and color deterministic",()=>{
    expect(biomeAt(1200,-800)).toBe(biomeAt(1200,-800));
    expect(terrainColorAt(1200,-800)).toEqual(terrainColorAt(1200,-800));
    expect(terrainColorAt(1200,-800).every(x=>Number.isFinite(x)&&x>=0&&x<=1)).toBe(true);
  });
  test("vertex counts are bounded per chunk",()=>{
    const geometry=buildTerrainChunkGeometry(0,0);
    expect(geometry.getAttribute("position").count).toBe(289);
    expect(geometry.getIndex()?.count).toBe(1536);
    geometry.dispose();
  });
});
