import * as THREE from "three";
import {createAdventurer} from "../characters/rig";
import {WORLD_HALF_SIZE} from "../world/chunkedWorld";
import type {InventoryState,RewardEvent} from "../ui/inventory";
import type {QuestState,QuestResult} from "../ui/quests";
import type {ProgressionState} from "../ui/character";

interface PlayerState{id:string;name:string;x:number;z:number;heading:number}
export interface ServerWolf{id:string;x:number;z:number;heading:number;health:number;maxHealth:number;phase:"idle"|"chase"|"windup"|"strike"|"dead";windupUntil:number}
export interface ServerVitals{health:number;stamina:number;maxHealth:number;maxStamina:number;alive:boolean}
interface Snapshot{type:"snapshot";tick:number;you:PlayerState;others:PlayerState[];ack:number;vitals:ServerVitals;wolf:ServerWolf|null}
export interface CombatActionResult{type:"action_result";seq:number;action:"attack"|"dodge";ok:boolean;reason?:string;wolfHealth:number;health:number;stamina:number}
type ServerMessage={type:"equip_result";ok:boolean;reason?:string}|{type:"welcome";protocol:number;id:string;token:string;player:PlayerState}|Snapshot|CombatActionResult|InventoryState|RewardEvent|QuestState|QuestResult|ProgressionState|{type:"error";message:string};
export interface MovementInput{dx:number;dz:number}
const TOKEN_KEY="realms-unwritten-guest-token-v1";
function storedToken():string|null{try{return localStorage.getItem(TOKEN_KEY);}catch{return null;}}
function saveToken(t:string):void{try{localStorage.setItem(TOKEN_KEY,t);}catch{/* volatile guest */}}
export class MultiplayerClient {
  private socket:WebSocket|null=null;
  private id:string|null=null;
  private sequence=0;
  private actionSequence=0;
  private readonly others=new Map<string,{mesh:THREE.Group;target:PlayerState}>();
  private lastSend=0;
  private online=false;
  constructor(private readonly scene:THREE.Scene,private readonly avatar:THREE.Group,private readonly status:(s:string)=>void,private readonly onCombat:(vitals:ServerVitals,wolf:ServerWolf|null)=>void,private readonly onActionResult:(result:CombatActionResult)=>void,private readonly onOffline:()=>void,private readonly onInventory:(state:InventoryState)=>void,private readonly onReward:(event:RewardEvent)=>void,private readonly onQuest:(quest:QuestState)=>void,private readonly onQuestResult:(result:QuestResult)=>void,private readonly onProgression:(state:ProgressionState)=>void){}
  get connected():boolean{return this.online&&this.socket?.readyState===WebSocket.OPEN;}
  connect(url:string):void{
    this.disconnect();
    this.sequence=0;this.actionSequence=0;this.lastSend=0;
    if(!/^wss?:\/\/\S+$/i.test(url)){this.status("Enter a valid ws:// or wss:// server URL");return;}
    this.status("Connecting to multiplayer server…");
    const ws=new WebSocket(url);
    this.socket=ws;
    ws.onopen=()=>ws.send(JSON.stringify({type:"hello",token:storedToken()||undefined,name:"Adventurer"}));
    ws.onmessage=event=>{
      let message:ServerMessage;
      try{message=JSON.parse(String(event.data)) as ServerMessage;}catch{return;}
      if(message.type==="error"){this.status(message.message);return;}
      if(message.type==="welcome"){
        if(message.protocol!==6){ws.close();this.status("Incompatible server protocol");return;}
        this.id=message.id;saveToken(message.token);this.online=true;
        this.avatar.position.x=message.player.x;this.avatar.position.z=message.player.z;
        this.status("Online · authoritative movement connected");return;
      }
      if(message.type==="progression"){this.onProgression(message);return;}
      if(message.type==="quest_status"){this.onQuest(message);return;}
      if(message.type==="quest_result"){this.onQuestResult(message);return;}
      if(message.type==="equip_result"){this.status(message.ok?"Weapon equipped":message.reason??"Equipment change rejected");return;}
      if(message.type==="inventory"){this.onInventory(message);return;}
      if(message.type==="reward"){this.onReward(message);return;}
      if(message.type==="action_result"){this.onActionResult(message);return;}
      if(message.type==="snapshot" && this.online){
        this.onCombat(message.vitals,message.wolf);
        const {you,others}=message;
        // Smooth small reconciliation errors; snap only after larger divergence.
        const delta=Math.hypot(this.avatar.position.x-you.x,this.avatar.position.z-you.z);
        const blend=delta>8?1:.28;
        this.avatar.position.x+=(you.x-this.avatar.position.x)*blend;
        this.avatar.position.z+=(you.z-this.avatar.position.z)*blend;
        const visible=new Set<string>();
        for(const other of others){
          if(other.id===this.id)continue;
          visible.add(other.id);
          let entry=this.others.get(other.id);
          if(!entry){
            const mesh=createAdventurer().root;
            mesh.position.set(other.x,0,other.z);
            this.scene.add(mesh);
            entry={mesh,target:other};this.others.set(other.id,entry);
          }
          entry.target=other;
        }
        for(const [id,entry] of this.others)if(!visible.has(id)){
          this.scene.remove(entry.mesh);this.others.delete(id);
        }
      }
    };
    ws.onerror=()=>this.status("Multiplayer connection unavailable");
    ws.onclose=()=>{
      if(this.socket!==ws)return;
      this.online=false;this.id=null;this.status("Offline · local exploration mode");
      this.onOffline();
      for(const entry of this.others.values())this.scene.remove(entry.mesh);
      this.others.clear();
    };
  }
  sendQuest(action:"status"|"accept"|"turnin"):boolean{
    if(!this.connected)return false;
    this.socket!.send(JSON.stringify({type:"quest",action,id:"verdant-wolf-hunt"}));
    return true;
  }
  requestProgression():boolean{
    if(!this.connected)return false;
    this.socket!.send(JSON.stringify({type:"progression"}));
    return true;
  }
  sendEquip(item:"starter-sword"|"fangblade"):boolean{
    if(!this.connected)return false;
    this.socket!.send(JSON.stringify({type:"equip",item}));return true;
  }
  requestInventory():boolean{
    if(!this.connected)return false;
    this.socket!.send(JSON.stringify({type:"inventory"}));
    return true;
  }
  sendAction(action:"attack"|"dodge"):boolean{
    if(!this.connected)return false;
    this.socket!.send(JSON.stringify({type:"action",seq:++this.actionSequence,action,target:action==="attack"?"starter-wolf-v1":undefined}));
    return true;
  }
  sendMovement(input:MovementInput,now:number):void{
    if(!this.connected||now-this.lastSend<50)return;
    const norm=Math.max(1,Math.hypot(input.dx,input.dz));
    this.socket!.send(JSON.stringify({type:"input",seq:++this.sequence,dx:input.dx/norm,dz:input.dz/norm}));
    this.lastSend=now;
  }
  update(dt:number,groundHeightAt:(x:number,z:number)=>number):void{
    for(const entry of this.others.values()){
      const p=entry.target;
      const smoothing=Math.min(1,dt*12);
      entry.mesh.position.x+=(p.x-entry.mesh.position.x)*smoothing;
      entry.mesh.position.z+=(p.z-entry.mesh.position.z)*smoothing;
      entry.mesh.position.y=groundHeightAt(entry.mesh.position.x,entry.mesh.position.z);
      entry.mesh.rotation.y=p.heading;
    }
  }
  disconnect():void{
    const ws=this.socket;this.socket=null;this.online=false;this.id=null;
    this.onOffline();
    if(ws){ws.onclose=null;ws.close();}
    for(const entry of this.others.values())this.scene.remove(entry.mesh);
    this.others.clear();
  }
}
