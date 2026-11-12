import {randomUUID} from "node:crypto";
/** Deterministic server-owned starter wolf encounter; no client health or coordinates accepted. */
import type {WorldSimulation,SimPlayer} from "./simulation";

export const WOLF_ID="starter-wolf-v1";
export const MAX_HEALTH=100;
export const MAX_STAMINA=100;
export const WOLF_MAX_HEALTH=60;
export const ATTACK_COST=16;
export const DODGE_COST=26;
export const ATTACK_DAMAGE=20;
export const BITE_DAMAGE=12;
export const ATTACK_RANGE=3.25;
export const TICK_SECONDS=0.05;
export type CombatAction="attack"|"dodge";
export interface ActionPacket {type:"action";seq:number;action:CombatAction;target?:string}
export type WolfPhase="idle"|"chase"|"windup"|"strike"|"dead";
export interface WolfView {id:string;x:number;z:number;heading:number;health:number;maxHealth:number;phase:WolfPhase;windupUntil:number}
export interface VitalView {health:number;stamina:number;maxHealth:number;maxStamina:number;alive:boolean}
export interface ActionResult {type:"action_result";seq:number;action:CombatAction;ok:boolean;reason?:string;wolfHealth:number;health:number;stamina:number}
export interface CombatPlayer extends VitalView {
  attackReadyAt:number;
  dodgeReadyAt:number;
  dodgeUntil:number;
  respawnAt:number;
  lastActionSeq:number;
}
export function parseAction(raw:unknown):ActionPacket|null {
  if(!raw||typeof raw!=="object")return null;
  const p=raw as Record<string,unknown>;
  if(p.type!=="action"||typeof p.seq!=="number"||!Number.isSafeInteger(p.seq)||p.seq<0||
      (p.action!=="attack"&&p.action!=="dodge"))return null;
  if(p.target!==undefined&&(typeof p.target!=="string"||p.target!==WOLF_ID))return null;
  return {type:"action",seq:p.seq,action:p.action,target:typeof p.target==="string"?p.target:undefined};
}
function range(a:{x:number;z:number},b:{x:number;z:number}):number{
  return Math.hypot(a.x-b.x,a.z-b.z);
}
export class CombatSimulation {
  readonly players=new Map<string,CombatPlayer>();
  readonly wolf:{id:string;x:number;z:number;heading:number;health:number;phase:WolfPhase;windupUntil:number;nextAttackAt:number;respawnAt:number;targetId:string|null}={
    id:WOLF_ID,x:5,z:5,heading:0,health:WOLF_MAX_HEALTH,phase:"idle",
    windupUntil:0,nextAttackAt:0,respawnAt:0,targetId:null
  };
  time=0;
  readonly contributors=new Set<string>();
  onWolfDefeated:((eventId:string,contributors:readonly string[])=>void)|null=null;
  constructor(readonly world:WorldSimulation){}
  join(id:string):void{
    this.players.set(id,{health:MAX_HEALTH,stamina:MAX_STAMINA,maxHealth:MAX_HEALTH,maxStamina:MAX_STAMINA,
      alive:true,attackReadyAt:0,dodgeReadyAt:0,dodgeUntil:0,respawnAt:0,lastActionSeq:-1});
  }
  leave(id:string):void{
    this.players.delete(id);
    this.contributors.delete(id);
    if(this.wolf.targetId===id){this.wolf.targetId=null;this.wolf.phase="idle";}
  }
  vital(id:string):VitalView|null{
    const p=this.players.get(id);
    return p?{health:p.health,stamina:p.stamina,maxHealth:p.maxHealth,maxStamina:p.maxStamina,alive:p.alive}:null;
  }
  wolfView():WolfView{
    const w=this.wolf;
    return {id:w.id,x:w.x,z:w.z,heading:w.heading,health:w.health,maxHealth:WOLF_MAX_HEALTH,
      phase:w.phase,windupUntil:w.windupUntil};
  }
  action(id:string,raw:unknown):ActionResult|null{
    const packet=parseAction(raw),p=this.players.get(id),actor=this.world.players.get(id);
    if(!packet||!p||!actor)return null;
    const result=(ok:boolean,reason?:string):ActionResult=>({
      type:"action_result",seq:packet.seq,action:packet.action,ok,reason,
      wolfHealth:this.wolf.health,health:p.health,stamina:p.stamina
    });
    if(packet.seq<=p.lastActionSeq)return result(false,"stale action");
    p.lastActionSeq=packet.seq;
    if(!p.alive)return result(false,"you are defeated");
    if(packet.action==="dodge"){
      if(this.time<p.dodgeReadyAt)return result(false,"dodge cooling down");
      if(p.stamina<DODGE_COST)return result(false,"not enough stamina");
      p.stamina-=DODGE_COST;
      p.dodgeUntil=this.time+.6;
      p.dodgeReadyAt=this.time+.6;
      // Dodge invulnerability only. No unverified displacement accepted from client.
      return result(true);
    }
    if(packet.target!==WOLF_ID)return result(false,"invalid target");
    if(this.time<p.attackReadyAt)return result(false,"attack cooling down");
    if(p.stamina<ATTACK_COST)return result(false,"not enough stamina");
    // Costs apply to valid attacks even when out of range.
    p.stamina-=ATTACK_COST;
    p.attackReadyAt=this.time+.65;
    if(this.wolf.phase==="dead")return result(false,"wolf defeated");
    if(range(actor,this.wolf)>ATTACK_RANGE)return result(false,"target out of range");
    this.wolf.health=Math.max(0,this.wolf.health-ATTACK_DAMAGE);
    this.contributors.add(id);
    if(this.wolf.health===0){
      this.wolf.phase="dead";
      this.wolf.respawnAt=this.time+8;
      this.wolf.targetId=null;
      const eligible=[...this.contributors];
      this.contributors.clear();
      this.onWolfDefeated?.("wolf-kill-"+randomUUID(),eligible);
    }
    return result(true);
  }
  tick(dt=TICK_SECONDS):void{
    const seconds=Math.max(0,Math.min(TICK_SECONDS,dt));
    this.time+=seconds;
    for(const [id,p] of this.players){
      if(!p.alive){
        if(this.time>=p.respawnAt){
          p.health=MAX_HEALTH;p.stamina=MAX_STAMINA;p.alive=true;
          const actor=this.world.players.get(id);
          if(actor){actor.x=0;actor.z=0;actor.dx=0;actor.dz=0;}
        }
        continue;
      }
      p.stamina=Math.min(MAX_STAMINA,p.stamina+18*seconds);
    }
    const w=this.wolf;
    if(w.phase==="dead"){
      if(this.time>=w.respawnAt){
        w.x=5;w.z=5;w.heading=0;w.health=WOLF_MAX_HEALTH;w.phase="idle";
        w.nextAttackAt=this.time+1;w.targetId=null;w.windupUntil=0;this.contributors.clear();
      }
      return;
    }
    // Do not follow players more than 18m from the original den.
    if(Math.hypot(w.x-5,w.z-5)>18){w.x=5;w.z=5;w.phase="idle";w.targetId=null;}
    let closest:SimPlayer|null=null;
    for(const actor of this.world.players.values()){
      const vital=this.players.get(actor.id);
      if(!vital?.alive)continue;
      if(Math.hypot(actor.x-5,actor.z-5)>18)continue;
      if(range(actor,w)>7)continue;
      if(!closest||range(actor,w)<range(closest,w))closest=actor;
    }
    if(w.phase==="windup"){
      if(this.time<w.windupUntil)return;
      const target=w.targetId?this.world.players.get(w.targetId):undefined;
      const targetVital=w.targetId?this.players.get(w.targetId):undefined;
      if(target&&targetVital?.alive&&range(target,w)<3&&this.time>=targetVital.dodgeUntil){
        targetVital.health=Math.max(0,targetVital.health-BITE_DAMAGE);
        if(targetVital.health===0){
          targetVital.alive=false;targetVital.respawnAt=this.time+5;
          target.dx=0;target.dz=0;
        }
      }
      w.phase="strike";w.nextAttackAt=this.time+1.5;
      return;
    }
    if(!closest){w.phase="idle";w.targetId=null;return;}
    w.targetId=closest.id;
    const distance=range(closest,w);
    w.heading=Math.atan2(closest.x-w.x,closest.z-w.z);
    if(distance<2.7 && this.time>=w.nextAttackAt){
      w.phase="windup";w.windupUntil=this.time+.85;return;
    }
    w.phase=distance>2.2?"chase":"idle";
    if(distance>2.2){
      const step=Math.min(distance-2.2,seconds*.85);
      w.x+=(closest.x-w.x)/distance*step;
      w.z+=(closest.z-w.z)/distance*step;
    }
  }
}
