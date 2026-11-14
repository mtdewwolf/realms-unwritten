import {describe,expect,test} from "bun:test";
import {Database} from "bun:sqlite";
import {randomUUID} from "node:crypto";
import {InventoryStore} from "../apps/server/src/inventory";
import {ProgressionStore} from "../apps/server/src/progression";
import {QuestStore} from "../apps/server/src/quests";
import {WolfRewardCoordinator} from "../apps/server/src/wolfRewards";
function fixture(){
 const db=new Database(":memory:");
 db.exec("PRAGMA foreign_keys=ON;CREATE TABLE characters(id TEXT PRIMARY KEY);INSERT INTO characters VALUES('a'),('b');");
 const inventory=new InventoryStore(db),progression=new ProgressionStore(db),quests=new QuestStore(db,progression,inventory);
 const rewards=new WolfRewardCoordinator(db,inventory,quests,progression);
 return {db,inventory,progression,quests,rewards};
}
describe("atomic wolf rewards",()=>{
 test("loot, quest progress, and XP commit together, exactly once",()=>{
  const {db,inventory,progression,quests,rewards}=fixture();
  quests.accept("a");
  const event="wolf-kill-"+randomUUID();
  expect(rewards.grant("a",event)).toMatchObject({reward:{coins:5},questAdvanced:true,xpGranted:true});
  expect(rewards.grant("a",event)).toBeNull();
  expect(inventory.read("a").coins).toBe(5);
  expect(progression.read("a").xp).toBe(15);
  expect(quests.status("a").kills).toBe(1);
  expect(new WolfRewardCoordinator(db,inventory,quests,progression).grant("a",event)).toBeNull();
  db.close();
 });
 test("each contributor is credited once, without quest if not accepted",()=>{
  const {db,inventory,progression,quests,rewards}=fixture();
  const event="wolf-kill-"+randomUUID();
  expect(rewards.grant("a",event)?.questAdvanced).toBe(false);
  expect(rewards.grant("b",event)?.xpGranted).toBe(true);
  expect(inventory.read("b").coins).toBe(5);
  expect(progression.read("a").xp).toBe(15);
  expect(quests.status("a").stage).toBe("available");
  db.close();
 });
 test("XP receipt failure rolls back loot, coins, and quest credit",()=>{
  const {db,inventory,progression,quests,rewards}=fixture();
  quests.accept("a");
  const event="wolf-kill-"+randomUUID();
  // Simulate a conflicting XP receipt with no corresponding loot receipt.
  expect(progression.grantWolfKill("a",event)).toBe(true);
  expect(()=>rewards.grant("a",event)).toThrow("Wolf reward XP receipt conflict");
  expect(inventory.read("a").coins).toBe(0);
  expect(inventory.read("a").items).toEqual([]);
  expect(quests.status("a").kills).toBe(0);
  expect(db.query("SELECT * FROM reward_receipts").all()).toHaveLength(0);
  db.close();
 });
 test("invalid and unknown-character rewards cannot mutate tables",()=>{
  const {db,inventory,rewards}=fixture();
  expect(()=>rewards.grant("a","invalid")).toThrow();
  expect(()=>rewards.grant("missing","wolf-kill-"+randomUUID())).toThrow();
  expect(inventory.read("a").coins).toBe(0);
  db.close();
 });
});
