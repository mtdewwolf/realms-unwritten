import {describe,expect,test} from "bun:test";
import {Database} from "bun:sqlite";
import {InventoryStore} from "../apps/server/src/inventory";
import {QuestStore} from "../apps/server/src/quests";
import {ProgressionStore} from "../apps/server/src/progression";
import {CombatSimulation,WOLF_ID} from "../apps/server/src/combat";
import {WorldSimulation} from "../apps/server/src/simulation";
function fixture(){
 const db=new Database(":memory:");
 db.exec("PRAGMA foreign_keys=ON;CREATE TABLE characters(id TEXT PRIMARY KEY);INSERT INTO characters VALUES('a'),('b');");
 const inventory=new InventoryStore(db),progression=new ProgressionStore(db),quests=new QuestStore(db,progression,inventory);
 return {db,inventory,progression,quests};
}
describe("authoritative equipment and combat scaling",()=>{
 test("new characters use Worn Sword; unowned Fangblade cannot equip",()=>{
  const {db,inventory}=fixture();
  expect(inventory.equipped("a")).toMatchObject({id:"starter-sword",bonusDamage:0});
  expect(inventory.equip("a","fangblade")).toBe(false);
  expect(inventory.equipped("a").id).toBe("starter-sword");db.close();
 });
 test("quest awards one Fangblade atomically, duplicates cannot mint weapons",()=>{
  const {db,inventory,quests}=fixture();
  quests.accept("a");
  for(let i=0;i<3;i++)quests.recordWolfKill("a","wolf-kill-"+crypto.randomUUID());
  expect(quests.turnin("a")).toBe(true);
  expect(quests.turnin("a")).toBe(false);
  expect(inventory.read("a").items.find(i=>i.id==="fangblade")?.quantity).toBe(1);
  expect(inventory.equip("a","fangblade")).toBe(true);
  expect(new InventoryStore(db).equipped("a").bonusDamage).toBe(8);
  expect(inventory.equip("a","starter-sword")).toBe(true);
  expect(inventory.equipped("a").bonusDamage).toBe(0);
  db.close();
 });
 test("attack damage changes with equipped gear and strength, never client packet",()=>{
  const {db,inventory,progression,quests}=fixture();
  const world=new WorldSimulation();world.add("a","A",4,5);
  const combat=new CombatSimulation(world);combat.join("a");
  combat.resolveAttackDamage=id=>20+Math.floor((progression.read(id).attributes.strength-5)/2)+inventory.equipped(id).bonusDamage;
  expect(combat.action("a",{type:"action",seq:1,action:"attack",target:WOLF_ID,damage:999})?.ok).toBe(true);
  expect(combat.wolf.health).toBe(40);
  quests.accept("a");
  for(let i=0;i<3;i++)quests.recordWolfKill("a","wolf-kill-"+crypto.randomUUID());
  quests.turnin("a");
  inventory.equip("a","fangblade");
  progression.grantWolfKill("a","wolf-kill-"+crypto.randomUUID());
  progression.grantWolfKill("a","wolf-kill-"+crypto.randomUUID());
  expect(progression.read("a").level).toBe(2);
  combat.time=1;
  expect(combat.action("a",{type:"action",seq:2,action:"attack",target:WOLF_ID})?.ok).toBe(true);
  expect(combat.wolf.health).toBe(11); // 20 base + 1 level bonus + 8 Fangblade
  db.close();
 });
});
