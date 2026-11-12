/** Wire format v1. Do not treat client messages as authoritative positions. */
export const PROTOCOL_VERSION=3;
export const MOVEMENT_SPEED=5.5;
export const WORLD_HALF_EXTENT=8192;
export const AOI_RADIUS=160;
export const SIMULATION_HZ=20;
export const SNAPSHOT_HZ=10;
export interface InputMessage {type:"input";seq:number;dx:number;dz:number}
export interface HelloMessage {type:"hello";token?:string;name?:string}
export type CombatActionMessage={type:"action";seq:number;action:"attack"|"dodge";target?:string};
export type ClientMessage=InputMessage|HelloMessage|CombatActionMessage|{type:"inventory"};
export interface PlayerState {id:string;name:string;x:number;z:number;heading:number}
export interface WelcomeMessage {type:"welcome";protocol:3;id:string;token:string;player:PlayerState}
export interface CombatVital {health:number;stamina:number;maxHealth:number;maxStamina:number;alive:boolean}
export interface CombatWolf {id:string;x:number;z:number;heading:number;health:number;maxHealth:number;phase:"idle"|"chase"|"windup"|"strike"|"dead";windupUntil:number}
export interface SnapshotMessage {type:"snapshot";tick:number;you:PlayerState;others:PlayerState[];ack:number;vitals:CombatVital;wolf:CombatWolf|null}
export type CombatActionResult={type:"action_result";seq:number;action:"attack"|"dodge";ok:boolean;reason?:string;wolfHealth:number;health:number;stamina:number};
export interface InventoryItem{id:"wolf-pelt"|"wolf-fang";name:string;quantity:number}
export interface InventoryMessage{type:"inventory";items:InventoryItem[];coins:number}
export interface RewardMessage{type:"reward";eventId:string;items:InventoryItem[];coins:number}
export type ServerMessage=WelcomeMessage|SnapshotMessage|CombatActionResult|InventoryMessage|RewardMessage|{type:"error";message:string};
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
