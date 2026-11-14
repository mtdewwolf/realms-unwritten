import * as THREE from "three";
import {createRaceCharacter,type RaceCharacter} from "../characters/raceModel";
import type {CharacterAppearance,ClassId,RaceId} from "../../../shared/src/characterCatalog";
export class RacePreview{
 private readonly scene=new THREE.Scene();
 private readonly camera=new THREE.PerspectiveCamera(34,260/290,.1,35);
 private readonly renderer:THREE.WebGLRenderer;
 private model:RaceCharacter|null=null;
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
  const canvas=this.renderer.domElement;
  canvas.addEventListener("pointerdown",e=>{this.dragX=e.clientX;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener("pointermove",e=>{if(this.dragX===null)return;this.angle+=(e.clientX-this.dragX)*.012;this.dragX=e.clientX;this.draw();});
  canvas.addEventListener("pointerup",()=>{this.dragX=null;});
  canvas.addEventListener("pointercancel",()=>{this.dragX=null;});
 }
 update(race:RaceId,characterClass:ClassId,appearance:CharacterAppearance):void{
  if(this.model){this.scene.remove(this.model.root);this.model.dispose();}
  this.model=createRaceCharacter({race,characterClass,appearance});
  this.scene.add(this.model.root);this.draw();
 }
 rotate(direction:number):void{this.angle+=direction;this.draw();}
 private draw():void{
  if(!this.model)return;
  this.model.root.rotation.y=this.angle;
  this.renderer.render(this.scene,this.camera);
 }
}
