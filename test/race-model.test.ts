import {describe,expect,test} from "bun:test";
import {createRaceCharacter} from "../apps/client/src/characters/raceModel";
import {RACES,CLASSES,DEFAULT_APPEARANCE,type RaceId,type ClassId} from "../apps/shared/src/characterCatalog";
describe("original race-specific 3D characters",()=>{
 test("all four races and classes yield distinct renderable geometry",()=>{
  const counts:number[]=[];
  for(const race of Object.keys(RACES) as RaceId[]){
    for(const characterClass of Object.keys(CLASSES) as ClassId[]){
      const model=createRaceCharacter({race,characterClass,appearance:DEFAULT_APPEARANCE});
      expect(model.root.children.length).toBeGreaterThan(7);
      model.update(.1,true,false);
      counts.push(model.root.children.length);
      model.dispose();
    }
  }
  expect(new Set(counts).size).toBeGreaterThan(1);
 });
 test("all appearance boundaries build safely",()=>{
  for(const frame of ["lean","sturdy"] as const){
   const model=createRaceCharacter({race:"veilkin",characterClass:"shadeblade",appearance:{frame,skinTone:3,hairStyle:3,hairColor:4,marking:2}});
   expect(model.root.scale.x).toBeGreaterThan(0);
   model.dispose();
  }
 });
});
