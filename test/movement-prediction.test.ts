import {describe,expect,test} from "bun:test";
import {PredictedMotion,movementWire} from "../apps/client/src/multiplayer/prediction";
import {WorldSimulation} from "../apps/server/src/simulation";
import {MOVEMENT_SPEED,validateInput} from "../apps/server/src/protocol";

describe("movement command shared by prediction and the server",()=>{
  test("dead, tiny and over-length sticks become the vector the server will accept",()=>{
    expect(movementWire(1,0,false)).toEqual({dx:0,dz:0});
    expect(movementWire(0.02,-0.02,true)).toEqual({dx:0,dz:0});
    const diagonal=movementWire(3,4,true);
    expect(Math.hypot(diagonal.dx,diagonal.dz)).toBeCloseTo(1,6);
    expect(validateInput({type:"input",seq:1,...diagonal})).not.toBeNull();
    const partial=movementWire(0.4,0,true);
    expect(partial).toEqual({dx:0.4,dz:0});
  });
  test("one second of client steps matches twenty server ticks",()=>{
    const world=new WorldSimulation();
    const player=world.add("a","A",0,0);
    world.input("a",{type:"input",seq:1,dx:1,dz:0});
    const motion=new PredictedMotion();
    motion.reset(0,0,0);
    for(let i=0;i<60;i++)motion.predict(1,0,1/60,(i+1)*1000/60);
    for(let i=0;i<20;i++)world.tick();
    expect(motion.renderPose().x).toBeCloseTo(player.x,4);
    expect(player.x).toBeCloseTo(MOVEMENT_SPEED,4);
  });
});

describe("local prediction across 10 Hz snapshots",()=>{
  test("the avatar keeps a steady step between snapshots at 100 ms delay",()=>{
    const run=simulate(100,180);
    const moving=run.deltas.slice(70,160);
    const step=MOVEMENT_SPEED/60;
    for(const delta of moving){
      expect(delta).toBeGreaterThan(step*0.45);
      expect(delta).toBeLessThan(step*1.85);
    }
    const serverX=run.server.players.get("a")!.x;
    expect(Math.abs(run.renderX-serverX)).toBeLessThan(1.25);
    expect(Math.abs(run.serverPoseX-serverX)).toBeLessThan(1.25);
    expect(serverX).toBeGreaterThan(MOVEMENT_SPEED*2);
  });
  test("stays smooth after the pose history wraps, including 120 Hz frames",()=>{
    for(const fps of [60,120]){
      const frames=Math.round(fps*5);
      const run=simulate(80,frames,undefined,1000/fps);
      const moving=run.deltas.slice(Math.round(fps),frames-10);
      const step=MOVEMENT_SPEED/fps;
      for(const delta of moving){
        expect(delta).toBeGreaterThan(step*0.45);
        expect(delta).toBeLessThan(step*1.85);
      }
    }
  });
  test("stopping converges instead of staying glued to a stale snapshot",()=>{
    const run=simulate(120,220,1400);
    const serverX=run.server.players.get("a")!.x;
    expect(Math.abs(run.renderX-serverX)).toBeLessThan(0.25);
    expect(Math.abs(run.serverPoseX-serverX)).toBeLessThan(0.35);
  });
  test("a large correction snaps, a one-meter correction does not teleport in one frame",()=>{
    const motion=new PredictedMotion();
    motion.reset(0,0,0);
    motion.predict(0,0,1/60,16);
    motion.reconcile(32,30,0,-1);
    expect(motion.renderPose().x).toBeCloseTo(30,4);
    const eased=new PredictedMotion();
    eased.reset(0,0,0);
    eased.predict(0,0,1/60,16);
    eased.reconcile(32,1,0,-1);
    expect(eased.renderPose().x).toBeLessThan(0.05);
    let previous=eased.renderPose().x;
    for(let frame=0;frame<8;frame++){
      eased.smooth(1/60);
      const x=eased.renderPose().x;
      expect(x-previous).toBeLessThan(MOVEMENT_SPEED/60*2);
      expect(x-previous).toBeGreaterThan(-0.001);
      previous=x;
    }
    expect(eased.renderPose().x).toBeGreaterThan(0.5);
  });
});

function simulate(oneWayMs:number,frames:number,releaseAt?:number,frameMs=1000/60){
  const server=new WorldSimulation();
  server.add("a","A",0,0);
  const motion=new PredictedMotion();
  motion.reset(0,0,0);
  let now=0;
  let seq=0;
  let lastSend=-1e9;
  let tickDebt=0;
  let snapDebt=0;
  const inputs:{arrive:number;seq:number;dx:number;dz:number}[]=[];
  const snapshots:{arrive:number;x:number;z:number;ack:number}[]=[];
  const deltas:number[]=[];
  let previous=0;
  for(let frame=0;frame<frames;frame++){
    now+=frameMs;
    const moving=releaseAt===undefined||now<releaseAt;
    const command=movementWire(moving?1:0,0,true);
    motion.predict(command.dx,command.dz,frameMs/1000,now);
    if(now-lastSend>=50){
      seq++;
      inputs.push({arrive:now+oneWayMs,seq,dx:command.dx,dz:command.dz});
      motion.noteInput(seq,now);
      lastSend=now;
    }
    while(inputs.length&&inputs[0].arrive<=now){
      const input=inputs.shift()!;
      server.input("a",{type:"input",seq:input.seq,dx:input.dx,dz:input.dz});
    }
    tickDebt+=frameMs;
    while(tickDebt>=50){server.tick();tickDebt-=50;}
    snapDebt+=frameMs;
    while(snapDebt>=100){
      const snap=server.snapshot("a")!;
      snapshots.push({arrive:now+oneWayMs,x:snap.you.x,z:snap.you.z,ack:snap.ack});
      snapDebt-=100;
    }
    while(snapshots.length&&snapshots[0].arrive<=now){
      const snap=snapshots.shift()!;
      motion.reconcile(now,snap.x,snap.z,snap.ack);
    }
    motion.smooth(frameMs/1000);
    const renderX=motion.renderPose().x;
    deltas.push(renderX-previous);
    previous=renderX;
  }
  return {deltas,renderX:previous,serverPoseX:motion.serverPose(now).x,server};
}
