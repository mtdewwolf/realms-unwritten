import * as THREE from "three";
import {createRaceCharacter,type RaceCharacter} from "../characters/raceModel";
import {createAnimatedRace,type AnimatedRace} from "../characters/raceAsset";
import type {CharacterAppearance,ClassId,RaceId} from "../../../shared/src/characterCatalog";
export class RacePreview{
 private readonly scene=new THREE.Scene();
 private readonly camera=new THREE.PerspectiveCamera(34,260/290,.1,35);
 private readonly renderer:THREE.WebGLRenderer;
 private model:RaceCharacter|null=null;
 private rigged:AnimatedRace|null=null;
 private generation=0;
 private readonly backdrop=new THREE.Group();
 private backdropMaterials:THREE.Material[]=[];
 private angle=.3;
 private dragX:number|null=null;
 constructor(container:HTMLElement){
  this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:true,powerPreference:"low-power"});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  this.renderer.setSize(260,290,false);
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.domElement.style.touchAction="none";
  this.renderer.domElement.setAttribute("aria-label","Drag to rotate the 3D character");
  container.replaceChildren(this.renderer.domElement);
  this.camera.position.set(3.5,2.6,5.2);this.camera.lookAt(0,1.22,0);
  this.scene.add(new THREE.HemisphereLight(0xe3ebfc,0x6d6260,2.4));
  const light=new THREE.DirectionalLight(0xffe3c2,2.2);
  light.position.set(-3,7,5);this.scene.add(light);
  this.scene.add(this.backdrop);
  const animate=()=>{
    if(!this.renderer.domElement.isConnected)return;
    if(this.rigged&&this.renderer.domElement.getClientRects().length){
      this.rigged.update(1/30);this.draw();
    }
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
  const canvas=this.renderer.domElement;
  canvas.addEventListener("pointerdown",e=>{this.dragX=e.clientX;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener("pointermove",e=>{if(this.dragX===null)return;this.angle+=(e.clientX-this.dragX)*.012;this.dragX=e.clientX;this.draw();});
  canvas.addEventListener("pointerup",()=>{this.dragX=null;});
  canvas.addEventListener("pointercancel",()=>{this.dragX=null;});
 }
 update(race:RaceId,characterClass:ClassId,appearance:CharacterAppearance):void{
  const generation=++this.generation;
  if(this.model){this.scene.remove(this.model.root);this.model.dispose();}
  if(this.rigged){this.scene.remove(this.rigged.root);this.rigged.dispose();this.rigged=null;}
  this.buildBackdrop(race);
  this.model=createRaceCharacter({race,characterClass,appearance});
  this.scene.add(this.model.root);this.draw();
  void createAnimatedRace({race,characterClass,appearance}).then(rig=>{
    if(generation!==this.generation){rig.dispose();return;}
    this.rigged=rig;this.scene.add(rig.root);
    if(this.model)this.model.root.visible=false;
    this.draw();
  }).catch(error=>console.warn("3D preview fallback",error));
 }
 private buildBackdrop(race:RaceId):void{
  this.backdrop.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});
  for(const m of this.backdropMaterials)m.dispose();
  this.backdropMaterials=[];
  this.backdrop.clear();
  const shadow=race==="ashforged"||race==="veilkin";
  this.scene.background=new THREE.Color(shadow?0x171c30:0x233c37);
  const rock=new THREE.MeshStandardMaterial({color:shadow?0x4d3a48:0x878b7b,roughness:.95,flatShading:true});
  const trim=new THREE.MeshStandardMaterial({color:shadow?0x98708d:0xb8a06b,metalness:.2,roughness:.55,flatShading:true});
  const floor=new THREE.MeshStandardMaterial({color:shadow?0x282b37:0x415a49,roughness:1,flatShading:true});
  const glow=new THREE.MeshBasicMaterial({color:shadow?0xd38bcc:0xf0d091});
  this.backdropMaterials.push(rock,trim,floor,glow);
  const mesh=(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number)=>{
    const part=new THREE.Mesh(geometry,material);part.position.set(x,y,z);this.backdrop.add(part);return part;
  };
  mesh(new THREE.CylinderGeometry(2.0,2.18,.26,12),rock,0,-.14,0);
  mesh(new THREE.CylinderGeometry(1.7,1.76,.12,12),trim,0,.02,0);
  mesh(new THREE.CylinderGeometry(1.45,1.48,.08,12),floor,0,.12,0);
  // Faction framing: distinct architectural pillars / organic silhouettes.
  for(const side of [-1,1]){
    const x=side*1.72;
    mesh(new THREE.CylinderGeometry(.21,.34,3.25,7),rock,x,1.7,-1.55);
    mesh(new THREE.BoxGeometry(.8,.23,.76),trim,x,3.3,-1.55);
    mesh(new THREE.CylinderGeometry(.15,.17,.45,8),trim,x,3.62,-1.55);
    if(race==="thornkin"){
      const b=mesh(new THREE.IcosahedronGeometry(.72,1),new THREE.MeshLambertMaterial({color:0x4f855c,flatShading:true}),x,3.42,-1.55);
      this.backdropMaterials.push(b.material as THREE.Material);
    }else if(race==="ashforged"){
      mesh(new THREE.ConeGeometry(.34,1.05,5),glow,x,4.0,-1.55);
    }else if(race==="veilkin"){
      mesh(new THREE.OctahedronGeometry(.45),glow,x,3.98,-1.55);
    }else{
      mesh(new THREE.SphereGeometry(.27,10,8),glow,x,3.96,-1.55);
    }
  }
  // An original sweeping stone arch behind the silhouette.
  for(let i=0;i<11;i++){
    const t=Math.PI*(i/10);
    const x=Math.cos(t)*1.75;
    const y=3.33+Math.sin(t)*.85;
    const block=mesh(new THREE.BoxGeometry(.44,.34,.65),i%2?rock:trim,x,y,-1.52);
    block.rotation.z=t-Math.PI/2;
  }
  const rune=mesh(new THREE.TorusGeometry(.62,.055,5,24),glow,0,3.43,-1.45);
  rune.rotation.y=.1;
 }
 rotate(direction:number):void{this.angle+=direction;this.draw();}
 private draw():void{
  if(!this.model)return;
  this.model.root.rotation.y=this.angle;
  if(this.rigged)this.rigged.root.rotation.y=this.angle;
  this.renderer.render(this.scene,this.camera);
 }
}
