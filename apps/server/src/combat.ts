import {randomUUID} from "node:crypto";
/** Deterministic server-owned starter wolf encounter; no client health or coordinates accepted. */
import {moveWithCollision} from "../../client/src/world/collision";
import type {WorldSimulation,SimPlayer} from "./simulation";
import type {ClassId} from "../../shared/src/characterCatalog";
import {ABILITY_SPECS,classOwnsAbility,isClassAbility,type AbilitySpec,type ClassAbility} from "../../shared/src/classAbilities";
import type {AbilityScout,ClassAbilityResult} from "./protocol";

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
export type {ClassAbility};
export interface AbilityPacket{type:"ability";seq:number;ability:ClassAbility;target?:string;damage?:never}
export type AbilityResult=ClassAbilityResult;
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
  abilityReadyAt:Partial<Record<ClassAbility,number>>;
  bulwarkUntil:number;
  wardUntil:number;
  veilUntil:number;
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
  resolveAttackDamage:((characterId:string)=>number)|null=null;
  resolveClass:((characterId:string)=>ClassId|null)|null=null;
  constructor(readonly world:WorldSimulation){}
  join(id:string):void{
    this.players.set(id,{health:MAX_HEALTH,stamina:MAX_STAMINA,maxHealth:MAX_HEALTH,maxStamina:MAX_STAMINA,
      alive:true,attackReadyAt:0,dodgeReadyAt:0,dodgeUntil:0,respawnAt:0,lastActionSeq:-1,abilityReadyAt:{},bulwarkUntil:0,wardUntil:0,veilUntil:0});
  }
  leave(id:string):void{
    this.players.delete(id);
    this.contributors.delete(id);
    if(this.wolf.targetId===id){this.wolf.targetId=null;this.wolf.phase="idle";}
  }
  canHeal(id:string):boolean{
    const p=this.players.get(id);
    return !!p&&p.alive&&p.health>0&&p.health<MAX_HEALTH;
  }
  heal(id:string,amount:number):VitalView|null{
    if(!this.canHeal(id)||!Number.isFinite(amount)||amount<=0)return null;
    const p=this.players.get(id)!;
    p.health=Math.min(MAX_HEALTH,p.health+amount);
    return this.vital(id);
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
    p.veilUntil=0;
    if(this.wolf.phase==="dead")return result(false,"wolf defeated");
    if(range(actor,this.wolf)>ATTACK_RANGE)return result(false,"target out of range");
    const damage=this.resolveAttackDamage?.(id)??ATTACK_DAMAGE;
    this.damageWolf(id,damage);
    return result(true);
  }
  private damageWolf(id:string,damage:number):void{
    this.wolf.health=Math.max(0,this.wolf.health-Math.max(1,Math.min(100,Math.floor(damage))));
    this.contributors.add(id);
    if(this.wolf.health===0){
      this.wolf.phase="dead";
      this.wolf.respawnAt=this.time+8;
      this.wolf.targetId=null;
      const eligible=[...this.contributors];
      this.contributors.clear();
      this.onWolfDefeated?.("wolf-kill-"+randomUUID(),eligible);
    }
  }
  useAbility(id:string,raw:unknown):AbilityResult|null{
    const packet=this.parseAbility(raw);
    const p=this.players.get(id),actor=this.world.players.get(id);
    if(!packet||!p||!actor)return null;
    const ability=packet.ability;
    const result=(ok:boolean,reason?:string,extra?:Partial<AbilityResult>):AbilityResult=>({
      type:"ability_result",seq:packet.seq,ability,ok,...(reason?{reason}:{}),
      wolfHealth:this.wolf.health,health:p.health,stamina:p.stamina,
      cooldownSeconds:Math.max(0,(p.abilityReadyAt[ability]??0)-this.time),
      ...extra
    });
    if(packet.seq<=p.lastActionSeq)return result(false,"stale action");
    p.lastActionSeq=packet.seq;
    if(!p.alive)return result(false,"you are defeated");
    const cls=this.resolveClass?.(id);
    if(!cls||!classOwnsAbility(cls,ability))return result(false,"ability unavailable to this class");
    if(this.time<(p.abilityReadyAt[ability]??0))return result(false,"ability cooling down");
    const spec=ABILITY_SPECS[ability];
    if(p.stamina<spec.stamina)return result(false,"not enough stamina");
    // Damage, heal, duration, and destination on the packet are ignored.
    const planned=this.planAbility(id,actor,spec,packet.target);
    if("error" in planned)return result(false,planned.error);
    p.stamina-=spec.stamina;
    p.abilityReadyAt[ability]=this.time+spec.cooldown;
    if(planned.breakVeil)p.veilUntil=0;
    if(planned.barrier)p.bulwarkUntil=this.time+(spec.duration??0);
    if(planned.veil)p.veilUntil=this.time+(spec.duration??0);
    if(planned.wardId){
      const ward=this.players.get(planned.wardId);
      if(ward)ward.wardUntil=this.time+(spec.duration??0);
    }
    let position:AbilityResult["position"];
    if(planned.dash)position=this.shadeStep(actor,spec.stopDistance??ATTACK_RANGE,true);
    if(planned.damage)this.damageWolf(id,planned.damage);
    let healedHealth:number|undefined;
    if(planned.healId){
      const patient=this.players.get(planned.healId);
      if(patient){
        patient.health=Math.min(patient.maxHealth,patient.health+(spec.heal??0));
        healedHealth=patient.health;
      }
    }
    const subjectId=planned.healId??planned.wardId;
    return result(true,undefined,{
      ...(subjectId?{subjectId,subjectSelf:subjectId===id}:{}),
      ...(planned.healId?{healedId:planned.healId,healedHealth}:{}),
      ...(position?{position}:{}),
      ...(planned.scout?{scout:planned.scout}:{})
    });
  }
  private parseAbility(raw:unknown):{seq:number;ability:ClassAbility;target?:string}|null{
    if(!raw||typeof raw!=="object")return null;
    const packet=raw as Record<string,unknown>;
    if(packet.type!=="ability"||typeof packet.seq!=="number"||!Number.isSafeInteger(packet.seq)||packet.seq<0)return null;
    if(!isClassAbility(packet.ability))return null;
    if(packet.target!==undefined&&(typeof packet.target!=="string"||!/^[\w-]{1,64}$/.test(packet.target)))return null;
    return {seq:packet.seq,ability:packet.ability,...(typeof packet.target==="string"?{target:packet.target}:{})};
  }
  private veiled(id:string):boolean{
    const vital=this.players.get(id);
    return !!vital&&this.time<vital.veilUntil;
  }
  private incomingBite(vital:CombatPlayer):number{
    if(this.time<vital.bulwarkUntil)return Math.ceil(BITE_DAMAGE/2);
    const reduction=ABILITY_SPECS["aether-ward"].biteReduction??0;
    if(this.time<vital.wardUntil)return Math.max(1,BITE_DAMAGE-reduction);
    return BITE_DAMAGE;
  }
  private wolfRangeError(actor:{x:number;z:number},maxRange:number):string|null{
    if(this.wolf.phase==="dead")return "wolf defeated";
    if(range(actor,this.wolf)>maxRange)return "target out of range";
    return null;
  }
  private shadeStep(actor:SimPlayer,stopDistance:number,commit:boolean):{x:number;z:number}{
    const dist=range(actor,this.wolf);
    let x=actor.x,z=actor.z;
    if(dist>stopDistance&&dist>0.001){
      const travel=dist-stopDistance;
      const next=moveWithCollision(actor.x,actor.z,(this.wolf.x-actor.x)/dist*travel,(this.wolf.z-actor.z)/dist*travel);
      x=next.x;z=next.z;
    }
    if(commit){
      actor.x=x;actor.z=z;
      actor.heading=Math.atan2(this.wolf.x-x,this.wolf.z-z);
    }
    return {x,z};
  }
  private supportTarget(casterId:string,actor:SimPlayer,requested:string|undefined,maxRange:number,requireInjured:boolean):{id:string}|{error:string}{
    if(requested!==undefined){
      const other=this.world.players.get(requested);
      const vital=this.players.get(requested);
      if(!other||!vital)return {error:"target unavailable"};
      if(!vital.alive)return {error:"target defeated"};
      if(requested!==casterId&&range(actor,other)>maxRange)return {error:"target out of range"};
      if(requireInjured&&vital.health>=vital.maxHealth)return {error:"no one needs mending"};
      return {id:requested};
    }
    let best:{id:string;health:number;dist:number;self:boolean}|null=null;
    for(const other of this.world.players.values()){
      const vital=this.players.get(other.id);
      if(!vital?.alive||vital.health>=vital.maxHealth)continue;
      const dist=other.id===casterId?0:range(actor,other);
      if(dist>maxRange)continue;
      const self=other.id===casterId;
      if(!best||vital.health<best.health||(vital.health===best.health&&self!==best.self&&!self)||(vital.health===best.health&&self===best.self&&dist<best.dist))
        best={id:other.id,health:vital.health,dist,self};
    }
    if(best)return {id:best.id};
    if(!requireInjured)return {id:casterId};
    return {error:"no one needs mending"};
  }
  private planAbility(id:string,actor:SimPlayer,spec:AbilitySpec,target?:string):{error:string}|{damage?:number;healId?:string;wardId?:string;barrier?:boolean;veil?:boolean;dash?:boolean;breakVeil?:boolean;scout?:AbilityScout}{
    switch(spec.kind){
      case "barrier":return {barrier:true};
      case "bolt":
      case "area":
      case "strike":{
        const blocked=this.wolfRangeError(actor,spec.range??0);
        if(blocked)return {error:blocked};
        if(!spec.damage)return {error:"ability unavailable to this class"};
        return {damage:spec.damage,breakVeil:true};
      }
      case "dash":{
        const blocked=this.wolfRangeError(actor,spec.range??0);
        if(blocked)return {error:blocked};
        const landing=this.shadeStep(actor,spec.stopDistance??ATTACK_RANGE,false);
        if(range(landing,this.wolf)>ATTACK_RANGE)return {error:"path blocked"};
        if(!spec.damage)return {error:"ability unavailable to this class"};
        return {dash:true,damage:spec.damage,breakVeil:true};
      }
      case "heal":{
        const picked=this.supportTarget(id,actor,target,spec.range??0,true);
        if("error" in picked)return picked;
        return {healId:picked.id};
      }
      case "ward":{
        const picked=this.supportTarget(id,actor,target,spec.range??0,false);
        if("error" in picked)return picked;
        return {wardId:picked.id};
      }
      case "stealth":return {veil:true};
      case "scout":return {scout:this.scoutPulse(id,actor,spec)};
      default:{
        const unexpected:never=spec.kind;
        throw new Error("Unhandled ability kind "+unexpected);
      }
    }
  }
  private scoutPulse(id:string,actor:SimPlayer,spec:AbilitySpec):AbilityScout{
    const wolfDist=range(actor,this.wolf);
    const wolfSeen=this.wolf.phase!=="dead"&&wolfDist<=(spec.range??0);
    let allies=0;
    const allyRange=spec.allyRange??0;
    for(const other of this.world.players.values()){
      if(other.id===id)continue;
      const vital=this.players.get(other.id);
      if(vital?.alive&&range(actor,other)<=allyRange)allies++;
    }
    return {
      wolf:wolfSeen?{x:this.wolf.x,z:this.wolf.z,distance:Math.round(wolfDist*10)/10}:null,
      allies
    };
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
      if(!vital?.alive||this.veiled(actor.id))continue;
      if(Math.hypot(actor.x-5,actor.z-5)>18)continue;
      if(range(actor,w)>7)continue;
      if(!closest||range(actor,w)<range(closest,w))closest=actor;
    }
    if(w.phase==="windup"){
      if(w.targetId&&this.veiled(w.targetId)){w.phase="idle";w.targetId=null;w.windupUntil=0;}
      else if(this.time<w.windupUntil)return;
      else{
        const target=w.targetId?this.world.players.get(w.targetId):undefined;
        const targetVital=w.targetId?this.players.get(w.targetId):undefined;
        if(target&&targetVital?.alive&&range(target,w)<3&&this.time>=targetVital.dodgeUntil){
          targetVital.health=Math.max(0,targetVital.health-this.incomingBite(targetVital));
          if(targetVital.health===0){
            targetVital.alive=false;targetVital.respawnAt=this.time+5;
            target.dx=0;target.dz=0;
          }
        }
        w.phase="strike";w.nextAttackAt=this.time+1.5;
        return;
      }
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
