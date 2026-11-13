import * as THREE from "three";
import {groundHeightAt} from "../world/chunkedWorld";
import {closestResource,workshopDistance,ORE_INTERACT_RANGE,WORKSHOP_INTERACT_RANGE,type ResourceTarget} from "./resourceGuidance";

export class ResourceGuide{
  readonly element:HTMLElement;
  readonly trackButton:HTMLButtonElement;
  private readonly marker:THREE.Group;
  private readonly ring:THREE.Mesh;
  private target:ResourceTarget|null=null;
  private cooldownEndsAt=0;
  private cooldownId:string|null=null;
  constructor(host:HTMLElement,scene:THREE.Scene,private readonly track:(x:number,z:number)=>void){
    this.element=document.createElement("aside");
    this.element.id="resource-guide";this.element.setAttribute("aria-label","Mining and crafting guidance");
    this.element.innerHTML='<strong>🌿 RESOURCES</strong><p id="resource-distance">Searching for ore…</p><button type="button" id="resource-track">TRACK RESOURCE</button><p id="resource-workshop"></p>';
    host.appendChild(this.element);
    this.trackButton=this.element.querySelector<HTMLButtonElement>("#resource-track")!;
    this.trackButton.addEventListener("click",()=>{if(this.target)this.track(this.target.x,this.target.z);});
    const ring=new THREE.Mesh(new THREE.RingGeometry(1.6,2.15,32),new THREE.MeshBasicMaterial({color:0x8de6fc,side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false}));
    ring.rotation.x=-Math.PI/2;
    const marker=new THREE.Group();marker.add(ring);
    marker.visible=false;scene.add(marker);
    this.marker=marker;this.ring=ring;
  }
  markCooldown(nodeId:string,retryMs:number,now=performance.now()):void{
    if(!Number.isFinite(retryMs)||retryMs<=0)return;
    this.cooldownId=nodeId;this.cooldownEndsAt=now+Math.min(600_000,retryMs);
  }
  update(x:number,z:number,online:boolean,now=performance.now()):void{
    this.target=closestResource(x,z);
    this.trackButton.disabled=!this.target;
    const distance=this.element.querySelector<HTMLElement>("#resource-distance")!;
    const shop=this.element.querySelector<HTMLElement>("#resource-workshop")!;
    const station=workshopDistance(x,z);
    shop.textContent=station<=WORKSHOP_INTERACT_RANGE?"⚒ Workshop in range":("⚒ Workshop "+Math.round(station)+"m away");
    this.marker.visible=!!this.target&&this.target.distance<75;
    if(this.target&&this.marker.visible){
      this.marker.position.set(this.target.x,groundHeightAt(this.target.x,this.target.z)+.13,this.target.z);
      this.ring.rotation.z=now*.0005;
      (this.ring.material as THREE.MeshBasicMaterial).color.setHex(this.target.kind==="moonleaf"?0x8ef6a5:0x8de6fc);
    }
    if(!this.target){distance.textContent="No resources nearby · explore outward";return;}
    const resource=this.target.kind==="moonleaf"?"Moonleaf":"Ore";
    const remaining=this.target.id===this.cooldownId?Math.max(0,Math.ceil((this.cooldownEndsAt-now)/1000)):0;
    if(remaining>0){distance.textContent=resource+" replenishes in "+remaining+"s";return;}
    if(this.target.inRange){distance.textContent=online?resource+" in range · press GATHER":resource+" in range · connect to gather";return;}
    distance.textContent="Nearest "+resource+" "+Math.round(this.target.distance)+"m · "+Math.round(this.target.bearing)+"°";
  }
  currentTarget():ResourceTarget|null{return this.target;}
}
