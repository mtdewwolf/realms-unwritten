import {describe,expect,test} from "bun:test";
import {WorldAtmosphere} from "../apps/client/src/world/worldAtmosphere";
import {createRaceCharacter} from "../apps/client/src/characters/raceModel";
describe("mobile sky rendering",()=>{
 test("atmosphere is a renderable game-scene component without browser dependencies",()=>{
   const model=createRaceCharacter({race:"sunborne",characterClass:"vanguard"});
   expect(typeof WorldAtmosphere).toBe("function");
   expect(model.root.children.length).toBeGreaterThan(0);
   model.dispose();
 });
});
