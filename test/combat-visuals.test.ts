import {describe,expect,test} from "bun:test";
import {createRaceCharacter} from "../apps/client/src/characters/raceModel";
import {CombatVisuals} from "../apps/client/src/world/combatVisuals";
describe("visual-only class and combat effects",()=>{
 test("six effects have hard allocation bounds and clean up after lifetime",()=>{
  const avatar=createRaceCharacter({race:"sunborne",characterClass:"vanguard"});
  const scene=avatar.root;
  const fx=new CombatVisuals(scene);
  for(const kind of ["slash","quickstrike","arc-bolt","bulwark","dodge","gather"] as const)
   fx.emit(kind,scene.position,scene.position);
  expect(fx.activeCount).toBe(6);
  for(let i=0;i<50;i++)fx.emit("arc-bolt",scene.position);
  expect(fx.activeCount).toBeLessThanOrEqual(16);
  for(let i=0;i<100;i++)fx.update(.05);
  expect(fx.activeCount).toBe(0);
  fx.dispose();avatar.dispose();
 });
});
