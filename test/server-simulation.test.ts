import {describe,expect,test} from "bun:test";
import {WorldSimulation,stepMovement,cellKey} from "../apps/server/src/simulation";
import {overlapsHouse,moveWithCollision,safeSpawn} from "../apps/client/src/world/collision";
import {settlementsNear} from "../apps/client/src/world/settlements";
import {validateHello,validateInput,AOI_RADIUS,MOVEMENT_SPEED} from "../apps/server/src/protocol";
describe("authoritative multiplayer simulation",()=>{
  test("server refuses coordinate teleport packets",()=>{
    const world=new WorldSimulation();const p=world.add("a","Alice");
    expect(world.input("a",{type:"input",seq:0,x:6000,z:6000,dx:1,dz:0})).toBe(true);
    world.tick();
    expect(p.x).toBeCloseTo(MOVEMENT_SPEED/20,6);
    expect(p.z).toBe(0);
  });
  test("reject invalid input values and stale sequence",()=>{
    const world=new WorldSimulation();world.add("a","Alice");
    expect(world.input("a",{type:"input",seq:0,dx:Infinity,dz:0})).toBe(false);
    expect(world.input("a",{type:"input",seq:0,dx:1,dz:0})).toBe(true);
    expect(world.input("a",{type:"input",seq:0,dx:-1,dz:0})).toBe(false);
    expect(world.input("a",{type:"input",seq:1,dx:999,dz:0})).toBe(false);
  });
  test("normalized diagonals and boundary clamping",()=>{
    const world=new WorldSimulation();const p=world.add("a","A",8190,8190);
    p.dx=1;p.dz=1;
    for(let i=0;i<50;i++)world.tick();
    expect(p.x).toBeLessThanOrEqual(8190);
    expect(p.z).toBeLessThanOrEqual(8190);
  });
  test("interest filtering includes nearby players only",()=>{
    const world=new WorldSimulation();
    world.add("a","A");world.add("b","B",12,0);world.add("c","C",AOI_RADIUS+1,0);
    expect(world.snapshot("a")?.others.map(p=>p.id)).toEqual(["b"]);
    world.remove("b");
    expect(world.snapshot("a")?.others).toEqual([]);
  });
  test("guest message validation and grid",()=>{
    expect(validateHello({type:"hello",name:"Hi<>!"})?.name).toBe("Hi");
    expect(validateHello({type:"hello",token:"123"})).toBeNull();
    expect(validateInput({type:"input",seq:1,dx:.5,dz:.3})?.type).toBe("input");
    expect(cellKey(-.1,0)).toBe("-1:0");
  });
});

describe("shared server collision",()=>{
 test("starter building footprints block walking, including large movement deltas",()=>{
   expect(overlapsHouse(-6,-5)).toBe(true);
   expect(overlapsHouse(0,0)).toBe(false);
   const stopped=moveWithCollision(-10,-5,12,0);
   expect(stopped.x).toBeLessThan(-7.5);
   expect(stopped.z).toBe(-5);
   expect(overlapsHouse(stopped.x,stopped.z)).toBe(false);
 });
 test("diagonal movement slides along a wall without entering it",()=>{
   const moved=moveWithCollision(-10,-5,6,5);
   expect(overlapsHouse(moved.x,moved.z)).toBe(false);
   expect(moved.z).toBeGreaterThan(-5);
   expect(moved.x).toBeGreaterThan(-10);
 });
 test("server world ticks cannot walk through starter buildings",()=>{
   const world=new WorldSimulation();
   const p=world.add("blocked","Blocked",-10,-5);
   world.input("blocked",{type:"input",seq:1,dx:1,dz:0});
   for(let i=0;i<100;i++)world.tick();
   expect(p.x).toBeLessThan(-7.5);
   expect(p.z).toBe(-5);
 });
 test("legacy collision-embedded login coordinates are recovered",()=>{
   const fixed=safeSpawn(-6,-5);
   expect(overlapsHouse(fixed.x,fixed.z)).toBe(false);
   const world=new WorldSimulation();
   const p=world.add("recover","Recover",-6,-5);
   expect(overlapsHouse(p.x,p.z)).toBe(false);
 });
 test("generated settlement homes are solid but their roads remain traversable",()=>{
   // Find the first non-starter settlement near the origin.
   const town=settlementsNear(0,0,3000).find((x:{id:string})=>x.id!=="settlement-starter");
   expect(town).toBeDefined();
   const houseX=town!.x+11;
   expect(overlapsHouse(houseX,town!.z)).toBe(true);
   expect(overlapsHouse(town!.x,town!.z)).toBe(false);
 });
});
