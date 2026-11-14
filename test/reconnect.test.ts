import {describe,expect,test} from "bun:test";
import {MAX_RECONNECT_ATTEMPTS,HELLO_TIMEOUT_MS,reconnectDelay,shouldReconnect} from "../apps/client/src/multiplayer/reconnectPolicy";
describe("bounded reconnect policy",()=>{
 test("exponential retry grows with a cap",()=>{
  expect([1,2,3,4,5,6].map(reconnectDelay)).toEqual([500,1000,2000,4000,8000,12000]);
  expect(HELLO_TIMEOUT_MS).toBeGreaterThan(1000);
 });
 test("transient network and restart closures retry",()=>{
  expect(shouldReconnect(1006,0,true)).toBe(true);
  expect(shouldReconnect(1012,2,true)).toBe(true);
  expect(shouldReconnect(4000,2,true)).toBe(true);
  expect(shouldReconnect(1006,MAX_RECONNECT_ATTEMPTS,true)).toBe(false);
  expect(shouldReconnect(1006,0,false)).toBe(false);
 });
 test("authentication, policy and protocol closures stop retrying",()=>{
  for(const code of [1000,1008,1009,1011,4001,4003,4004])
   expect(shouldReconnect(code,0,true)).toBe(false);
 });
});
