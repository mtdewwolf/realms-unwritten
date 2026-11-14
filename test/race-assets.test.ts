import {describe,expect,test} from "bun:test";
import {raceAssetUrl} from "../apps/client/src/characters/raceAsset";
import {CLASSES,RACES,type RaceId,type ClassId} from "../apps/shared/src/characterCatalog";
describe("race/class GLB asset registry",()=>{
 test("all twelve race-class files have stable original asset names",()=>{
  const seen=new Set<string>();
  for(const race of Object.keys(RACES) as RaceId[])
   for(const profession of Object.keys(CLASSES) as ClassId[]){
    const url=raceAssetUrl(race,profession);
    expect(url).toBe("/assets/hero-"+race+"-"+profession+".glb");
    seen.add(url);
   }
  expect(seen.size).toBe(12);
 });
});
