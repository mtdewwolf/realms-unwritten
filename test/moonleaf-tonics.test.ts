import {describe,expect,test} from "bun:test";
import {Database} from "bun:sqlite";
import {herbsNear,herbPatchAt,herbsInChunk} from "../apps/client/src/world/herbs";
import {ResourceService,HERB_RESPAWN_MS} from "../apps/server/src/resources";
import {InventoryStore} from "../apps/server/src/inventory";
import {CombatSimulation} from "../apps/server/src/combat";
import {WorldSimulation} from "../apps/server/src/simulation";
import {closestResource} from "../apps/client/src/ui/resourceGuidance";
function fixture(){
 const db=new Database(":memory:");
 db.exec("PRAGMA foreign_keys=ON;CREATE TABLE characters(id TEXT PRIMARY KEY);INSERT INTO characters VALUES('a'),('b');");
 const bag=new InventoryStore(db),resources=new ResourceService(db,bag);
 return {db,bag,resources};
}
describe("Moonleaf gathering and Healing Tonic",()=>{
 test("biome patch positions and chunk ownership are deterministic",()=>{
   const patch=herbsNear(200,200,1500)[0];expect(patch).toBeDefined();
   expect(herbPatchAt(Math.floor(patch!.x/128),Math.floor(patch!.z/128))).toEqual(patch!);
   expect(herbsInChunk(Math.floor(patch!.x/64),Math.floor(patch!.z/64))).toContainEqual(patch!);
   expect(closestResource(patch!.x,patch!.z)?.distance).toBe(0);
   expect(closestResource(patch!.x,patch!.z)?.kind).toBe("moonleaf");
 });
 test("one player depletes shared Moonleaf node, cooldown survives new service",()=>{
   const {db,bag,resources}=fixture();const p=herbsNear(200,200,1500)[0]!;
   expect(resources.gather("a",p.x,p.z,false,1000).ok).toBe(false);
   const first=resources.gather("a",p.x,p.z,true,1000);
   expect(first).toMatchObject({ok:true,item:"Moonleaf",retryAfterMs:HERB_RESPAWN_MS});
   const second=new ResourceService(db,bag);
   const duplicate=second.gather("b",p.x,p.z,true,1001);
   expect(duplicate).toMatchObject({ok:false,resource:"moonleaf"});
   expect(second.gather("b",p.x,p.z,true,1000+HERB_RESPAWN_MS).ok).toBe(true);
   expect(bag.read("a").items.find(i=>i.id==="moonleaf")?.quantity).toBe(1);db.close();
 });
 test("craft consumes exactly two herbs, use requires injury and cannot mint HP",()=>{
   const {db,bag,resources}=fixture();
   expect(resources.craft("a",0,0,true,"healing-tonic").ok).toBe(false);
   bag.creditHerb("a",2);
   expect(resources.craft("a",50,50,true,"healing-tonic").ok).toBe(false);
   expect(resources.craft("a",0,0,true,"healing-tonic").ok).toBe(true);
   expect(resources.craft("a",0,0,true,"healing-tonic").ok).toBe(false);
   expect(bag.read("a").items.find(i=>i.id==="healing-tonic")?.quantity).toBe(1);
   const world=new WorldSimulation();world.add("a","A",0,0);
   const combat=new CombatSimulation(world);combat.join("a");
   expect(combat.canHeal("a")).toBe(false);
   expect(combat.heal("a",30)).toBeNull();
   combat.players.get("a")!.health=60;
   expect(combat.canHeal("a")).toBe(true);
   expect(bag.consumeTonic("a")).toBe(true);
   expect(combat.heal("a",30)?.health).toBe(90);
   expect(bag.consumeTonic("a")).toBe(false);
   expect(bag.read("a").items.find(i=>i.id==="healing-tonic")?.quantity).toBe(0);
   db.close();
 });
});
