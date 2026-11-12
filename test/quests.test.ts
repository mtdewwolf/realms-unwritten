import {describe,expect,test} from "bun:test";
import {Database} from "bun:sqlite";
import {randomUUID} from "node:crypto";
import {InventoryStore} from "../apps/server/src/inventory";
import {QuestStore,closeToGuard,parseQuestCommand} from "../apps/server/src/quests";
function fixture(){
  const db=new Database(":memory:");
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE characters(id TEXT PRIMARY KEY); INSERT INTO characters VALUES ('a'),('b');");
  const inventory=new InventoryStore(db);
  const quests=new QuestStore(db);
  return {db,inventory,quests};
}
describe("persistent Wolf Hunt quest",()=>{
 test("accept, three distinct wolf events, then one-time claim",()=>{
   const {db,inventory,quests}=fixture();
   expect(quests.status("a").stage).toBe("available");
   expect(quests.accept("a")).toBe(true);
   expect(quests.accept("a")).toBe(false);
   const event1="wolf-kill-"+randomUUID();
   expect(quests.recordWolfKill("a",event1)).toBe(true);
   expect(quests.recordWolfKill("a",event1)).toBe(false);
   expect(quests.status("a").kills).toBe(1);
   expect(quests.turnin("a")).toBe(false);
   expect(quests.recordWolfKill("a","wolf-kill-"+randomUUID())).toBe(true);
   expect(quests.recordWolfKill("a","wolf-kill-"+randomUUID())).toBe(true);
   expect(quests.status("a").stage).toBe("ready");
   expect(quests.turnin("a")).toBe(true);
   expect(quests.turnin("a")).toBe(false);
   expect(quests.status("a").stage).toBe("completed");
   expect(inventory.read("a").coins).toBe(25);
   expect(quests.recordWolfKill("a","wolf-kill-"+randomUUID())).toBe(false);
   expect(inventory.read("a").coins).toBe(25);
   db.close();
 });
 test("quest state persists across store recreation and is per character",()=>{
   const {db,quests}=fixture();
   quests.accept("a");quests.recordWolfKill("a","wolf-kill-"+randomUUID());
   const restored=new QuestStore(db);
   expect(restored.status("a").kills).toBe(1);
   expect(restored.status("b").stage).toBe("available");
   db.close();
 });
 test("accepting after kills does not count historical kills",()=>{
   const {db,quests}=fixture();
   expect(quests.recordWolfKill("b","wolf-kill-"+randomUUID())).toBe(false);
   quests.accept("b");
   expect(quests.status("b").kills).toBe(0);
   db.close();
 });
 test("validation and proximity checks",()=>{
   expect(parseQuestCommand({type:"quest",action:"turnin",id:"other"})).toBeNull();
   expect(parseQuestCommand({type:"quest",action:"accept",id:"verdant-wolf-hunt"})).toBe("accept");
   expect(closeToGuard(0,0)).toBe(true);
   expect(closeToGuard(100,0)).toBe(false);
   expect(closeToGuard(NaN,0)).toBe(false);
 });
});
