/** Wire format v1. Do not treat client messages as authoritative positions. */
export const PROTOCOL_VERSION=8;
export const MOVEMENT_SPEED=5.5;
export const WORLD_HALF_EXTENT=8192;
export const AOI_RADIUS=160;
export const SIMULATION_HZ=20;
export const SNAPSHOT_HZ=10;
export interface InputMessage {type:"input";seq:number;dx:number;dz:number}
export interface HelloMessage {type:"hello";token?:string;name?:string}
export type CombatActionMessage={type:"action";seq:number;action:"attack"|"dodge";target?:string};
export type ClientMessage=InputMessage|HelloMessage|CombatActionMessage|{type:"inventory"}|{type:"progression"}|{type:"equip";item:"starter-sword"|"fangblade"|"ironblade"}|{type:"use";item:"healing-tonic"}|{type:"gather"}|{type:"craft";recipe:"ironblade"|"healing-tonic"}|{type:"quest";action:"status"|"accept"|"turnin";id?:"verdant-wolf-hunt"};
export interface PlayerState {id:string;name:string;x:number;z:number;heading:number}
export interface WelcomeMessage {type:"welcome";protocol:8;id:string;token:string;player:PlayerState}
export interface CombatVital {health:number;stamina:number;maxHealth:number;maxStamina:number;alive:boolean}
export interface CombatWolf {id:string;x:number;z:number;heading:number;health:number;maxHealth:number;phase:"idle"|"chase"|"windup"|"strike"|"dead";windupUntil:number}
export interface SnapshotMessage {type:"snapshot";tick:number;you:PlayerState;others:PlayerState[];ack:number;vitals:CombatVital;wolf:CombatWolf|null}
export type CombatActionResult={type:"action_result";seq:number;action:"attack"|"dodge";ok:boolean;reason?:string;wolfHealth:number;health:number;stamina:number};
export interface InventoryItem{id:"wolf-pelt"|"wolf-fang"|"fangblade"|"iron-ore"|"ironblade"|"moonleaf"|"healing-tonic";name:string;quantity:number}
export interface EquippedWeapon{id:"starter-sword"|"fangblade"|"ironblade";name:string;bonusDamage:number}
export interface InventoryMessage{type:"inventory";items:InventoryItem[];coins:number;equipped:EquippedWeapon}
export interface EquipResult{type:"equip_result";ok:boolean;reason?:string}
export interface RewardMessage{type:"reward";eventId:string;items:InventoryItem[];coins:number}
export interface QuestStatusMessage{type:"quest_status";id:"verdant-wolf-hunt";title:string;stage:"available"|"active"|"ready"|"completed";kills:number;required:number;rewardCoins:number}
export interface QuestResultMessage{type:"quest_result";action:"status"|"accept"|"turnin";ok:boolean;reason?:string}
export interface ProgressionMessage{type:"progression";xp:number;level:number;nextLevelXp:number|null;attributes:{strength:number;vitality:number;agility:number}}
export interface ResourceResultMessage{type:"resource_result";action:"gather"|"craft";ok:boolean;reason?:string;nodeId?:string;item?:string;amount?:number;retryAfterMs?:number;resource?:"ore"|"moonleaf"|"tonic"}
export interface UseResultMessage{type:"use_result";ok:boolean;reason?:string;item?:string;health?:number}
export type ServerMessage=WelcomeMessage|SnapshotMessage|CombatActionResult|InventoryMessage|RewardMessage|QuestStatusMessage|QuestResultMessage|ProgressionMessage|EquipResult|ResourceResultMessage|UseResultMessage|{type:"error";message:string};
export function validateInput(input:unknown):InputMessage|null{
  if(!input||typeof input!=="object")return null;
  const m=input as Record<string,unknown>;
  if(m.type!=="input"||typeof m.seq!=="number"||!Number.isSafeInteger(m.seq)||m.seq<0||typeof m.dx!=="number"||typeof m.dz!=="number"||!Number.isFinite(m.dx)||!Number.isFinite(m.dz))return null;
  if(typeof m.dx!=="number"||typeof m.dz!=="number"||Math.abs(m.dx)>1.01||Math.abs(m.dz)>1.01)return null;
  return {type:"input",seq:m.seq as number,dx:m.dx,dz:m.dz};
}
export function validateHello(input:unknown):HelloMessage|null{
  if(!input||typeof input!=="object")return null;
  const m=input as Record<string,unknown>;
  if(m.type!=="hello")return null;
  if(m.token!==undefined&&(typeof m.token!=="string"||!/^[-\w]{20,120}$/.test(m.token)))return null;
  if(m.name!==undefined&&(typeof m.name!=="string"||m.name.length>24))return null;
  const name=typeof m.name==="string"?m.name.trim().replace(/[^\p{L}\p{N} _-]/gu,"").slice(0,24):undefined;
  return {type:"hello",...(typeof m.token==="string"?{token:m.token}:{}),...(name?{name}:{})};
}
