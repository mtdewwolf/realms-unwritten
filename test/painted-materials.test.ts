import {describe,expect,test} from "bun:test";
import {paintedTexture,samplePaintedSurface} from "../apps/client/src/world/paintedTextures";
describe("original painted-fantasy material palette",()=>{
 test("all four procedurally textured surfaces have deterministic patterns",()=>{
  const samples=["plaster","timber","slate","stone"] as const;
  for(const kind of samples){
   expect(samplePaintedSurface(kind,21,37)).toEqual(samplePaintedSurface(kind,21,37));
   const tex=paintedTexture(kind,64);
   expect(tex.image.data.length).toBe(64*64*4);
   expect(tex.image.data[3]).toBe(255);
   tex.dispose();
  }
  expect(samplePaintedSurface("slate",0,0)).not.toEqual(samplePaintedSurface("slate",10,10));
 });
});
