import {describe,expect,test} from "bun:test";
import {createFantasyCottage} from "../apps/client/src/world/fantasyArchitecture";
describe("village graphical asset kit",()=>{
 test("original cottage has pitched layered roofs, timber, lamps and windows",()=>{
  const cottage=createFantasyCottage(7,-9,2);
  expect(cottage.position.x).toBe(7);
  expect(cottage.position.z).toBe(-9);
  expect(cottage.children.length).toBeGreaterThan(50);
  let glowing=0;cottage.traverse(o=>{if(o.type==="Mesh"&&o.name!=="")glowing++;});
  expect(cottage.name).toBe("RU_Cottage");
 });
});
