import {landmarksNear} from "../world/landmarks";
import {herbsNear} from "../world/herbs";
import {waypointGuidance} from "./worldMap";

export const ORE_TRACK_RADIUS=1200;
export const ORE_INTERACT_RANGE=5;
export const WORKSHOP_INTERACT_RANGE=6;
export const WORKSHOP={x:2,z:-3} as const;

export interface ResourceTarget{
  id:string;x:number;z:number;distance:number;bearing:number;inRange:boolean;kind?:"ore"|"moonleaf";
}
export function closestOre(x:number,z:number,radius=ORE_TRACK_RADIUS):ResourceTarget|null{
  if(!Number.isFinite(x)||!Number.isFinite(z)||radius<=0)return null;
  let nearest:ResourceTarget|null=null;
  for(const landmark of landmarksNear(x,z,radius)){
    if(landmark.type!=="ore")continue;
    const nav=waypointGuidance({x,z},landmark);
    if(!nearest||nav.distance<nearest.distance||(nav.distance===nearest.distance&&landmark.id<nearest.id))
      nearest={id:landmark.id,x:landmark.x,z:landmark.z,distance:nav.distance,bearing:nav.bearing,inRange:nav.distance<=ORE_INTERACT_RANGE,kind:"ore"};
  }
  return nearest;
}
export function closestResource(x:number,z:number,radius=ORE_TRACK_RADIUS):ResourceTarget|null{
  const ore=closestOre(x,z,radius);
  if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<=0)return null;
  const candidates:ResourceTarget[]=[];
  if(ore)candidates.push(ore);
  for(const herb of herbsNear(x,z,radius)){
    const nav=waypointGuidance({x,z},herb);
    candidates.push({id:herb.id,x:herb.x,z:herb.z,distance:nav.distance,bearing:nav.bearing,inRange:nav.distance<=ORE_INTERACT_RANGE,kind:"moonleaf"});
  }
  candidates.sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
  return candidates[0]??null;
}
export function workshopDistance(x:number,z:number):number{
  return Math.hypot(x-WORKSHOP.x,z-WORKSHOP.z);
}
export function missingMaterials(items:readonly {id:string;quantity:number}[]):{ore:number;fang:number}{
  const quantity=(id:string)=>items.find(i=>i.id===id)?.quantity??0;
  return {ore:Math.max(0,2-quantity("iron-ore")),fang:Math.max(0,1-quantity("wolf-fang"))};
}
