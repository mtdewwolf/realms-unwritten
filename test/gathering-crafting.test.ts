import {describe,expect,test} from "bun:test";
import {Database} from "bun:sqlite";
import {InventoryStore} from "../apps/server/src/inventory";
import {ResourceService,nearestOre,ORE_RESPAWN_MS} from "../apps/server/src/resources";
import {landmarksNear} from "../apps/client/src/world/landmarks";
function fixture(){
  const db=new Database(":memory:");
  db.exec("PRAGMA foreign_keys=ON;CREATE TABLE characters(id TEXT PRIMARY KEY);INSERT INTO characters VALUES ('a'),('b');");
  const bag=new InventoryStore(db);const resources=new ResourceService(db,bag);
  return {db,bag,resources};
}
describe("authoritative gathering and crafting",()=>{
 test("server finds only actual deterministic ore POIs",()=>{
  const ore=landmarksNear(0,0,2000).find(x=>x.type==="ore");
  expect(ore).toBeDefined();
  expect(nearestOre(ore!.x,ore!.z)?.id).toBe(ore!.id);
  expect(nearestOre(0,0)).toBeNull();
 });
 test("gathering requires distance and living character",()=>{
  const {db,bag,resources}=fixture();
  const ore=landmarksNear(0,0,2000).find(x=>x.type==="ore")!;
  expect(resources.gather("a",0,0,true,1000).ok).toBe(false);
  expect(resources.gather("a",ore.x,ore.z,false,1000).ok).toBe(false);
  expect(resources.gather("a",ore.x,ore.z,true,1000).ok).toBe(true);
  expect(bag.read("a").items.find(i=>i.id==="iron-ore")?.quantity).toBe(1);
  db.close();
 });
 test("shared node depletion survives service restart, then replenishes",()=>{
  const {db,bag,resources}=fixture();
  const ore=landmarksNear(0,0,2000).find(x=>x.type==="ore")!;
  expect(resources.gather("a",ore.x,ore.z,true,1000).ok).toBe(true);
  const second=new ResourceService(db,bag);
  expect(second.gather("b",ore.x,ore.z,true,1001).ok).toBe(false);
  expect(second.gather("b",ore.x,ore.z,true,1000+ORE_RESPAWN_MS).ok).toBe(true);
  expect(bag.read("b").items.find(i=>i.id==="iron-ore")?.quantity).toBe(1);
  db.close();
 });
 test("craft costs are atomic, validates station and gear ownership",()=>{
  const {db,bag,resources}=fixture();
  expect(resources.craft("a",0,0,true,"ironblade").ok).toBe(false);
  bag.creditOre("a",2);
  bag.grantWolfKill("wolf-kill-"+crypto.randomUUID(),"a");
  expect(resources.craft("a",50,50,true,"ironblade").ok).toBe(false);
  expect(resources.craft("a",0,0,true,"unknown").ok).toBe(false);
  expect(resources.craft("a",0,0,true,"ironblade").ok).toBe(true);
  expect(bag.read("a").items.find(i=>i.id==="iron-ore")?.quantity).toBe(0);
  expect(bag.read("a").items.find(i=>i.id==="wolf-fang")?.quantity).toBe(0);
  expect(bag.read("a").items.find(i=>i.id==="ironblade")?.quantity).toBe(1);
  expect(resources.craft("a",0,0,true,"ironblade").ok).toBe(false);
  expect(bag.equip("a","ironblade")).toBe(true);
  expect(new InventoryStore(db).equipped("a").bonusDamage).toBe(12);
  db.close();
 });
});
