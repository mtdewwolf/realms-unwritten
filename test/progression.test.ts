import {describe,expect,test} from "bun:test";
import {Database} from "bun:sqlite";
import {randomUUID} from "node:crypto";
import {ProgressionStore,experienceForLevel,levelForExperience,MAX_LEVEL} from "../apps/server/src/progression";
import {InventoryStore} from "../apps/server/src/inventory";
import {QuestStore} from "../apps/server/src/quests";
function setup(){
  const db=new Database(":memory:");
  db.exec("PRAGMA foreign_keys=ON;CREATE TABLE characters(id TEXT PRIMARY KEY);INSERT INTO characters VALUES ('a'),('b');");
  new InventoryStore(db);
  const progress=new ProgressionStore(db);
  const quests=new QuestStore(db,progress);
  return {db,progress,quests};
}
describe("server-owned character progression",()=>{
 test("level thresholds and derived stats are stable",()=>{
   expect(experienceForLevel(1)).toBe(0);
   expect(experienceForLevel(2)).toBe(100);
   expect(levelForExperience(99)).toBe(1);
   expect(levelForExperience(100)).toBe(2);
   expect(levelForExperience(299)).toBe(2);
   expect(levelForExperience(300)).toBe(3);
   expect(levelForExperience(2_000_000_000)).toBe(MAX_LEVEL);
 });
 test("wolf XP is granted once per event and persists for each character",()=>{
   const {db,progress}=setup();
   const event="wolf-kill-"+randomUUID();
   expect(progress.grantWolfKill("a",event)).toBe(true);
   expect(progress.grantWolfKill("a",event)).toBe(false);
   expect(progress.grantWolfKill("b",event)).toBe(true);
   expect(progress.read("a").xp).toBe(15);
   expect(progress.read("b").xp).toBe(15);
   expect(new ProgressionStore(db).read("a").xp).toBe(15);
   db.close();
 });
 test("invalid or forged event IDs cannot increase XP",()=>{
   const {db,progress}=setup();
   expect(()=>progress.grantWolfKill("a","test-event")).toThrow();
   expect(()=>progress.grantWolfKill("absent","wolf-kill-"+randomUUID())).toThrow();
   expect(progress.read("a").xp).toBe(0);
   db.close();
 });
 test("quest reward XP and coins commit once and progress survives reconnect",()=>{
   const {db,progress,quests}=setup();
   quests.accept("a");
   for(let n=0;n<3;n++)quests.recordWolfKill("a","wolf-kill-"+randomUUID());
   expect(quests.turnin("a")).toBe(true);
   expect(quests.turnin("a")).toBe(false);
   expect(progress.read("a").xp).toBe(75);
   const balance=db.query<{coins:number},[string]>("SELECT coins FROM wallets WHERE character_id=?").get("a");
   expect(balance?.coins).toBe(25);
   expect(new ProgressionStore(db).read("a").xp).toBe(75);
   db.close();
 });
 test("two quest and wolf rewards cross a level threshold without duplication",()=>{
   const {db,progress,quests}=setup();
   quests.accept("a");
   for(let n=0;n<3;n++){
     const event="wolf-kill-"+randomUUID();
     expect(progress.grantWolfKill("a",event)).toBe(true);
     quests.recordWolfKill("a",event);
   }
   expect(quests.turnin("a")).toBe(true);
   expect(progress.read("a")).toMatchObject({xp:120,level:2,attributes:{strength:7,vitality:6,agility:5}});
   db.close();
 });
});
