import {Database} from "bun:sqlite";
export type ItemId="wolf-pelt"|"wolf-fang";
export interface InventoryItem{id:ItemId;name:string;quantity:number}
export interface InventoryView{type:"inventory";items:InventoryItem[];coins:number}
export interface RewardView{type:"reward";eventId:string;items:InventoryItem[];coins:number}
const NAMES:Record<ItemId,string>={"wolf-fang":"Wolf Fang","wolf-pelt":"Wolf Pelt"};
export class InventoryStore {
  private readonly grant;
  constructor(private readonly db:Database){
    db.exec("CREATE TABLE IF NOT EXISTS inventory_stacks(character_id TEXT NOT NULL,item_id TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>=0),PRIMARY KEY(character_id,item_id),FOREIGN KEY(character_id) REFERENCES characters(id));");
    db.exec("CREATE TABLE IF NOT EXISTS wallets(character_id TEXT PRIMARY KEY,coins INTEGER NOT NULL CHECK(coins>=0),FOREIGN KEY(character_id) REFERENCES characters(id));");
    db.exec("CREATE TABLE IF NOT EXISTS reward_receipts(event_id TEXT NOT NULL,character_id TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(event_id,character_id),FOREIGN KEY(character_id) REFERENCES characters(id));");
    const receipt=db.query("INSERT OR IGNORE INTO reward_receipts VALUES (?,?,?)");
    const item=db.query("INSERT INTO inventory_stacks VALUES (?,?,?) ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=quantity+excluded.quantity");
    const wallet=db.query("INSERT INTO wallets VALUES (?,?) ON CONFLICT(character_id) DO UPDATE SET coins=coins+excluded.coins");
    this.grant=db.transaction((eventId:string,id:string)=>{
      if(!/^wolf-kill-[0-9a-f-]{36}$/.test(eventId))throw Error("Invalid event ID");
      if(receipt.run(eventId,id,Date.now()).changes!==1)return false;
      item.run(id,"wolf-fang",1);item.run(id,"wolf-pelt",1);wallet.run(id,5);
      return true;
    });
  }
  grantWolfKill(eventId:string,id:string):RewardView|null {
    if(!this.grant(eventId,id))return null;
    return {type:"reward",eventId,items:[{id:"wolf-fang",name:"Wolf Fang",quantity:1},{id:"wolf-pelt",name:"Wolf Pelt",quantity:1}],coins:5};
  }
  read(id:string):InventoryView{
    const rows=this.db.query<{item_id:string;quantity:number},[string]>("SELECT item_id,quantity FROM inventory_stacks WHERE character_id=? ORDER BY item_id").all(id);
    const wallet=this.db.query<{coins:number},[string]>("SELECT coins FROM wallets WHERE character_id=?").get(id);
    const items:InventoryItem[]=rows.filter(r=>r.item_id==="wolf-fang"||r.item_id==="wolf-pelt").map(r=>({id:r.item_id as ItemId,name:NAMES[r.item_id as ItemId],quantity:r.quantity}));
    return {type:"inventory",items,coins:wallet?.coins??0};
  }
}
