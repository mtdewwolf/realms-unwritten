import {describe,expect,test} from "bun:test";
import {WorldSimulation} from "../apps/server/src/simulation";
import {ATTACK_RANGE,CombatSimulation} from "../apps/server/src/combat";
import {PROTOCOL_VERSION} from "../apps/server/src/protocol";
import type {ClassId} from "../apps/shared/src/characterCatalog";
import {ABILITY_SPECS,CLASS_ABILITY_IDS,abilitiesForClass} from "../apps/shared/src/classAbilities";
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
function duo(cls:ClassId,ax=4,az=5,bx=6,bz=5){
 const world=new WorldSimulation();
 world.add("a","A",ax,az);world.add("b","B",bx,bz);
 const combat=new CombatSimulation(world);combat.join("a");combat.join("b");
 combat.resolveClass=id=>id==="a"?cls:"vanguard";
 return {world,combat};
}
function bite(combat:CombatSimulation,id="a"){
 combat.wolf.phase="windup";combat.wolf.targetId=id;combat.wolf.windupUntil=0;combat.tick();
}
describe("spellweaver and shadeblade kits",()=>{
 test("catalog keeps each ability on its class and the live protocol",()=>{
  expect(PROTOCOL_VERSION).toBe(12);
  expect(abilitiesForClass("vanguard")).toHaveLength(1);
  expect(abilitiesForClass("spellweaver")).toHaveLength(4);
  expect(abilitiesForClass("shadeblade")).toHaveLength(4);
  expect(ABILITY_SPECS.quickstrike.range).toBe(ATTACK_RANGE);
  for(const classId of ["vanguard","spellweaver","shadeblade"] as const)
   for(const id of CLASS_ABILITY_IDS[classId])expect(ABILITY_SPECS[id].classId).toBe(classId);
 });
 test("Starfall is a separate area cooldown and forged damage is ignored",()=>{
  const hit=setup("spellweaver",5,11);
  expect(hit.combat.useAbility("a",{type:"ability",seq:1,ability:"starfall",damage:9999})).toMatchObject({ok:true,wolfHealth:42,stamina:66});
  const miss=setup("spellweaver",5,12);
  expect(miss.combat.useAbility("a",{type:"ability",seq:1,ability:"starfall"})?.reason).toBe("target out of range");
  expect(miss.combat.wolf.health).toBe(60);
  expect(miss.combat.players.get("a")?.stamina).toBe(100);
  const both=setup("spellweaver",5,10);
  both.combat.useAbility("a",{type:"ability",seq:1,ability:"starfall"});
  expect(both.combat.useAbility("a",{type:"ability",seq:2,ability:"arc-bolt"})).toMatchObject({ok:true,wolfHealth:14});
 });
 test("Mend heals the most injured ally, caps health, and rejects forged amounts",()=>{
  const self=setup("spellweaver");
  self.combat.players.get("a")!.health=40;
  expect(self.combat.useAbility("a",{type:"ability",seq:1,ability:"mend",heal:999,health:1000})).toMatchObject({ok:true,health:62,healedId:"a",healedHealth:62,subjectSelf:true,stamina:74});
  const capped=setup("spellweaver");
  capped.combat.players.get("a")!.health=90;
  expect(capped.combat.useAbility("a",{type:"ability",seq:1,ability:"mend"})?.health).toBe(100);
  const full=setup("spellweaver");
  expect(full.combat.useAbility("a",{type:"ability",seq:1,ability:"mend"})?.reason).toBe("no one needs mending");
  expect(full.combat.players.get("a")?.stamina).toBe(100);
  const allies=duo("spellweaver");
  allies.combat.players.get("a")!.health=80;
  allies.combat.players.get("b")!.health=40;
  expect(allies.combat.useAbility("a",{type:"ability",seq:1,ability:"mend"})).toMatchObject({healedId:"b",healedHealth:62,subjectSelf:false,health:80});
  const chosen=duo("spellweaver");
  chosen.combat.players.get("a")!.health=50;
  chosen.combat.players.get("b")!.health=40;
  expect(chosen.combat.useAbility("a",{type:"ability",seq:1,ability:"mend",target:"a"})).toMatchObject({healedId:"a",healedHealth:72});
  expect(chosen.combat.players.get("b")?.health).toBe(40);
  const distant=duo("spellweaver",4,5,40,5);
  distant.combat.players.get("b")!.health=40;
  expect(distant.combat.useAbility("a",{type:"ability",seq:1,ability:"mend",target:"b"})?.reason).toBe("target out of range");
  expect(distant.combat.players.get("b")?.health).toBe(40);
  expect(distant.combat.players.get("a")?.stamina).toBe(100);
  const dead=duo("spellweaver");
  dead.combat.players.get("b")!.alive=false;
  expect(dead.combat.useAbility("a",{type:"ability",seq:1,ability:"mend",target:"b"})?.reason).toBe("target defeated");
  const barred=setup("vanguard");
  barred.combat.players.get("a")!.health=40;
  expect(barred.combat.useAbility("a",{type:"ability",seq:1,ability:"mend"})?.reason).toBe("ability unavailable to this class");
  expect(barred.combat.players.get("a")?.health).toBe(40);
  expect(setup("spellweaver").combat.useAbility("a",{type:"ability",seq:1,ability:"mend",target:"../passwd"})).toBeNull();
 });
 test("Aether Ward reduces a bite by 4 and yields to Bulwark",()=>{
  const self=setup("spellweaver");
  expect(self.combat.useAbility("a",{type:"ability",seq:1,ability:"aether-ward"})).toMatchObject({ok:true,subjectSelf:true,stamina:80});
  bite(self.combat);
  expect(self.combat.players.get("a")?.health).toBe(92);
  const ally=duo("spellweaver");
  ally.combat.players.get("b")!.health=70;
  expect(ally.combat.useAbility("a",{type:"ability",seq:1,ability:"aether-ward"})?.subjectId).toBe("b");
  bite(ally.combat,"b");
  expect(ally.combat.players.get("b")?.health).toBe(62);
  expect(ally.combat.players.get("a")?.health).toBe(100);
  const stacked=duo("spellweaver");
  expect(stacked.combat.useAbility("a",{type:"ability",seq:1,ability:"aether-ward",target:"b"})?.ok).toBe(true);
  expect(stacked.combat.useAbility("b",{type:"ability",seq:1,ability:"bulwark"})?.ok).toBe(true);
  bite(stacked.combat,"b");
  expect(stacked.combat.players.get("b")?.health).toBe(94);
 });
 test("Shadowstep is a server dash and a blocked path does not spend resources",()=>{
  const {world,combat}=setup("shadeblade",5,11);
  const used=combat.useAbility("a",{type:"ability",seq:1,ability:"shadowstep",x:0,z:0,position:{x:80,z:80}});
  expect(used).toMatchObject({ok:true,wolfHealth:42,stamina:72});
  expect(world.players.get("a")?.x).toBeCloseTo(5,5);
  expect(world.players.get("a")?.z).toBeCloseTo(7.2,5);
  expect(used?.position?.z).toBeCloseTo(7.2,5);
  expect(combat.useAbility("a",{type:"ability",seq:2,ability:"quickstrike"})?.wolfHealth).toBe(8);
  const far=setup("shadeblade",5,14);
  expect(far.combat.useAbility("a",{type:"ability",seq:1,ability:"shadowstep"})?.reason).toBe("target out of range");
  expect(far.world.players.get("a")?.z).toBe(14);
  expect(far.combat.players.get("a")?.stamina).toBe(100);
  const blocked=setup("shadeblade",-10,-5);
  blocked.combat.wolf.x=-2;blocked.combat.wolf.z=-5;
  expect(blocked.combat.useAbility("a",{type:"ability",seq:1,ability:"shadowstep"})?.reason).toBe("path blocked");
  expect(blocked.world.players.get("a")).toMatchObject({x:-10,z:-5});
  expect(blocked.combat.wolf.health).toBe(60);
  expect(blocked.combat.players.get("a")?.stamina).toBe(100);
 });
 test("Veil hides the shadeblade from the wolf until it ends",()=>{
  const hidden=setup("shadeblade");
  expect(hidden.combat.useAbility("a",{type:"ability",seq:1,ability:"veil"})).toMatchObject({ok:true,stamina:82});
  bite(hidden.combat);
  expect(hidden.combat.players.get("a")?.health).toBe(100);
  expect(hidden.combat.wolf.targetId).toBeNull();
  const dodged=setup("shadeblade");
  dodged.combat.useAbility("a",{type:"ability",seq:1,ability:"veil"});
  expect(dodged.combat.action("a",{type:"action",seq:2,action:"dodge"})?.ok).toBe(true);
  dodged.combat.time=1;
  bite(dodged.combat);
  expect(dodged.combat.players.get("a")?.health).toBe(100);
  const opened=setup("shadeblade");
  opened.combat.useAbility("a",{type:"ability",seq:1,ability:"veil"});
  expect(opened.combat.action("a",{type:"action",seq:2,action:"attack",target:"starter-wolf-v1"})?.ok).toBe(true);
  bite(opened.combat);
  expect(opened.combat.players.get("a")?.health).toBe(88);
  const expired=setup("shadeblade");
  expired.combat.useAbility("a",{type:"ability",seq:1,ability:"veil"});
  expired.combat.time=4;
  bite(expired.combat);
  expect(expired.combat.players.get("a")?.health).toBe(88);
 });
 test("Keen Senses reports the wolf and nearby allies without dealing damage",()=>{
  const near=setup("shadeblade",5,20);
  expect(near.combat.useAbility("a",{type:"ability",seq:1,ability:"keen-senses",damage:500})).toMatchObject({ok:true,wolfHealth:60,stamina:86,scout:{wolf:{x:5,z:5,distance:15},allies:0}});
  const far=setup("shadeblade",5,40);
  const quiet=far.combat.useAbility("a",{type:"ability",seq:1,ability:"keen-senses"});
  expect(quiet?.ok).toBe(true);
  expect(quiet?.scout?.wolf).toBeNull();
  expect(far.combat.wolf.health).toBe(60);
  const company=duo("shadeblade",5,20,5,30);
  expect(company.combat.useAbility("a",{type:"ability",seq:1,ability:"keen-senses"})?.scout?.allies).toBe(1);
  company.combat.players.get("b")!.alive=false;
  company.combat.time=9;
  expect(company.combat.useAbility("a",{type:"ability",seq:2,ability:"keen-senses"})?.scout?.allies).toBe(0);
 });
 test("a failed cast does not start a cooldown or spend a forgery",()=>{
  const {combat}=setup("spellweaver",5,10);
  combat.players.get("a")!.stamina=10;
  expect(combat.useAbility("a",{type:"ability",seq:1,ability:"arc-bolt"})?.reason).toBe("not enough stamina");
  expect(combat.wolf.health).toBe(60);
  expect(combat.players.get("a")?.abilityReadyAt["arc-bolt"]).toBeUndefined();
  combat.players.get("a")!.stamina=100;
  expect(combat.useAbility("a",{type:"ability",seq:2,ability:"arc-bolt",cooldown:0})?.ok).toBe(true);
  expect(combat.useAbility("a",{type:"ability",seq:3,ability:"arc-bolt"})?.reason).toBe("ability cooling down");
  expect(setup("shadeblade",5,10).combat.useAbility("a",{type:"ability",seq:1,ability:"starfall"})?.reason).toBe("ability unavailable to this class");
 });
});
