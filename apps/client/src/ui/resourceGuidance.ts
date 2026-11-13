import {landmarksNear,type Landmark} from "../world/landmarks";
import {waypointGuidance} from "./worldMap";

export const ORE_TRACK_RADIUS=1200;
export const ORE_INTERACT_RANGE=5;
export const WORKSHOP_INTERACT_RANGE=6;
export const WORKSHOP={x:2,z:-3} as const;

export interface ResourceTarget{
  id:string;x:number;z:number;distance:number;bearing:number;inRange:boolean;
}
export function closestOre(x:number,z:number,radius=ORE_TRACK_RADIUS):ResourceTarget|null{
  if(!Number.isFinite(x)||!Number.isFinite(z)||radius<=0)return null;
  let nearest:ResourceTarget|null=null;
  for(const landmark of landmarksNear(x,z,radius)){
    if(landmark.type!=="ore")continue;
    const nav=waypointGuidance({x,z},landmark);
    if(!nearest||nav.distance<nearest.distance||(nav.distance===nearest.distance&&landmark.id<nearest.id))
      nearest={id:landmark.id,x:landmark.x,z:landmark.z,distance:nav.distance,bearing:nav.bearing,inRange:nav.distance<=ORE_INTERACT_RANGE};
  }
  return nearest;
}
export function workshopDistance(x:number,z:number):number{
  return Math.hypot(x-WORKSHOP.x,z-WORKSHOP.z);
}
export function missingMaterials(items:readonly {id:string;quantity:number}[]):{ore:number;fang:number}{
  const quantity=(id:string)=>items.find(i=>i.id===id)?.quantity??0;
  return {ore:Math.max(0,2-quantity("iron-ore")),fang:Math.max(0,1-quantity("wolf-fang"))};
}
