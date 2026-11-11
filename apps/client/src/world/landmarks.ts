import { biomeAt } from "./terrain";

export type LandmarkType = "ruins" | "ore" | "den";
export interface Landmark {
  readonly id: string;
  readonly type: LandmarkType;
  readonly name: string;
  readonly x: number;
  readonly z: number;
}
const REGION_SIZE=256;
const WORLD_RADIUS=8192;
function hash(x:number,z:number,salt:number):number{
  let v=Math.imul(x,374761393)^Math.imul(z,668265263)^salt;
  v=Math.imul(v^v>>>13,1274126177);
  return (v^v>>>16)>>>0;
}
function landmarkForRegion(rx:number,rz:number):Landmark|null{
  const n=hash(rx,rz,0x21fa41);
  if(n%5===0)return null;
  const x=rx*REGION_SIZE+42+((n>>>8)%172);
  const z=rz*REGION_SIZE+42+((hash(rx,rz,0x531eb2)>>>8)%172);
  if(Math.abs(x)>WORLD_RADIUS-24 || Math.abs(z)>WORLD_RADIUS-24)return null;
  // The starter village occupies the origin. Its authored geometry takes priority.
  if(Math.hypot(x,z)<75)return null;
  const biome=biomeAt(x,z);
  const type:LandmarkType=biome==="highlands"?"ore":biome==="woodland"?"den":n%2===0?"ruins":"ore";
  const name=type==="ruins"?"Forgotten Watchtower":type==="ore"?"Ironstone Outcrop":"Wolf Territory";
  return {id:"poi-v1-"+rx+"-"+rz,type,name,x,z};
}
export function landmarksNear(x:number,z:number,radius=300):Landmark[]{
  const minX=Math.floor((x-radius)/REGION_SIZE),maxX=Math.floor((x+radius)/REGION_SIZE);
  const minZ=Math.floor((z-radius)/REGION_SIZE),maxZ=Math.floor((z+radius)/REGION_SIZE);
  const result:Landmark[]=[];
  for(let rz=minZ;rz<=maxZ;rz++)for(let rx=minX;rx<=maxX;rx++){
    const poi=landmarkForRegion(rx,rz);
    if(poi && Math.hypot(poi.x-x,poi.z-z)<=radius)result.push(poi);
  }
  return result;
}
export function landmarkInChunk(cx:number,cz:number,chunkSize=64):Landmark[]{
  const x=cx*chunkSize,z=cz*chunkSize;
  return landmarksNear(x+chunkSize/2,z+chunkSize/2,chunkSize)
    .filter(p=>p.x>=x&&p.x<x+chunkSize&&p.z>=z&&p.z<z+chunkSize);
}
export function discoverableLandmarks(x:number,z:number,range=16):Landmark[]{
  return landmarksNear(x,z,range);
}
