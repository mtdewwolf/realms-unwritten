import {describe,expect,test} from "bun:test";
import {Database} from "bun:sqlite";
import {DEFAULT_APPEARANCE,parseAppearance,parseCharacterCreation} from "../apps/shared/src/characterCatalog";
import {CharacterIdentityStore} from "../apps/server/src/characterIdentity";
describe("appearance and character migration",()=>{
 test("reject invalid appearance indices and forged payloads",()=>{
  for(const values of [{hairStyle:4},{skinTone:-1},{hairColor:99},{marking:1.3},{frame:"enormous"},{skinTone:"1"}])
   expect(parseAppearance({...DEFAULT_APPEARANCE,...values})).toBeNull();
  expect(parseCharacterCreation({type:"create_character",name:"Aria",faction:"radiant-accord",race:"sunborne",characterClass:"vanguard",appearance:{...DEFAULT_APPEARANCE,hairColor:7}})).toBeNull();
 });
 test("old identity schema upgrades in place",()=>{
  const db=new Database(":memory:");
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE characters(id TEXT PRIMARY KEY,name TEXT NOT NULL); INSERT INTO characters VALUES ('a','Aria'); CREATE TABLE character_identities(character_id TEXT PRIMARY KEY,faction TEXT,race TEXT,character_class TEXT); INSERT INTO character_identities VALUES ('a','radiant-accord','sunborne','vanguard')");
  const store=new CharacterIdentityStore(db);
  expect(store.read("a")?.appearance).toEqual(DEFAULT_APPEARANCE);
  expect(new CharacterIdentityStore(db).read("a")?.name).toBe("Aria");
  db.close();
 });
 test("selected appearance persists across store recreation",()=>{
  const db=new Database(":memory:");
  db.exec("PRAGMA foreign_keys=ON;CREATE TABLE characters(id TEXT PRIMARY KEY,name TEXT NOT NULL);INSERT INTO characters VALUES ('a','Nyx')");
  const store=new CharacterIdentityStore(db);
  const choice=parseCharacterCreation({type:"create_character",name:"Nyx",faction:"umbral-dominion",race:"veilkin",characterClass:"shadeblade",appearance:{frame:"sturdy",skinTone:2,hairStyle:3,hairColor:4,marking:2}})!;
  store.assign("a",choice);
  expect(new CharacterIdentityStore(db).read("a")).toEqual(choice);
  db.close();
 });
});
