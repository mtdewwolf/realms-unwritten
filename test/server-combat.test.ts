import {describe,expect,test} from "bun:test";
import {WorldSimulation} from "../apps/server/src/simulation";
import {CombatSimulation,WOLF_ID,parseAction} from "../apps/server/src/combat";

describe("server-authoritative shared wolf encounter",()=>{
  function setup(){
    const world=new WorldSimulation();
    const combat=new CombatSimulation(world);
    world.add("a","Alice",4,5);world.add("b","Bob",4,5);
    combat.join("a");combat.join("b");
    return {world,combat};
  }
  test("invalid or stale actions cannot mutate wolf",()=>{
    const {combat}=setup();
    expect(parseAction({type:"action",seq:1,action:"teleport"})).toBeNull();
    expect(combat.action("a",{type:"action",seq:1,action:"attack",target:"bad"})).toBeNull();
    expect(combat.wolf.health).toBe(60);
    expect(combat.action("a",{type:"action",seq:1,action:"attack",target:WOLF_ID})?.ok).toBe(false);
    expect(combat.wolf.health).toBe(60);
  });
  test("two players share one wolf HP and cooldown is enforced",()=>{
    const {combat}=setup();
    expect(combat.action("a",{type:"action",seq:1,action:"attack",target:WOLF_ID})?.ok).toBe(true);
    expect(combat.wolfView().health).toBe(40);
    expect(combat.action("a",{type:"action",seq:2,action:"attack",target:WOLF_ID})?.ok).toBe(false);
    expect(combat.action("b",{type:"action",seq:1,action:"attack",target:WOLF_ID})?.ok).toBe(true);
    expect(combat.wolfView().health).toBe(20);
    expect(combat.vital("a")?.stamina).toBe(84);
    expect(combat.vital("b")?.stamina).toBe(84);
  });
  test("range and stamina validated server side",()=>{
    const {world,combat}=setup();
    world.players.get("a")!.x=800;
    expect(combat.action("a",{type:"action",seq:1,action:"attack",target:WOLF_ID})?.reason).toBe("target out of range");
    expect(combat.wolf.health).toBe(60);
    combat.players.get("a")!.stamina=0;
    combat.tick();
    expect(combat.action("a",{type:"action",seq:2,action:"dodge"})?.reason).toBe("not enough stamina");
  });
  test("death, respawn, and shared wolf entity",()=>{
    const {combat}=setup();
    for(let i=0;i<3;i++){
      combat.time=i;
      const who=i===1?"b":"a";
      expect(combat.action(who,{type:"action",seq:i+1,action:"attack",target:WOLF_ID})?.ok).toBe(true);
    }
    expect(combat.wolf.phase).toBe("dead");
    expect(combat.wolf.health).toBe(0);
    for(let i=0;i<160;i++)combat.tick();
    expect(combat.wolf.phase).toBe("idle");
    expect(combat.wolf.health).toBe(60);
  });
  test("bite deals server damage and dodge prevents it",()=>{
    const {world,combat}=setup();
    world.players.get("b")!.x=1000;
    combat.wolf.x=4;combat.wolf.z=5;
    combat.wolf.phase="windup";combat.wolf.windupUntil=.1;combat.wolf.targetId="a";
    combat.time=.08;
    combat.tick();
    expect(combat.vital("a")?.health).toBe(88);
    const player=combat.players.get("a")!;
    combat.wolf.phase="windup";combat.wolf.windupUntil=.2;combat.wolf.targetId="a";
    combat.time=.18;player.dodgeUntil=.7;
    combat.tick();
    expect(combat.vital("a")?.health).toBe(88);
  });
});
