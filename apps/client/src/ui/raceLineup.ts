import * as THREE from "three";
import {RACES,type FactionId,type RaceId,type ClassId} from "../../../shared/src/characterCatalog";
import {createRaceCharacter,type RaceCharacter} from "../characters/raceModel";
import {createAnimatedRace,type AnimatedRace} from "../characters/raceAsset";

interface Slot{race:RaceId;group:THREE.Group;fallback:RaceCharacter;animated?:AnimatedRace;ring:THREE.Mesh}
export class RaceLineup{
 private readonly scene=new THREE.Scene();
 private readonly camera=new THREE.PerspectiveCamera(34,680/284,.1,100);
 private readonly renderer:THREE.WebGLRenderer;
 private readonly slots:Slot[]=[];
 private generation=0;
 private selected:RaceId="sunborne";
 private readonly ringGeometry=new THREE.TorusGeometry(.55,.055,5,36);
 private readonly ringMaterial=new THREE.MeshBasicMaterial({color:0xf7ce7b});
 private readonly floor:THREE.Mesh;
 constructor(private readonly host:HTMLElement,private readonly onSelect:(race:RaceId)=>void){
   this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:"low-power"});
   this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
   this.renderer.setSize(680,284,false);
   this.renderer.outputColorSpace=THREE.SRGBColorSpace;
   const canvas=this.renderer.domElement;
   canvas.style.touchAction="manipulation";
   canvas.setAttribute("aria-label","Four selectable 3D fantasy race models");
   host.appendChild(canvas);
   this.scene.background=new THREE.Color(0x1b292b);
   this.scene.add(new THREE.HemisphereLight(0xe6e5da,0x554b38,2.6));
   const light=new THREE.DirectionalLight(0xffd8aa,2.1);
   light.position.set(-4,8,7);this.scene.add(light);
   this.camera.position.set(0,3,12.2);this.camera.lookAt(0,1.5,0);
   this.floor=new THREE.Mesh(new THREE.PlaneGeometry(13,5),new THREE.MeshLambertMaterial({color:0x40554c}));
   this.floor.rotation.x=-Math.PI/2;this.floor.position.y=-.055;this.scene.add(this.floor);
   canvas.addEventListener("pointerup",event=>{
     const rect=canvas.getBoundingClientRect();
     const index=Math.max(0,Math.min(3,Math.floor((event.clientX-rect.left)/rect.width*4)));
     const slot=this.slots[index];if(slot)this.onSelect(slot.race);
   });
   let previous=0;
   const tick=(now:number)=>{
     if(!canvas.isConnected)return;
     if(!this.host.closest("[hidden]")&&now-previous>=33){
       const dt=previous?Math.min(.05,(now-previous)/1000):1/30;
       previous=now;
       for(const slot of this.slots){
         slot.animated?.update(dt);
         slot.ring.rotation.z+=dt*.35;
       }
       this.renderer.render(this.scene,this.camera);
     }
     requestAnimationFrame(tick);
   };
   requestAnimationFrame(tick);
 }
 update(faction:FactionId,characterClass:ClassId,selected:RaceId):void{
   this.selected=selected;
   const generation=++this.generation;
   for(const slot of this.slots){
     this.scene.remove(slot.group);slot.fallback.dispose();slot.animated?.dispose();
   }
   this.slots.length=0;
   const races=(Object.keys(RACES) as RaceId[]).filter(r=>RACES[r].faction===faction);
   for(let i=0;i<races.length;i++){
     const race=races[i];
     const group=new THREE.Group();group.position.set((i-1.5)*2.3,0,0);
     const fallback=createRaceCharacter({race,characterClass});
     group.add(fallback.root);
     const ring=new THREE.Mesh(this.ringGeometry,this.ringMaterial);
     ring.rotation.x=-Math.PI/2;ring.position.y=.04;
     ring.visible=race===selected;group.add(ring);
     this.scene.add(group);
     const slot:Slot={race,group,fallback,ring};this.slots.push(slot);
     void createAnimatedRace({race,characterClass}).then(animated=>{
       if(this.generation!==generation||!this.slots.includes(slot)){animated.dispose();return;}
       slot.animated=animated;group.add(animated.root);fallback.root.visible=false;
     }).catch(error=>console.warn("Lineup procedural fallback",race,error));
   }
   this.scene.background=new THREE.Color(faction==="radiant-accord"?0x263b32:0x292237);
   (this.floor.material as THREE.MeshLambertMaterial).color.setHex(faction==="radiant-accord"?0x47624b:0x493e52);
 }
 highlight(race:RaceId):void{
   this.selected=race;
   for(const slot of this.slots)slot.ring.visible=slot.race===race;
 }
}
