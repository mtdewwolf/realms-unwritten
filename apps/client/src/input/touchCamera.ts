export interface PointerPosition {x:number;y:number}
export function pointerSpacing(points: readonly PointerPosition[]):number{
  if(points.length!==2)return 0;
  return Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
}
/** A growing two-finger spacing moves the camera closer to the player. */
export function zoomFromPinch(current:number,previousSpacing:number,nextSpacing:number):number{
  if(!Number.isFinite(current)||!Number.isFinite(previousSpacing)||!Number.isFinite(nextSpacing)||previousSpacing<=0||nextSpacing<=0)return current;
  return Math.max(11,Math.min(30,current*previousSpacing/nextSpacing));
}
