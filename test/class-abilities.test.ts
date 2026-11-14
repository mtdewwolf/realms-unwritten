import {describe,expect,test} from "bun:test";
import {WorldSimulation} from "../apps/server/src/simulation";
import {CombatSimulation,WOLF_ID} from "../apps/server/src/combat";
import type {ClassId} from "../apps/shared/src/characterCatalog";
function setup(cls:ClassId,x=4,z=5){
 const world=new WorldSimulation();world.add("a","A",x,z);
 const combat=new CombatSimulation(world);combat.join("a");
 combat.resolveClass=()=>cls;
 return {world,combat};
}
describe("authoritative starter class abilities",()=>{
 test("Vanguard Bulwark is defensive, consumes stamina, and applies cooldown",()=>{
  const {combat}=setup("vanguard");
  const used=combat.useAbility("a",{type:"ability",seq:1,ability:"bulwark",duration:9999});
  expect(used).toMatchObject({ok:true,stamina:78});
  expect(combat.useAbility("a",{type:"ability",seq:2,ability:"bulwark"})?.reason).toBe("ability cooling down");
  combat.wolf.phase="windup";combat.wolf.targetId="a";combat.wolf.windupUntil=0;
  combat.tick();
  expect(combat.players.get("a")?.health).toBe(94);
 });
 test("Spellweaver Arc Bolt hits from ranged distance, but not beyond 9m",()=>{
  const near=setup("spellweaver",5,13);
  const result=near.combat.useAbility("a",{type:"ability",seq:1,ability:"arc-bolt",damage:9999});
  expect(result).toMatchObject({ok:true,wolfHealth:32,stamina:70});
  expect(near.combat.useAbility("a",{type:"ability",seq:2,ability:"arc-bolt"})?.reason).toBe("ability cooling down");
  const far=setup("spellweaver",5,17);
  expect(far.combat.useAbility("a",{type:"ability",seq:1,ability:"arc-bolt"})?.reason).toBe("target out of range");
  expect(far.combat.wolf.health).toBe(60);
 });
 test("Shadeblade Quickstrike respects melee range and grants one death event",()=>{
  const {combat}=setup("shadeblade");
  const events:Array<readonly string[]>=[];
  combat.onWolfDefeated=(_,contributors)=>events.push(contributors);
  expect(combat.useAbility("a",{type:"ability",seq:1,ability:"quickstrike"})?.wolfHealth).toBe(26);
  combat.time=8;
  expect(combat.useAbility("a",{type:"ability",seq:2,ability:"quickstrike"})?.wolfHealth).toBe(0);
  expect(events).toEqual([["a"]]);
  expect(combat.useAbility("a",{type:"ability",seq:3,ability:"quickstrike"})?.ok).toBe(false);
 });
 test("forged cross-class ability, stale seq and invalid payload do not change state",()=>{
  const {combat}=setup("vanguard");
  expect(combat.useAbility("a",{type:"ability",seq:1,ability:"arc-bolt",damage:999})?.reason).toBe("ability unavailable to this class");
  expect(combat.useAbility("a",{type:"ability",seq:1,ability:"bulwark"})?.reason).toBe("stale action");
  expect(combat.useAbility("a",{type:"ability",seq:2,ability:"firestorm"})).toBeNull();
  expect(combat.useAbility("a",{type:"ability",seq:3,ability:"bulwark"})?.ok).toBe(true);
  expect(combat.wolf.health).toBe(60);
 });
});
