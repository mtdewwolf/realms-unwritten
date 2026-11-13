import {biomeAt} from "./terrain";

export interface HerbPatch {id:string;x:number;z:number;type:"moonleaf";name:"Moonleaf"}
export const HERB_CELL=128;
export const HERB_WORLD_LIMIT=8192;
function hash(x:number,z:number,salt:number):number{
  let n=Math.imul(x,374761393)^Math.imul(z,668265263)^salt;
  n=Math.imul(n^(n>>>13),1274126177);
  return (n^(n>>>16))>>>0;
}
export function herbPatchAt(cx:number,cz:number):HerbPatch|null{
  if(!Number.isSafeInteger(cx)||!Number.isSafeInteger(cz)||Math.abs(cx)>65||Math.abs(cz)>65)return null;
  const n=hash(cx,cz,0x4d33);
  if(n%4===0)return null;
  const x=cx*HERB_CELL+18+(n%92);
  const z=cz*HERB_CELL+18+(hash(cx,cz,0xbeef)%92);
  if(Math.abs(x)>=HERB_WORLD_LIMIT-24||Math.abs(z)>=HERB_WORLD_LIMIT-24)return null;
  if(Math.hypot(x,z)<70)return null;
  if(biomeAt(x,z)==="highlands")return null;
  return {id:"herb-v1-"+cx+"-"+cz,x,z,type:"moonleaf",name:"Moonleaf"};
}
export function herbsNear(x:number,z:number,radius=300):HerbPatch[]{
  if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<0||radius>3000)return [];
  const minX=Math.floor((x-radius)/HERB_CELL),maxX=Math.floor((x+radius)/HERB_CELL);
  const minZ=Math.floor((z-radius)/HERB_CELL),maxZ=Math.floor((z+radius)/HERB_CELL);
  const patches:HerbPatch[]=[];
  for(let cz=minZ;cz<=maxZ;cz++)for(let cx=minX;cx<=maxX;cx++){
    const patch=herbPatchAt(cx,cz);
    if(patch&&Math.hypot(patch.x-x,patch.z-z)<=radius)patches.push(patch);
  }
  return patches;
}
export function herbsInChunk(cx:number,cz:number,size=64):HerbPatch[]{
  const x=cx*size,z=cz*size;
  return herbsNear(x+size/2,z+size/2,size).filter(p=>p.x>=x&&p.x<x+size&&p.z>=z&&p.z<z+size);
}
