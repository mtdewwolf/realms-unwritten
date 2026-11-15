import {describe,expect,test} from "bun:test";
import {raceAssetUrl} from "../apps/client/src/characters/raceAsset";
import {CLASSES,RACES,type RaceId,type ClassId} from "../apps/shared/src/characterCatalog";
describe("race/class GLB asset registry",()=>{
 test("both bodies have distinct files while original names remain stable",()=>{
  const seen=new Set<string>();
  for(const race of Object.keys(RACES) as RaceId[])
   for(const profession of Object.keys(CLASSES) as ClassId[]){
    const url=raceAssetUrl(race,profession);
    expect(url).toBe("/assets/hero-"+race+"-"+profession+".glb");
    seen.add(url);
    const femaleUrl=raceAssetUrl(race,profession,"female");
    expect(femaleUrl).toBe("/assets/hero-"+race+"-"+profession+"-female.glb");
    seen.add(femaleUrl);
   }
  expect(seen.size).toBe(48);
 });
});
