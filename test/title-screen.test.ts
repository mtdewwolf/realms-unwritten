import {describe,expect,test} from "bun:test";
import {readFileSync} from "node:fs";
describe("launch and account UX",()=>{
 test("title explicitly offers account creation, login and offline demo",()=>{
  const src=readFileSync("apps/client/src/ui/titleScreen.ts","utf8");
  for(const text of ["CREATE ACCOUNT","SIGN IN","OFFLINE DEMO","CONTINUE LEGACY GUEST","realm-server-url"])expect(src).toContain(text);
 });
 test("game starts gated by account / character entry",()=>{
  const src=readFileSync("apps/client/src/main.ts","utf8");
  expect(src).toContain("new TitleScreen(");
  expect(src).toContain('app.classList.add("game-entered")');
 });
});
