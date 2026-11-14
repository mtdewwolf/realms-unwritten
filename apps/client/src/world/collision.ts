import {settlementsNear} from "./settlements";

export interface WorldPoint{x:number;z:number}
export interface CollisionBox{minX:number;maxX:number;minZ:number;maxZ:number}
export const PLAYER_RADIUS=.45;
export const WORLD_MOVEMENT_LIMIT=8190;
// Exact footprint of the three hand-authored houses in main.ts.
const STARTER_HOUSES:readonly CollisionBox[]=[
  {minX:-7.5,maxX:-4.5,minZ:-6.5,maxZ:-3.5},
  {minX:5.5,maxX:8.5,minZ:-10.5,maxZ:-7.5},
  {minX:-8.5,maxX:-5.5,minZ:5.5,maxZ:8.5}
];
function boxAt(x:number,z:number,half=1.5):CollisionBox{
  return {minX:x-half,maxX:x+half,minZ:z-half,maxZ:z+half};
}
function nearbyBoxes(x:number,z:number):CollisionBox[]{
  const boxes=[...STARTER_HOUSES];
  for(const settlement of settlementsNear(x,z,48)){
    if(settlement.id==="settlement-starter")continue;
    const count=settlement.tier==="outpost"?4:2;
    for(let i=0;i<count;i++){
      const angle=i*Math.PI*2/count;
      boxes.push(boxAt(settlement.x+Math.cos(angle)*11,settlement.z+Math.sin(angle)*11));
    }
  }
  return boxes;
}
export function overlapsHouse(x:number,z:number,radius=PLAYER_RADIUS):boolean{
  if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<0)return true;
  for(const b of nearbyBoxes(x,z)){
    const cx=Math.max(b.minX,Math.min(x,b.maxX));
    const cz=Math.max(b.minZ,Math.min(z,b.maxZ));
    if(Math.hypot(x-cx,z-cz)<radius)return true;
  }
  return false;
}
/** Resolve movement in substeps to avoid crossing even narrow walls in a large dt. */
export function moveWithCollision(x:number,z:number,dx:number,dz:number):WorldPoint{
  if(![x,z,dx,dz].every(Number.isFinite))return {x:0,z:0};
  const clamp=(v:number)=>Math.max(-WORLD_MOVEMENT_LIMIT,Math.min(WORLD_MOVEMENT_LIMIT,v));
  let px=clamp(x),pz=clamp(z);
  const total=Math.hypot(dx,dz);
  const steps=Math.max(1,Math.ceil(total/.2));
  const sx=dx/steps,sz=dz/steps;
  for(let i=0;i<steps;i++){
    const nx=clamp(px+sx);
    if(!overlapsHouse(nx,pz))px=nx;
    const nz=clamp(pz+sz);
    if(!overlapsHouse(px,nz))pz=nz;
  }
  return {x:px,z:pz};
}
/** Legacy saved positions may predate collision; relocate invalid logins safely. */
export function safeSpawn(x:number,z:number):WorldPoint{
  const sx=Number.isFinite(x)?Math.max(-WORLD_MOVEMENT_LIMIT,Math.min(WORLD_MOVEMENT_LIMIT,x)):0;
  const sz=Number.isFinite(z)?Math.max(-WORLD_MOVEMENT_LIMIT,Math.min(WORLD_MOVEMENT_LIMIT,z)):0;
  if(!overlapsHouse(sx,sz))return {x:sx,z:sz};
  for(let radius=2;radius<=18;radius+=2){
    for(let i=0;i<24;i++){
      const a=i*Math.PI/12;
      const tx=Math.max(-WORLD_MOVEMENT_LIMIT,Math.min(WORLD_MOVEMENT_LIMIT,sx+Math.cos(a)*radius));
      const tz=Math.max(-WORLD_MOVEMENT_LIMIT,Math.min(WORLD_MOVEMENT_LIMIT,sz+Math.sin(a)*radius));
      if(!overlapsHouse(tx,tz))return {x:tx,z:tz};
    }
  }
  return {x:0,z:0};
}
