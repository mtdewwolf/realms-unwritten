import {stepMovement,type SimPlayer} from "../../../server/src/simulation";
import {MOVEMENT_SPEED} from "../../../server/src/protocol";

/**
 * Local avatar motion for the authoritative server.
 *
 * The server simulates at 20 Hz and broadcasts at 10 Hz. Copying those
 * snapshots onto the mesh (even with a fractional blend) freezes the
 * character between packets and then jumps it. This predicts with the same
 * integrator the server uses, compares each snapshot to where we were at
 * that server time, and eases only the disagreement that latency cannot
 * explain.
 */
const HISTORY=192;
const INPUTS=32;
const RTT_SAMPLES=10;
const SNAP_DISTANCE=8;
const MOVING_TOLERANCE=MOVEMENT_SPEED*0.1;
const STOPPED_TOLERANCE=0.08;
const MAX_CORRECTION_SPEED=8;
export interface Planar{x:number;z:number}
export function movementWire(dx:number,dz:number,alive:boolean):{dx:number;dz:number}{
  if(!alive)return {dx:0,dz:0};
  const norm=Math.hypot(dx,dz);
  if(!(norm>0.05)||!Number.isFinite(norm))return {dx:0,dz:0};
  const scale=Math.max(1,norm);
  return {dx:dx/scale,dz:dz/scale};
}
export class PredictedMotion{
  private x=0;
  private z=0;
  private offsetX=0;
  private offsetZ=0;
  private stopped=true;
  private rttMin=140;
  private lastDx=0;
  private lastDz=0;
  private authX=0;
  private authZ=0;
  private authAt=0;
  private readonly scratch:SimPlayer={id:"local",name:"",x:0,z:0,heading:0,dx:0,dz:0,lastSeq:0};
  private readonly authScratch:SimPlayer={id:"auth",name:"",x:0,z:0,heading:0,dx:0,dz:0,lastSeq:0};
  private readonly history=Array.from({length:HISTORY},()=>({t:0,x:0,z:0}));
  private head=0;
  private count=0;
  private readonly inputs=Array.from({length:INPUTS},()=>({seq:-1,t:0}));
  private inputCursor=0;
  private readonly rttWindow=Array.from({length:RTT_SAMPLES},()=>0);
  private rttCount=0;
  private rttCursor=0;
  private readonly sampleOut:Planar={x:0,z:0};
  reset(x:number,z:number,now:number):void{
    this.x=x;this.z=z;this.offsetX=0;this.offsetZ=0;this.stopped=true;
    this.lastDx=0;this.lastDz=0;this.authX=x;this.authZ=z;this.authAt=now;
    this.head=0;this.count=0;
    this.push(now,x,z);
  }
  noteInput(seq:number,now:number):void{
    const slot=this.inputs[this.inputCursor];
    slot.seq=seq;slot.t=now;
    this.inputCursor=(this.inputCursor+1)%INPUTS;
  }
  predict(dx:number,dz:number,dt:number,now:number):void{
    this.lastDx=dx;this.lastDz=dz;
    this.stopped=Math.hypot(dx,dz)<0.05;
    this.scratch.x=this.x;this.scratch.z=this.z;this.scratch.dx=dx;this.scratch.dz=dz;this.scratch.heading=0;
    stepMovement(this.scratch,dt);
    this.x=this.scratch.x;this.z=this.scratch.z;
    this.push(now,this.x,this.z);
  }
  /** Latest pose, plus any correction that is still being eased in. */
  renderPose():Planar{return {x:this.x+this.offsetX,z:this.z+this.offsetZ};}
  writeRender(out:Planar):void{out.x=this.x+this.offsetX;out.z=this.z+this.offsetZ;}
  /**
   * Where the server most likely has us right now. Starts from the last
   * snapshot and steps the held command across the one-way delay, so gather
   * checks the authoritative body rather than the leading mesh.
   */
  serverPose(now:number):Planar{
    const elapsed=Math.max(0,Math.min(0.25,(now-this.authAt)/1000));
    this.authScratch.x=this.authX;this.authScratch.z=this.authZ;
    this.authScratch.dx=this.lastDx;this.authScratch.dz=this.lastDz;this.authScratch.heading=0;
    stepMovement(this.authScratch,elapsed);
    return {x:this.authScratch.x,z:this.authScratch.z};
  }
  reconcile(now:number,sx:number,sz:number,ack:number):void{
    if(!Number.isFinite(sx)||!Number.isFinite(sz))return;
    this.observeRtt(now,ack);
    this.sample(now-this.lookback(),this.sampleOut);
    const ex=sx-this.sampleOut.x,ez=sz-this.sampleOut.z;
    const dist=Math.hypot(ex,ez);
    this.authX=sx;this.authZ=sz;this.authAt=now-this.lookback();
    if(dist>SNAP_DISTANCE){
      this.x=sx;this.z=sz;this.offsetX=0;this.offsetZ=0;
      this.head=0;this.count=0;this.push(now,sx,sz);
      return;
    }
    const tolerance=this.stopped?STOPPED_TOLERANCE:MOVING_TOLERANCE;
    if(dist<=tolerance)return;
    const excess=dist-tolerance;
    const cx=ex/dist*excess,cz=ez/dist*excess;
    this.x+=cx;this.z+=cz;
    this.offsetX-=cx;this.offsetZ-=cz;
    this.shift(now-this.lookback(),cx,cz);
  }
  smooth(dt:number):void{
    const dist=Math.hypot(this.offsetX,this.offsetZ);
    if(dist<1e-4){this.offsetX=0;this.offsetZ=0;return;}
    const step=Math.min(dist,MAX_CORRECTION_SPEED*Math.max(0,dt));
    this.offsetX-=this.offsetX/dist*step;
    this.offsetZ-=this.offsetZ/dist*step;
  }
  private lookback():number{return Math.max(20,Math.min(220,this.rttMin/2));}
  private observeRtt(now:number,ack:number):void{
    let sent:number|undefined;
    for(const input of this.inputs)if(input.seq===ack)sent=input.t;
    if(sent===undefined)return;
    const sample=now-sent;
    if(sample<30||sample>500)return;
    this.rttWindow[this.rttCursor]=sample;
    this.rttCursor=(this.rttCursor+1)%RTT_SAMPLES;
    if(this.rttCount<RTT_SAMPLES)this.rttCount++;
    let min=this.rttWindow[0];
    for(let i=1;i<this.rttCount;i++)if(this.rttWindow[i]<min)min=this.rttWindow[i];
    this.rttMin=min;
  }
  private push(t:number,x:number,z:number):void{
    const s=this.history[this.head];
    s.t=t;s.x=x;s.z=z;
    this.head=(this.head+1)%HISTORY;
    if(this.count<HISTORY)this.count++;
  }
  private sample(t:number,out:Planar):void{
    if(this.count===0){out.x=this.x;out.z=this.z;return;}
    const first=this.at(0);
    if(t<=first.t){out.x=first.x;out.z=first.z;return;}
    const last=this.at(this.count-1);
    if(t>=last.t){out.x=last.x;out.z=last.z;return;}
    for(let i=1;i<this.count;i++){
      const b=this.at(i);
      if(b.t<t)continue;
      const a=this.at(i-1);
      const u=(t-a.t)/Math.max(1,b.t-a.t);
      out.x=a.x+(b.x-a.x)*u;out.z=a.z+(b.z-a.z)*u;return;
    }
    out.x=last.x;out.z=last.z;
  }
  private at(index:number):{t:number;x:number;z:number}{
    return this.history[(this.head-this.count+index+HISTORY)%HISTORY];
  }
  private shift(since:number,cx:number,cz:number):void{
    for(let i=0;i<this.count;i++){
      const s=this.at(i);
      if(s.t>=since){s.x+=cx;s.z+=cz;}
    }
  }
}
