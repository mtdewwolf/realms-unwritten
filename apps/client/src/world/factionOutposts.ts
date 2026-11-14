import * as THREE from "three";
import {groundHeightAt} from "./chunkedWorld";
import {createFantasyCottage} from "./fantasyArchitecture";

/**
 * Original rival-faction roadside enclaves. Their stone and timber buildings
 * have matching authoritative collision footprints in collision.ts.
 * Visual environment only: NPCs and faction quests are not yet interactive.
 */
export const FACTION_OUTPOSTS=[
 {id:"accord-watch",x:-68,z:44,faction:"accord" as const},
 {id:"dominion-spire",x:68,z:-44,faction:"dominion" as const}
] as const;
const materials={
 accordStone:new THREE.MeshLambertMaterial({color:0xc3ae81,flatShading:true}),
 accordTimber:new THREE.MeshLambertMaterial({color:0x64543c,flatShading:true}),
 accordBanner:new THREE.MeshLambertMaterial({color:0x3a7d77,side:THREE.DoubleSide}),
 accordTrim:new THREE.MeshLambertMaterial({color:0xe8cf83,flatShading:true}),
 dominionStone:new THREE.MeshLambertMaterial({color:0x494a55,flatShading:true}),
 dominionTimber:new THREE.MeshLambertMaterial({color:0x322d39,flatShading:true}),
 dominionBanner:new THREE.MeshLambertMaterial({color:0x703a65,side:THREE.DoubleSide}),
 dominionTrim:new THREE.MeshLambertMaterial({color:0xbd80b4,flatShading:true}),
 fire:new THREE.MeshBasicMaterial({color:0xffc46c}),
 arcane:new THREE.MeshBasicMaterial({color:0xb88ef4})
};
function part(root:THREE.Object3D,g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number):THREE.Mesh{
 const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);root.add(mesh);return mesh;
}
function block(root:THREE.Object3D,w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number):THREE.Mesh{
 return part(root,new THREE.BoxGeometry(w,h,d),m,x,y,z);
}
function tower(accord:boolean):THREE.Group{
 const root=new THREE.Group();
 const stone=accord?materials.accordStone:materials.dominionStone;
 const trim=accord?materials.accordTrim:materials.dominionTrim;
 const timber=accord?materials.accordTimber:materials.dominionTimber;
 const banner=accord?materials.accordBanner:materials.dominionBanner;
 const base=part(root,new THREE.CylinderGeometry(1.65,1.85,4.5,8),stone,0,2.25,0);
 base.rotation.y=Math.PI/8;
 block(root,3.5,.32,3.5,trim,0,4.55,0);
 part(root,new THREE.ConeGeometry(accord?2.15:1.66,accord?2.1:3.1,8),timber,0,accord?5.85:6.2,0).rotation.y=Math.PI/8;
 for(const side of [-1,1]){
  block(root,.65,1.8,.08,banner,side*1.33,3.18,1.03);
  block(root,.1,2,.12,trim,side*1.33,3.35,1.12);
 }
 const beacon=part(root,new THREE.OctahedronGeometry(.43),accord?materials.fire:materials.arcane,0,accord?7.25:8.15,0);
 beacon.name="faction-signal";
 return root;
}
function arch(accord:boolean):THREE.Group{
 const root=new THREE.Group(),stone=accord?materials.accordStone:materials.dominionStone;
 const trim=accord?materials.accordTrim:materials.dominionTrim;
 for(const x of [-2.6,2.6]){
  block(root,.9,4,.9,stone,x,2,0);
  part(root,new THREE.ConeGeometry(.67,1.25,5),trim,x,4.68,0);
 }
 const lintel=block(root,6.1,.58,.9,stone,0,3.99,0);
 lintel.rotation.z=accord?.04:-.04;
 const medallion=part(root,new THREE.OctahedronGeometry(.57),trim,0,4.12,.58);
 medallion.rotation.y=Math.PI/4;
 return root;
}
export function createFactionOutpost(id:"accord-watch"|"dominion-spire"):THREE.Group{
 const place=FACTION_OUTPOSTS.find(o=>o.id===id)!;
 const accord=place.faction==="accord",group=new THREE.Group();
 group.name="art-"+id;group.position.set(place.x,groundHeightAt(place.x,place.z),place.z);
 // Two original class/race-independent buildings keep comparable terrain footprints.
 for(const offset of [-9,9]){
  const lx=offset,lz=accord?-6:6;
  const house=createFantasyCottage(0,0,accord?0:3);
  house.position.set(lx,groundHeightAt(place.x+lx,place.z+lz)-group.position.y,lz);
  if(!accord){
   // The Dominion kit uses darker materials and aggressive spire silhouette.
   const spire=part(house,new THREE.ConeGeometry(.45,1.45,5),materials.dominionTrim,0,4.94,0);
   spire.rotation.z=.05;
   for(const mesh of house.children)if(mesh instanceof THREE.Mesh&&mesh.material instanceof THREE.MeshLambertMaterial){
    if(mesh.material.color.getHex()===0xd4c49f){
      const darkened=mesh.material.clone();darkened.color.setHex(0x777483);mesh.material=darkened;
    }
   }
  }
  group.add(house);
 }
 const watch=tower(accord);watch.position.set(0,groundHeightAt(place.x,place.z+10)-group.position.y,10);group.add(watch);
 const gate=arch(accord);gate.position.set(0,groundHeightAt(place.x,place.z-13)-group.position.y,-13);group.add(gate);
 for(const side of [-1,1]){
  const mat=accord?materials.accordBanner:materials.dominionBanner;
  const standard=new THREE.Group();
  standard.position.set(side*5,groundHeightAt(place.x+side*5,place.z+3)-group.position.y,3);
  block(standard,.13,5,.13,materials.accordTimber,0,2.5,0);
  const cloth=block(standard,1.15,2.4,.12,mat,side*.62,3.53,0);
  cloth.rotation.z=side*.06;group.add(standard);
 }
 return group;
}
export function decorateFactionOutposts(scene:THREE.Scene):void{
 scene.add(createFactionOutpost("accord-watch"),createFactionOutpost("dominion-spire"));
}
