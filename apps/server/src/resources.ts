import {Database} from "bun:sqlite";
import {landmarksNear} from "../../client/src/world/landmarks";
import {herbsNear} from "../../client/src/world/herbs";
import type {InventoryStore} from "./inventory";
import {closeToGuard} from "./quests";

export const ORE_RANGE=5;
export const ORE_RESPAWN_MS=30_000;
export const RECIPE_ID="ironblade";
export const HERB_RESPAWN_MS=45_000;
export interface ResourceResult{type:"resource_result";action:"gather"|"craft";ok:boolean;reason?:string;nodeId?:string;item?:string;amount?:number;retryAfterMs?:number;resource?: "ore"|"moonleaf"|"tonic"}
export interface NearbyOre{id:string;x:number;z:number;distance:number}
export function nearestOre(x:number,z:number):NearbyOre|null{
  const nodes=landmarksNear(x,z,ORE_RANGE).filter(p=>p.type==="ore")
    .map(p=>({id:p.id,x:p.x,z:p.z,distance:Math.hypot(x-p.x,z-p.z)}));
  nodes.sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
  return nodes[0]??null;
}
/** Authoritative, transactional depletion and recipe operations. */
export class ResourceService{
  private readonly harvest;
  private readonly gatherHerb;
  constructor(private readonly db:Database,private readonly bag:InventoryStore){
    db.exec("CREATE TABLE IF NOT EXISTS ore_nodes(node_id TEXT PRIMARY KEY,available_after INTEGER NOT NULL)");
    const node=db.query<{available_after:number},[string]>("SELECT available_after FROM ore_nodes WHERE node_id=?");
    const cooldown=db.query("INSERT INTO ore_nodes(node_id,available_after) VALUES (?,?) ON CONFLICT(node_id) DO UPDATE SET available_after=excluded.available_after");
    this.gatherHerb=db.transaction((id:string,herb:NearbyOre,now:number):ResourceResult=>{
      const ready=node.get(herb.id);
      if(ready&&ready.available_after>now)return {type:"resource_result",action:"gather",ok:false,reason:"Moonleaf is regrowing",nodeId:herb.id,retryAfterMs:ready.available_after-now,resource:"moonleaf"};
      cooldown.run(herb.id,now+HERB_RESPAWN_MS);
      this.bag.creditHerb(id,1);
      return {type:"resource_result",action:"gather",ok:true,nodeId:herb.id,item:"Moonleaf",amount:1,retryAfterMs:HERB_RESPAWN_MS,resource:"moonleaf"};
    });
    this.harvest=db.transaction((id:string,ore:NearbyOre,now:number):ResourceResult=>{
      const ready=node.get(ore.id);
      if(ready&&ready.available_after>now)return {type:"resource_result",action:"gather",ok:false,reason:"Ore depleted; return after it replenishes",nodeId:ore.id,retryAfterMs:ready.available_after-now};
      cooldown.run(ore.id,now+ORE_RESPAWN_MS);
      this.bag.creditOre(id,1);
      return {type:"resource_result",action:"gather",ok:true,nodeId:ore.id,item:"Iron Ore",amount:1,retryAfterMs:ORE_RESPAWN_MS};
    });
  }
  gather(id:string,x:number,z:number,alive:boolean,now=Date.now()):ResourceResult{
    if(!alive||!Number.isFinite(x)||!Number.isFinite(z))return {type:"resource_result",action:"gather",ok:false,reason:"You must be alive to gather"};
    const ore=nearestOre(x,z);
    const patch=herbsNear(x,z,ORE_RANGE).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];
    if(patch&&(!ore||Math.hypot(patch.x-x,patch.z-z)<ore.distance))return this.gatherHerb(id,{id:patch.id,x:patch.x,z:patch.z,distance:Math.hypot(patch.x-x,patch.z-z)},now);
    if(ore)return this.harvest(id,ore,now);
    return {type:"resource_result",action:"gather",ok:false,reason:"Move within 5 meters of ore or Moonleaf"};
  }
  craft(id:string,x:number,z:number,alive:boolean,recipe:unknown):ResourceResult{
    if(!alive||!closeToGuard(x,z))return {type:"resource_result",action:"craft",ok:false,reason:"Visit the Verdant Reach workshop beside the guard"};
    if(recipe==="healing-tonic"){
      if(!this.bag.craftTonic(id))return {type:"resource_result",action:"craft",ok:false,reason:"Requires 2 Moonleaf"};
      return {type:"resource_result",action:"craft",ok:true,item:"Healing Tonic",amount:1,resource:"tonic"};
    }
    if(recipe!==RECIPE_ID)return {type:"resource_result",action:"craft",ok:false,reason:"Unknown crafting recipe"};
    if(!this.bag.craftIronblade(id))return {type:"resource_result",action:"craft",ok:false,reason:"Requires 2 Iron Ore and 1 Wolf Fang"};
    return {type:"resource_result",action:"craft",ok:true,item:"Ironblade",amount:1};
  }
}
