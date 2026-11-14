import {describe,expect,test} from "bun:test";
import {Database} from "bun:sqlite";
import {AccountStore,validCredentials} from "../apps/server/src/accounts";
describe("real accounts and guest preservation",()=>{
 function fixture(){
  const db=new Database(":memory:");
  db.exec("PRAGMA foreign_keys=ON;CREATE TABLE characters(id TEXT PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL,name TEXT NOT NULL,x REAL NOT NULL,z REAL NOT NULL,updated_at INTEGER NOT NULL);");
  return {db,accounts:new AccountStore(db)};
 }
 test("rejects invalid credentials without storing passwords",async()=>{
  expect(validCredentials("abc","longenoughpass")).toBe(true);
  expect(validCredentials("a","longenoughpass")).toBe(false);
  expect(validCredentials("account","short")).toBe(false);
  const {db,accounts}=fixture();
  expect(await accounts.register("bad username","longenoughpass")).toBeNull();
  const registered=await accounts.register("Explorer_A","secret-phrase-123");
  expect(registered?.id).toBeTruthy();
  const row=db.query<{pass_hash:string},[]>("SELECT pass_hash FROM accounts").get()!;
  expect(row.pass_hash).not.toContain("secret-phrase-123");
  expect(await accounts.login("EXPLORER_a","wrong-password-123")).toBeNull();
  expect((await accounts.login("EXPLORER_a","secret-phrase-123"))?.id).toBe(registered!.id);
  expect(await accounts.register("Explorer_A","secret-phrase-123")).toBeNull();
  db.close();
 });
 test("sessions restore a character, and migration keeps guest ownership optional",async()=>{
  const {db,accounts}=fixture();
  const a=(await accounts.register("TestAccount","secure-passphrase-123"))!;
  db.query("INSERT INTO characters VALUES ('c','hash','Aster',0,0,0,NULL)").run();
  expect(accounts.character(a.id)).toBeNull();
  accounts.linkCharacter("c",a.id);
  expect(accounts.character(a.id)?.id).toBe("c");
  expect(accounts.resume(a.token)).toBe(a.id);
  expect(accounts.resume("not-valid")).toBeNull();
  const again=new AccountStore(db);
  expect(again.character(a.id)?.name).toBe("Aster");
  expect(()=>again.linkCharacter("c",a.id)).toThrow();
  db.close();
 });
});
