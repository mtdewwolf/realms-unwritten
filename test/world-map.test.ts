import {describe,expect,test} from "bun:test";
import {exploredCellKey,parseExploredCells,worldToMap,mapToWorld,waypointGuidance} from "../apps/client/src/ui/worldMap";
describe("world atlas",()=>{
  test("negative fog cells use floor semantics",()=>{
    expect(exploredCellKey(-.01,-64)).toBe("-1:-1");
    expect(exploredCellKey(64,0)).toBe("1:0");
  });
  test("saved state handles corrupt or malicious entries",()=>{
    expect([...parseExploredCells("bad json")]).toEqual([]);
    expect([...parseExploredCells('["1:3","1:3","evil","-2:0"]')]).toEqual(["1:3","-2:0"]);
  });
  test("map and world projections invert",()=>{
    const center={x:-146,z:208},where={x:44,z:-30};
    const screen=worldToMap(where,center,320);
    const converted=mapToWorld(screen,center,320);
    expect(converted.x).toBeCloseTo(where.x,6);
    expect(converted.z).toBeCloseTo(where.z,6);
  });
  test("navigation north and east bearings",()=>{
    expect(waypointGuidance({x:0,z:0},{x:0,z:-50}).bearing).toBe(0);
    expect(waypointGuidance({x:0,z:0},{x:50,z:0}).bearing).toBe(90);
    expect(waypointGuidance({x:0,z:0},{x:30,z:40}).distance).toBe(50);
  });
});
