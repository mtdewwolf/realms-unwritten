import * as THREE from "three";
/**
 * Realms Unwritten original architectural kit v2.
 * Painted-fantasy silhouettes, layered roof shingles, carved timber and warm windows.
 * Building collision stays the original 3x3-meter footprint.
 */
const plaster=new THREE.MeshLambertMaterial({color:0xd4c49f,flatShading:true});
const foundation=new THREE.MeshLambertMaterial({color:0x74776b,flatShading:true});
const timber=new THREE.MeshLambertMaterial({color:0x5a4032,flatShading:true});
const timberHighlight=new THREE.MeshLambertMaterial({color:0x91714c,flatShading:true});
const roofSlate=[0x425c69,0x526778,0x35515a,0x61727b].map(c=>new THREE.MeshLambertMaterial({color:c,flatShading:true}));
const warmGlow=new THREE.MeshBasicMaterial({color:0xffc874});
const windowFrame=new THREE.MeshLambertMaterial({color:0x3c2928});
const copper=new THREE.MeshLambertMaterial({color:0xc2a15d,flatShading:true});
const stone=new THREE.MeshLambertMaterial({color:0x8b9082,flatShading:true});
function part(parent:THREE.Object3D,geometry:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number):THREE.Mesh{
 const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function beam(parent:THREE.Object3D,w:number,h:number,d:number,mat:THREE.Material,x:number,y:number,z:number):THREE.Mesh{
 return part(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z);
}
export function createFantasyCottage(x:number,z:number,variant=0):THREE.Group{
 const g=new THREE.Group();g.name="RU_Cottage";g.position.set(x,0,z);
 beam(g,3,.35,3,foundation,0,.17,0);
 beam(g,3,2.52,3,plaster,0,1.48,0);
 for(const sx of [-1.4,1.4])for(const sz of [-1.4,1.4])beam(g,.2,2.58,.2,timber,sx,1.48,sz);
 for(const side of [-1,1]){
  beam(g,3.18,.2,.17,timber,0,2.7,side*1.51);
  beam(g,3.18,.18,.19,timberHighlight,0,.75,side*1.51);
  for(const sx of [-1.42,1.42]){
   const brace=beam(g,.14,.93,.16,timberHighlight,sx*.55,1.75,side*1.56);
   brace.rotation.z=sx>0?-.43:.43;
  }
 }
 // Two roof planes instead of a cube/cone, with overlapping chunky shingles.
 for(const side of [-1,1]){
  const slope=beam(g,2.35,.21,3.7,roofSlate[variant%4],side*.86,3.25,0);
  slope.rotation.z=side*.60;
  for(let row=0;row<4;row++)for(let col=0;col<5;col++){
   const shingle=beam(g,.47,.07,.70,roofSlate[(variant+row+col)%4],side*(.37+row*.33),3.63-row*.23,-1.38+col*.69);
   shingle.rotation.z=side*.60;
  }
 }
 const ridge=beam(g,.26,.22,3.87,copper,0,3.91,0);
 ridge.rotation.y=.02;
 // Distinctive triangular attic finial, centered above door.
 const finial=part(g,new THREE.ConeGeometry(.21,.68,5),copper,0,4.33,0);
 finial.rotation.y=Math.PI/5;
 // Door face, frame, and iron handle: front z positive.
 beam(g,.89,1.62,.16,windowFrame,0,1.03,1.57);
 beam(g,.73,1.42,.07,timber,0,.95,1.68);
 part(g,new THREE.SphereGeometry(.065,8,6),copper,.22,1,1.75);
 for(const sx of [-1,1]){
  beam(g,.62,.67,.13,windowFrame,sx*.94,1.76,1.61);
  beam(g,.46,.49,.16,warmGlow,sx*.94,1.76,1.68);
  beam(g,.07,.57,.17,timber,sx*.94,1.76,1.77);
  beam(g,.52,.07,.17,timber,sx*.94,1.76,1.77);
  beam(g,.64,.12,.35,timberHighlight,sx*.94,1.39,1.76);
 }
 const lantern=part(g,new THREE.SphereGeometry(.16,8,6),warmGlow,1.3,2.34,1.8);
 beam(g,.06,.25,.06,copper,1.3,2.49,1.8);
 lantern.scale.y=1.2;
 // Stone chimney placed to one side.
 beam(g,.47,1.15,.55,stone,-.99,3.59,-.65);
 beam(g,.65,.18,.68,foundation,-.99,4.17,-.65);
 return g;
}
export function decorateVillage(scene:THREE.Scene):void{
 const wood=new THREE.MeshLambertMaterial({color:0x76583e,flatShading:true});
 const banner=new THREE.MeshLambertMaterial({color:0x385d65,side:THREE.DoubleSide});
 const yellow=new THREE.MeshBasicMaterial({color:0xf1cf85});
 const flag=new THREE.Group();flag.position.set(0,0,-15);
 beam(flag,.21,6.4,.21,wood,0,3.2,0);
 const cloth=beam(flag,1.75,2.65,.11,banner,1.05,4.6,.05);
 cloth.rotation.z=.07;
 part(flag,new THREE.OctahedronGeometry(.35),yellow,0,6.65,0);
 scene.add(flag);
 // The village well is placed beyond the central guard/quest interaction area.
 const well=new THREE.Group();well.position.set(-2,0,12);
 part(well,new THREE.CylinderGeometry(1.25,1.4,1.1,10),stone,0,.55,0);
 part(well,new THREE.CylinderGeometry(.83,.83,.14,10),windowFrame,0,1.16,0);
 for(const sx of [-1.05,1.05])beam(well,.17,3.15,.17,wood,sx,2.03,0);
 const roof=part(well,new THREE.ConeGeometry(1.7,1.4,4),roofSlate[0],0,3.96,0);
 roof.rotation.y=Math.PI/4;
 scene.add(well);
 // Roadside picket fences are visual only; do not turn them into unmodelled colliders.
 for(const side of [-1,1])for(let i=0;i<7;i++){
  const fence=new THREE.Group();fence.position.set(side*10,0,-23+i*3);
  beam(fence,.16,1.15,.19,wood,0,.6,0);
  if(i<6)beam(fence,.12,.12,3.1,wood,0,.95,1.5);
  scene.add(fence);
 }
}
