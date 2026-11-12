import {describe,expect,test} from "bun:test";
import {Database} from "bun:sqlite";
import {randomUUID} from "node:crypto";
import {InventoryStore} from "../apps/server/src/inventory";
import {WorldSimulation} from "../apps/server/src/simulation";
import {CombatSimulation,WOLF_ID} from "../apps/server/src/combat";
function database():Database{
 const db=new Database(":memory:");
 db.exec("PRAGMA foreign_keys=ON; CREATE TABLE characters(id TEXT PRIMARY KEY); INSERT INTO characters VALUES ('a'),('b');");
 return db;
}
describe("durable loot and inventory",()=>{
 test("transaction credits only once and survives store recreation",()=>{
   const db=database(),store=new InventoryStore(db),event="wolf-kill-"+randomUUID();
   expect(store.grantWolfKill(event,"a")?.coins).toBe(5);
   expect(store.grantWolfKill(event,"a")).toBeNull();
   expect(store.read("a")).toEqual({type:"inventory",coins:5,equipped:{id:"starter-sword",name:"Worn Sword",bonusDamage:0},items:[
     {id:"wolf-fang",name:"Wolf Fang",quantity:1},
     {id:"wolf-pelt",name:"Wolf Pelt",quantity:1}]});
   const restored=new InventoryStore(db);
   expect(restored.read("a").coins).toBe(5);
   expect(restored.grantWolfKill(event,"a")).toBeNull();
   db.close();
 });
 test("same event grants each character independently",()=>{
   const db=database(),store=new InventoryStore(db),event="wolf-kill-"+randomUUID();
   expect(store.grantWolfKill(event,"a")?.coins).toBe(5);
   expect(store.grantWolfKill(event,"b")?.coins).toBe(5);
   expect(store.read("a").items[0].quantity).toBe(1);
   expect(store.read("b").items[0].quantity).toBe(1);db.close();
 });
 test("invalid event and nonexistent player cannot generate items",()=>{
   const db=database(),store=new InventoryStore(db);
   expect(()=>store.grantWolfKill("invalid","a")).toThrow();
   expect(()=>store.grantWolfKill("wolf-kill-"+randomUUID(),"absent")).toThrow();
   expect(store.read("absent").items).toEqual([]);db.close();
 });
 test("only successful attackers contribute and death event fires once",()=>{
   const world=new WorldSimulation();world.add("a","A",4,5);world.add("b","B",4,5);
   const combat=new CombatSimulation(world);combat.join("a");combat.join("b");
   const events:Array<readonly string[]>=[];
   combat.onWolfDefeated=(_,contributors)=>events.push(contributors);
   for(let i=0;i<3;i++){combat.time=i;combat.action("a",{type:"action",seq:i+1,action:"attack",target:WOLF_ID});}
   expect(events).toEqual([["a"]]);
   combat.action("b",{type:"action",seq:1,action:"attack",target:WOLF_ID});
   expect(events.length).toBe(1);
 });
});
