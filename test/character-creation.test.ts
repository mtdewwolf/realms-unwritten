import {describe,expect,test} from "bun:test";
import {Database} from "bun:sqlite";
import {parseCharacterCreation,FACTIONS,RACES,CLASSES,DEFAULT_APPEARANCE} from "../apps/shared/src/characterCatalog";
import {CharacterIdentityStore} from "../apps/server/src/characterIdentity";
function selection(faction:string,race:string,characterClass:string,name="Aster Vale"):unknown{
 return {type:"create_character",name,faction,race,characterClass};
}
describe("new-character selection validation",()=>{
 test("all four original races have consistent faction assignments",()=>{
  expect(Object.keys(FACTIONS)).toHaveLength(2);
  expect(Object.keys(RACES)).toHaveLength(4);
  expect(Object.keys(CLASSES)).toHaveLength(3);
  for(const [race,config] of Object.entries(RACES)){
    for(const cls of Object.keys(CLASSES)){
      const result=parseCharacterCreation(selection(config.faction,race,cls));
      expect(result).toMatchObject({race,faction:config.faction,characterClass:cls});
    }
  }
 });
 test("rejects forged cross-faction race, unknown class and invalid names",()=>{
  expect(parseCharacterCreation(selection("radiant-accord","ashforged","vanguard"))).toBeNull();
  expect(parseCharacterCreation(selection("umbral-dominion","thornkin","spellweaver"))).toBeNull();
  expect(parseCharacterCreation(selection("radiant-accord","sunborne","admin"))).toBeNull();
  expect(parseCharacterCreation(selection("unknown","sunborne","vanguard"))).toBeNull();
  expect(parseCharacterCreation(selection("radiant-accord","sunborne","vanguard","X"))).toBeNull();
  expect(parseCharacterCreation(selection("radiant-accord","sunborne","vanguard","<script>"))).toBeNull();
  expect(parseCharacterCreation({type:"hello",name:"Test"})).toBeNull();
 });
});
describe("saved character identity",()=>{
 function fixture(){
  const db=new Database(":memory:");
  db.exec("PRAGMA foreign_keys=ON;CREATE TABLE characters(id TEXT PRIMARY KEY,name TEXT NOT NULL);INSERT INTO characters VALUES ('new','Nyx'),('legacy','Legacy Traveler');");
  return {db,store:new CharacterIdentityStore(db)};
 }
 test("persists chosen race, class and faction across store recreation",()=>{
  const {db,store}=fixture();
  const choice=parseCharacterCreation(selection("umbral-dominion","veilkin","shadeblade","Nyx"))!;
  store.assign("new",choice);
  expect(new CharacterIdentityStore(db).read("new")).toEqual(choice);
  expect(()=>store.assign("new",choice)).toThrow();
  expect(new CharacterIdentityStore(db).read("new")).toEqual(choice);
  db.close();
 });
 test("legacy migration keeps existing name and is idempotent",()=>{
  const {db,store}=fixture();
  store.migrateLegacy("legacy");store.migrateLegacy("legacy");
  expect(store.read("legacy")).toEqual({name:"Legacy Traveler",faction:"radiant-accord",race:"sunborne",characterClass:"vanguard",appearance:DEFAULT_APPEARANCE});
  db.close();
 });
 test("missing character cannot receive an identity",()=>{
  const {db,store}=fixture();
  const choice=parseCharacterCreation(selection("radiant-accord","sunborne","vanguard"))!;
  expect(()=>store.assign("missing",choice)).toThrow();
  db.close();
 });
});
