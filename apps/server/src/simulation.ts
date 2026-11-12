import {AOI_RADIUS,MOVEMENT_SPEED,SIMULATION_HZ,WORLD_HALF_EXTENT,validateInput,type InputMessage,type PlayerState,type SnapshotMessage} from "./protocol";

export interface SimPlayer extends PlayerState {
  dx:number;dz:number;lastSeq:number;
}
const limit=WORLD_HALF_EXTENT-2;
export function cellKey(x:number,z:number,size=AOI_RADIUS):string{
  return Math.floor(x/size)+":"+Math.floor(z/size);
}
export function stepMovement(player:SimPlayer,dt:number):void{
  const norm=Math.hypot(player.dx,player.dz);
  if(norm<.001)return;
  const factor=Math.min(1,1/norm);
  const vx=player.dx*factor,vz=player.dz*factor;
  player.x=Math.max(-limit,Math.min(limit,player.x+vx*MOVEMENT_SPEED*dt));
  player.z=Math.max(-limit,Math.min(limit,player.z+vz*MOVEMENT_SPEED*dt));
  player.heading=Math.atan2(vx,vz);
}
export class WorldSimulation {
  readonly players=new Map<string,SimPlayer>();
  tickNumber=0;
  add(id:string,name:string,x=0,z=0):SimPlayer{
    const p:SimPlayer={id,name,x:Math.max(-limit,Math.min(limit,x)),z:Math.max(-limit,Math.min(limit,z)),heading:0,dx:0,dz:0,lastSeq:-1};
    this.players.set(id,p);
    return p;
  }
  remove(id:string):SimPlayer|undefined{
    const p=this.players.get(id);this.players.delete(id);return p;
  }
  input(id:string,raw:unknown):boolean{
    const p=this.players.get(id),input=validateInput(raw);
    if(!p||!input||input.seq<=p.lastSeq)return false;
    p.dx=input.dx;p.dz=input.dz;p.lastSeq=input.seq;
    return true;
  }
  tick(dt=1/SIMULATION_HZ):void{
    const safe=Math.max(0,Math.min(1/SIMULATION_HZ,dt));
    for(const p of this.players.values())stepMovement(p,safe);
    this.tickNumber++;
  }
  snapshot(id:string):Omit<SnapshotMessage,"vitals"|"wolf">|null{
    const p=this.players.get(id);if(!p)return null;
    const nearby:PlayerState[]=[];
    for(const other of this.players.values()){
      if(other.id===id)continue;
      if(Math.abs(other.x-p.x)>AOI_RADIUS||Math.abs(other.z-p.z)>AOI_RADIUS)continue;
      if(Math.hypot(other.x-p.x,other.z-p.z)>AOI_RADIUS)continue;
      nearby.push(view(other));
    }
    return {type:"snapshot",tick:this.tickNumber,you:view(p),others:nearby,ack:p.lastSeq};
  }
}
export function view(p:SimPlayer):PlayerState{
  return {id:p.id,name:p.name,x:p.x,z:p.z,heading:p.heading};
}
