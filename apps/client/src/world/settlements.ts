import { biomeAt } from "./terrain";

export interface Settlement {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly z: number;
  readonly tier: "hamlet" | "outpost";
}
export const ROAD_GRID_METERS=512;
export const ROAD_OFFSET_METERS=8;
export const WORLD_LIMIT_METERS=8192;
function hash(x:number,z:number):number {
  let n=Math.imul(x,1103515245)^Math.imul(z,1664525)^0x549a5a1d;
  n=Math.imul(n^(n>>>16),2246822519);
  return (n^(n>>>13))>>>0;
}
export function settlementAtGrid(gx:number,gz:number):Settlement|null {
  const x=gx*ROAD_GRID_METERS+ROAD_OFFSET_METERS;
  const z=gz*ROAD_GRID_METERS+ROAD_OFFSET_METERS;
  if(Math.abs(x)>WORLD_LIMIT_METERS-30||Math.abs(z)>WORLD_LIMIT_METERS-30)return null;
  // Keep the original starter village as the origin destination.
  if(gx===0&&gz===0)return {id:"settlement-starter",name:"Verdant Reach",x:0,z:0,tier:"outpost"};
  const seed=hash(gx,gz);
  if(seed%3!==0)return null;
  const biome=biomeAt(x,z);
  const names=biome==="highlands"?["Stonecrest","Ironwatch","Hillfort"]:
    biome==="woodland"?["Greenhollow","Oakshade","Mossbridge"]:
    ["Sunfield","Brookmere","Windrest"];
  return {
    id:"settlement-v1-"+gx+"-"+gz,
    name:names[(seed>>>8)%names.length],
    x,z,
    tier:(seed>>>14)%4===0?"outpost":"hamlet"
  };
}
export function settlementsNear(x:number,z:number,radius=800):Settlement[]{
  const lowX=Math.ceil((x-radius-ROAD_OFFSET_METERS)/ROAD_GRID_METERS);
  const highX=Math.floor((x+radius-ROAD_OFFSET_METERS)/ROAD_GRID_METERS);
  const lowZ=Math.ceil((z-radius-ROAD_OFFSET_METERS)/ROAD_GRID_METERS);
  const highZ=Math.floor((z+radius-ROAD_OFFSET_METERS)/ROAD_GRID_METERS);
  const result:Settlement[]=[];
  for(let gx=lowX;gx<=highX;gx++)for(let gz=lowZ;gz<=highZ;gz++){
    const item=settlementAtGrid(gx,gz);
    if(item&&Math.hypot(item.x-x,item.z-z)<=radius)result.push(item);
  }
  return result;
}
export function settlementsInChunk(cx:number,cz:number,chunkSize=64):Settlement[]{
  const x=cx*chunkSize,z=cz*chunkSize;
  return settlementsNear(x+chunkSize/2,z+chunkSize/2,chunkSize)
    .filter(p=>p.x>=x&&p.x<x+chunkSize&&p.z>=z&&p.z<z+chunkSize);
}
export function discoverySettlements(x:number,z:number,radius=28):Settlement[]{
  return settlementsNear(x,z,radius);
}
export function isRoadChunk(cx:number,cz:number):boolean{
  return cx%8===0||cz%8===0;
}
