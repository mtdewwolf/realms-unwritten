import {describe,expect,test} from "bun:test";
import {CHUNK_SIZE,WORLD_HALF_SIZE,chunkCoordinate,chunkSeed,seededRandom,activeChunkCoordinates} from "../apps/client/src/world/chunkedWorld";
describe("world streaming",()=>{
test("world expands to 16.384 km",()=>expect(WORLD_HALF_SIZE*2).toBe(16384));
test("negative chunk coordinates",()=>{expect(chunkCoordinate(-.1)).toBe(-1);expect(chunkCoordinate(0)).toBe(0);expect(chunkCoordinate(CHUNK_SIZE)).toBe(1)});
test("only nearby chunks instantiated",()=>{expect(activeChunkCoordinates(0,0).length).toBe(25);expect(activeChunkCoordinates(WORLD_HALF_SIZE-1,WORLD_HALF_SIZE-1).length).toBe(9)});
test("deterministic seeded placements",()=>{const seed=chunkSeed(-2,5),a=seededRandom(seed),b=seededRandom(seed);for(let i=0;i<10;i++)expect(a()).toBe(b())});
});
