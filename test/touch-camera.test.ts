import {describe,expect,test} from "bun:test";
import {pointerSpacing,zoomFromPinch} from "../apps/client/src/input/touchCamera";
describe("touch camera controls",()=>{
 test("pinch distance",()=>{expect(pointerSpacing([{x:0,y:0},{x:3,y:4}])).toBe(5);expect(pointerSpacing([{x:0,y:0}])).toBe(0)});
 test("pinch out zooms in",()=>expect(zoomFromPinch(20,100,200)).toBe(11));
 test("pinch in zooms out",()=>expect(zoomFromPinch(20,200,100)).toBe(30));
 test("bad inputs cannot poison camera distance",()=>expect(zoomFromPinch(20,0,100)).toBe(20));
});
