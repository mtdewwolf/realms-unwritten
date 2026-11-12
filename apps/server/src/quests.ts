import { Database } from "bun:sqlite";
import type { ProgressionStore } from "./progression";

export const WOLF_HUNT_ID="verdant-wolf-hunt";
export const GUARD_X=2;
export const GUARD_Z=-3;
export const GUARD_RANGE=6;
export const WOLF_HUNT_REQUIRED=3;
export const WOLF_HUNT_COINS=25;
export type QuestStage="available"|"active"|"ready"|"completed";
export type QuestCommand="status"|"accept"|"turnin";
export interface QuestStatus{
  type:"quest_status";
  id:typeof WOLF_HUNT_ID;
  title:string;
  stage:QuestStage;
  kills:number;
  required:number;
  rewardCoins:number;
}
export interface QuestResult{
  type:"quest_result";
  action:QuestCommand;
  ok:boolean;
  reason?:string;
}
export function parseQuestCommand(raw:unknown):QuestCommand|null{
  if(!raw||typeof raw!=="object")return null;
  const p=raw as Record<string,unknown>;
  if(p.type!=="quest"||(p.action!=="status"&&p.action!=="accept"&&p.action!=="turnin"))return null;
  if(p.id!==undefined&&p.id!==WOLF_HUNT_ID)return null;
  return p.action;
}
export function closeToGuard(x:number,z:number):boolean{
  return Number.isFinite(x)&&Number.isFinite(z)&&Math.hypot(x-GUARD_X,z-GUARD_Z)<=GUARD_RANGE;
}
type ProgressRow={stage:"active"|"ready"|"completed";kills:number};
export class QuestStore {
  private readonly acceptTx;
  private readonly killTx;
  private readonly turninTx;
  constructor(private readonly db:Database,private readonly progression?:ProgressionStore){
    db.exec("CREATE TABLE IF NOT EXISTS quest_progress(character_id TEXT NOT NULL,quest_id TEXT NOT NULL,stage TEXT NOT NULL CHECK(stage IN ('active','ready','completed')),kills INTEGER NOT NULL DEFAULT 0 CHECK(kills>=0 AND kills<=3),PRIMARY KEY(character_id,quest_id),FOREIGN KEY(character_id) REFERENCES characters(id));");
    db.exec("CREATE TABLE IF NOT EXISTS quest_kill_receipts(character_id TEXT NOT NULL,quest_id TEXT NOT NULL,event_id TEXT NOT NULL,PRIMARY KEY(character_id,quest_id,event_id),FOREIGN KEY(character_id) REFERENCES characters(id));");
    const read=db.query<ProgressRow,[string,string]>("SELECT stage,kills FROM quest_progress WHERE character_id=? AND quest_id=?");
    const create=db.query("INSERT OR IGNORE INTO quest_progress(character_id,quest_id,stage,kills) VALUES (?,?,'active',0)");
    const receipt=db.query("INSERT OR IGNORE INTO quest_kill_receipts(character_id,quest_id,event_id) VALUES (?,?,?)");
    const increase=db.query("UPDATE quest_progress SET kills=MIN(3,kills+1),stage=CASE WHEN kills+1>=3 THEN 'ready' ELSE 'active' END WHERE character_id=? AND quest_id=? AND stage='active'");
    const complete=db.query("UPDATE quest_progress SET stage='completed' WHERE character_id=? AND quest_id=? AND stage='ready'");
    const wallet=db.query("INSERT INTO wallets(character_id,coins) VALUES (?,?) ON CONFLICT(character_id) DO UPDATE SET coins=coins+excluded.coins");
    this.acceptTx=db.transaction((id:string)=>create.run(id,WOLF_HUNT_ID).changes===1);
    this.killTx=db.transaction((id:string,eventId:string)=>{
      const row=read.get(id,WOLF_HUNT_ID);
      if(!row||row.stage!=="active")return false;
      if(receipt.run(id,WOLF_HUNT_ID,eventId).changes!==1)return false;
      increase.run(id,WOLF_HUNT_ID);
      return true;
    });
    this.turninTx=db.transaction((id:string)=>{
      if(complete.run(id,WOLF_HUNT_ID).changes!==1)return false;
      wallet.run(id,WOLF_HUNT_COINS);
      if(this.progression&&!this.progression.grantQuest(id))throw new Error("Quest progression receipt already exists");
      return true;
    });
  }
  status(id:string):QuestStatus{
    const row=this.db.query<ProgressRow,[string,string]>("SELECT stage,kills FROM quest_progress WHERE character_id=? AND quest_id=?").get(id,WOLF_HUNT_ID);
    return {type:"quest_status",id:WOLF_HUNT_ID,title:"Wolf Hunt",stage:row?.stage??"available",kills:row?.kills??0,required:WOLF_HUNT_REQUIRED,rewardCoins:WOLF_HUNT_COINS};
  }
  accept(id:string):boolean{return this.acceptTx(id);}
  recordWolfKill(id:string,eventId:string):boolean{return this.killTx(id,eventId);}
  turnin(id:string):boolean{return this.turninTx(id);}
}
