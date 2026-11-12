import {describe,expect,test} from "bun:test";
import {WorldSimulation,stepMovement,cellKey} from "../apps/server/src/simulation";
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
