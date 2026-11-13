import { biomeAt } from "../world/terrain";
import { landmarksNear, type Landmark } from "../world/landmarks";
import { WORLD_HALF_SIZE } from "../world/chunkedWorld";
import type { Settlement } from "../world/settlements";

export const MAP_CELL_SIZE=64;
export const MAP_VIEW_RADIUS=512;
export const MAP_VERSION=1;
export type MapPoint={x:number;z:number};
export function exploredCellKey(x:number,z:number):string {
  return Math.floor(x/MAP_CELL_SIZE)+":"+Math.floor(z/MAP_CELL_SIZE);
}
export function parseExploredCells(raw:string|null):Set<string>{
  try {
    const data=JSON.parse(raw || "[]");
    if(!Array.isArray(data)) return new Set();
    return new Set(data.filter((v):v is string=>typeof v==="string" && /^-?\d+:-?\d+$/.test(v)).slice(0,65536));
  }catch{return new Set();}
}
export function worldToMap(world:MapPoint,center:MapPoint,size:number):MapPoint{
  return {x:size/2+(world.x-center.x)*size/(2*MAP_VIEW_RADIUS),
    z:size/2+(world.z-center.z)*size/(2*MAP_VIEW_RADIUS)};
}
export function mapToWorld(screen:MapPoint,center:MapPoint,size:number):MapPoint{
  return {x:center.x+(screen.x-size/2)*2*MAP_VIEW_RADIUS/size,
    z:center.z+(screen.z-size/2)*2*MAP_VIEW_RADIUS/size};
}
export function waypointGuidance(from:MapPoint,to:MapPoint):{distance:number; bearing:number}{
  const dx=to.x-from.x,dz=to.z-from.z;
  return {distance:Math.hypot(dx,dz),bearing:(Math.atan2(dx,-dz)*180/Math.PI+360)%360};
}
const storageKey="realms-unwritten-map-v1";
const palette={meadow:"#678957",woodland:"#3c6b53",highlands:"#918d70"};
const markerColor={ruins:"#f3cd73",ore:"#a8c5e0",den:"#ec9e80"};
function storageRead():string|null{try{return localStorage.getItem(storageKey);}catch{return null;}}
function storageWrite(value:string):void{try{localStorage.setItem(storageKey,value);}catch{/* Private mode */}}
function cap(n:number):number{return Math.min(WORLD_HALF_SIZE-2,Math.max(-WORLD_HALF_SIZE+2,n));}
export class WorldMap {
  private readonly openButton:HTMLButtonElement;
  private readonly panel:HTMLElement;
  private readonly canvas:HTMLCanvasElement;
  private readonly info:HTMLElement;
  private readonly guidance:HTMLElement;
  private readonly ctx:CanvasRenderingContext2D;
  private readonly visited=parseExploredCells(storageRead());
  private readonly known=new Map<string,Landmark>();
  private readonly knownTowns=new Map<string,Settlement>();
  private readonly viewSize=320;
  private center:MapPoint={x:0,z:0};
  private waypoint:MapPoint|null=null;
  private visible=false;
  private lastRedraw=0;
  private dirty=true;
  constructor(host:HTMLElement){
    this.openButton=document.createElement("button");
    this.openButton.id="world-map-toggle";
    this.openButton.type="button";
    this.openButton.textContent="🗺 MAP";
    this.openButton.setAttribute("aria-label","Open world map");
    host.appendChild(this.openButton);
    this.panel=document.createElement("section");
    this.panel.id="world-map-panel";
    this.panel.hidden=true;
    this.panel.setAttribute("aria-label","World map");
    this.panel.innerHTML='<div class="map-header"><strong>THE VERDANT REACH · ATLAS</strong><button type="button" id="map-close" aria-label="Close map">✕</button></div><canvas id="world-map-canvas" width="320" height="320" aria-label="Tap explored map terrain to set waypoint"></canvas><div id="world-map-info"></div><p>Tap explored terrain or a discovered landmark to set a destination. North is up.</p><button id="map-clear" type="button">Clear destination</button>';
    host.appendChild(this.panel);
    this.canvas=this.panel.querySelector<HTMLCanvasElement>("#world-map-canvas")!;
    this.ctx=this.canvas.getContext("2d")!;
    this.info=this.panel.querySelector<HTMLElement>("#world-map-info")!;
    this.guidance=document.createElement("div");
    this.guidance.id="world-map-guidance";
    host.appendChild(this.guidance);
    this.openButton.addEventListener("click",()=>this.setVisible(!this.visible));
    this.panel.querySelector("#map-close")!.addEventListener("click",()=>this.setVisible(false));
    this.panel.querySelector("#map-clear")!.addEventListener("click",()=>{this.waypoint=null;this.dirty=true;this.render();});
    window.addEventListener("keydown",e=>{
      if(e.key.toLowerCase()==="m" && !e.repeat && !(e.target instanceof HTMLInputElement)){this.setVisible(!this.visible);e.preventDefault();}
      else if(e.key==="Escape" && this.visible)this.setVisible(false);
    });
    this.canvas.addEventListener("pointerdown",e=>{
      const r=this.canvas.getBoundingClientRect();
      if(!r.width||!r.height)return;
      const sx=(e.clientX-r.left)*this.viewSize/r.width;
      const sz=(e.clientY-r.top)*this.viewSize/r.height;
      const target=mapToWorld({x:sx,z:sz},this.center,this.viewSize);
      const valid={x:cap(target.x),z:cap(target.z)};
      if(!this.visited.has(exploredCellKey(valid.x,valid.z)))return;
      const nearest=[...this.known.values()].filter(p=>this.visited.has(exploredCellKey(p.x,p.z))).map(p=>({p,d:Math.hypot(worldToMap(p,this.center,this.viewSize).x-sx,worldToMap(p,this.center,this.viewSize).z-sz)})).sort((a,b)=>a.d-b.d)[0];
      this.waypoint=nearest&&nearest.d<14?{x:nearest.p.x,z:nearest.p.z}:valid;
      this.dirty=true;this.render();
    });
  }
  private setVisible(next:boolean):void{
    this.visible=next;
    this.panel.hidden=!next;
    this.openButton.setAttribute("aria-expanded",String(next));
    this.dirty=true;
    if(next)this.render();
  }
  setWaypoint(destination:MapPoint):void{
    if(!Number.isFinite(destination.x)||!Number.isFinite(destination.z))return;
    this.waypoint={x:cap(destination.x),z:cap(destination.z)};
    this.dirty=true;
    this.guidance.textContent="◆ Resource waypoint set";
    if(this.visible)this.render();
  }
  recordSettlement(town:Settlement):void{
    this.knownTowns.set(town.id,town);this.dirty=true;
  }
  recordDiscovered(landmark:Landmark):void{
    this.known.set(landmark.id,landmark);this.dirty=true;
  }
  update(x:number,z:number,now:number):void{
    this.center={x,z};
    const cell=exploredCellKey(x,z);
    if(!this.visited.has(cell)){
      this.visited.add(cell);
      storageWrite(JSON.stringify([...this.visited]));
      this.dirty=true;
    }
    // Only nearby discovered locations are queried. No global world POI enumeration.
    if(this.visible && now-this.lastRedraw>250){
      this.render();this.lastRedraw=now;
    }
    if(this.waypoint){
      const nav=waypointGuidance(this.center,this.waypoint);
      if(nav.distance<8){this.waypoint=null;this.dirty=true;this.guidance.textContent="Destination reached";}
      else this.guidance.textContent="◆ "+Math.round(nav.distance)+"m · "+Math.round(nav.bearing)+"°";
    }else if(this.guidance.textContent!=="Destination reached")this.guidance.textContent="";
  }
  private render():void{
    if(!this.visible)return;
    const ctx=this.ctx,size=this.viewSize,scale=size/(2*MAP_VIEW_RADIUS);
    ctx.clearRect(0,0,size,size);
    ctx.fillStyle="#152624";ctx.fillRect(0,0,size,size);
    const minX=Math.floor((this.center.x-MAP_VIEW_RADIUS)/MAP_CELL_SIZE),maxX=Math.floor((this.center.x+MAP_VIEW_RADIUS)/MAP_CELL_SIZE);
    const minZ=Math.floor((this.center.z-MAP_VIEW_RADIUS)/MAP_CELL_SIZE),maxZ=Math.floor((this.center.z+MAP_VIEW_RADIUS)/MAP_CELL_SIZE);
    for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
      if(!this.visited.has(x+":"+z))continue;
      const wx=x*MAP_CELL_SIZE,wz=z*MAP_CELL_SIZE;
      const p=worldToMap({x:wx,z:wz},this.center,size);
      ctx.fillStyle=palette[biomeAt(wx+32,wz+32)];
      ctx.fillRect(p.x,p.z,MAP_CELL_SIZE*scale+0.5,MAP_CELL_SIZE*scale+0.5);
    }
    // Draw only discovered locations in map range, never undiscovered content.
    for(const poi of this.known.values()){
      const p=worldToMap(poi,this.center,size);
      if(p.x<0||p.z<0||p.x>size||p.z>size)continue;
      ctx.fillStyle=markerColor[poi.type];
      ctx.beginPath();ctx.arc(p.x,p.z,4,0,Math.PI*2);ctx.fill();
    }
    for(const town of this.knownTowns.values()){
      const p=worldToMap(town,this.center,size);
      if(p.x<0||p.z<0||p.x>size||p.z>size)continue;
      ctx.fillStyle="#fbe4ac";ctx.fillRect(p.x-4,p.z-4,8,8);
      ctx.strokeStyle="#563f27";ctx.strokeRect(p.x-4,p.z-4,8,8);
    }
    if(this.waypoint){
      const p=worldToMap(this.waypoint,this.center,size);
      if(p.x>=0&&p.z>=0&&p.x<=size&&p.z<=size){
        ctx.strokeStyle="#fff1b4";ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(p.x,p.z,7,0,Math.PI*2);ctx.stroke();
      }
    }
    ctx.fillStyle="#ffffff";ctx.beginPath();ctx.arc(size/2,size/2,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#f6e6b5";ctx.font="bold 12px system-ui";ctx.fillText("N",size/2-4,15);
    this.info.textContent="Explored cells: "+this.visited.size+" | Landmarks: "+this.known.size+" | Towns: "+this.knownTowns.size+" | View: 1.024 km";
    this.dirty=false;
  }
}
