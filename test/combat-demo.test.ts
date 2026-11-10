import {describe,expect,test} from "bun:test";
import {ATTACK_RANGE,ATTACK_STAMINA,DODGE_STAMINA,WOLF_MAX_HEALTH,clamp01,regenerateStamina,useStamina,withinAttackRange} from "../apps/client/src/gameplay/combat";
describe("local demo combat rules",()=>{
  test("valid range uses squared distance",()=>{expect(withinAttackRange(0,0,ATTACK_RANGE,0)).toBe(true);expect(withinAttackRange(0,0,ATTACK_RANGE+0.01,0)).toBe(false)});
  test("stamina cannot go negative",()=>{expect(useStamina(10,ATTACK_STAMINA)).toBeNull();expect(useStamina(100,DODGE_STAMINA)).toBe(74)});
  test("regen clamps",()=>{expect(regenerateStamina(99,10)).toBe(100);expect(regenerateStamina(-10,0)).toBe(0)});
  test("constants are finite",()=>{expect(WOLF_MAX_HEALTH).toBeGreaterThan(0);expect(clamp01(2)).toBe(1)});
});
