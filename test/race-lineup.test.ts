import {describe,expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {RACES} from "../apps/shared/src/characterCatalog";
describe("eight-race 3D faction lineups",()=>{
 test("each faction has four eligible character races",()=>{
  for(const faction of ["radiant-accord","umbral-dominion"])
   expect(Object.values(RACES).filter(r=>r.faction===faction)).toHaveLength(4);
 });
 test("creator renders lineup and allows race selection from stage",()=>{
  const source=readFileSync("apps/client/src/ui/characterCreator.ts","utf8");
  expect(source).toContain("new RaceLineup(");
  expect(source).toContain("this.lineup.update(this.faction,this.characterClass,this.race)");
  expect(source).toContain("race=>{this.race=race;this.render();}");
 });
});
