import {describe,expect,test} from "bun:test";
import {createRaceCharacter} from "../apps/client/src/characters/raceModel";
import {CombatVisuals} from "../apps/client/src/world/combatVisuals";
describe("visual-only class and combat effects",()=>{
 test("class effects stay within the allocation cap and clean up after their lifetime",()=>{
  const avatar=createRaceCharacter({race:"sunborne",characterClass:"vanguard"});
  const scene=avatar.root;
  const fx=new CombatVisuals(scene);
  const kinds=["slash","quickstrike","shadowstep","arc-bolt","starfall","mend","aether-ward","bulwark","veil","keen-senses","dodge","gather"] as const;
  for(const kind of kinds)fx.emit(kind,scene.position,scene.position);
  expect(fx.activeCount).toBe(kinds.length);
  for(let i=0;i<50;i++)fx.emit("arc-bolt",scene.position);
  expect(fx.activeCount).toBeLessThanOrEqual(16);
  for(let i=0;i<100;i++)fx.update(.05);
  expect(fx.activeCount).toBe(0);
  fx.dispose();avatar.dispose();
 });
});
