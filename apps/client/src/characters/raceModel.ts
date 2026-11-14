import * as THREE from "three";
import {RACES,DEFAULT_APPEARANCE,type CharacterIdentity,type CharacterAppearance,type ClassId,type RaceId} from "../../../shared/src/characterCatalog";
export interface RaceCharacter{root:THREE.Group;update:(time:number,moving:boolean,attacking:boolean)=>void;dispose:()=>void}
const SKINS:Record<RaceId,readonly number[]>={
 sunborne:[0xebc69e,0xd8a97e,0xb7805c,0x8e5940],
 thornkin:[0xb0c38f,0x8fa87c,0x6e9273,0x4b715a],
 ashforged:[0xad7a6c,0x996458,0x785250,0x614546],
 veilkin:[0xb0a6ca,0x908cb7,0x716b9d,0x524c75]
};
const HAIR=[0x352d30,0xd0a673,0xe6dfc2,0x683e3c,0x8a80bb];
const CLASS_COLOR:Record<ClassId,number>={vanguard:0x446a86,spellweaver:0x65539b,shadeblade:0x34594c};
function material(hex:number){return new THREE.MeshStandardMaterial({color:hex,roughness:.72,metalness:.03,flatShading:true});}
export function createRaceCharacter(identity:Pick<CharacterIdentity,"race"|"characterClass"> & {appearance?:CharacterAppearance}):RaceCharacter{
 const appearance=identity.appearance??DEFAULT_APPEARANCE;
 const root=new THREE.Group();
 const mats=[material(SKINS[identity.race][appearance.skinTone]),material(HAIR[appearance.hairColor]),material(CLASS_COLOR[identity.characterClass]),material(0x2f2b33),material(0xc4b39a),material(0x9ebed0),material(0xddd5b6)];
 const [skin,hair,armor,boots,leather,metal,glow]=mats;
 const geometry:THREE.BufferGeometry[]=[];
 function mesh(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,x:number,y:number,z:number){
  geometry.push(g);const p=new THREE.Mesh(g,m);p.position.set(x,y,z);parent.add(p);return p;
 }
 const box=(parent:THREE.Object3D,w:number,h:number,d:number,m:THREE.Material,x=0,y=0,z=0)=>mesh(new THREE.BoxGeometry(w,h,d),m,parent,x,y,z);
 const orb=(parent:THREE.Object3D,r:number,m:THREE.Material,x=0,y=0,z=0)=>mesh(new THREE.IcosahedronGeometry(r,1),m,parent,x,y,z);
 const sturdy=appearance.frame==="sturdy";
 const width=sturdy?1.13:1;
 const torso=box(root,.78*width,.89,.47,armor,0,1.28,0);
 box(root,.81*width,.15,.5,leather,0,.88,0);
 const head=orb(root,identity.race==="ashforged"?.32:.29,skin,0,2,0);
 head.scale.set(1,1.06,.9);
 // Each race has an unambiguous silhouette from any viewing angle.
 if(identity.race==="sunborne"){
  const crest=mesh(new THREE.ConeGeometry(.18,.35,5),metal,root,0,2.52,0);
  crest.rotation.z=.05;
  for(const s of [-1,1])box(root,.12,.25,.13,glow,s*.39,1.67,0);
 }else if(identity.race==="thornkin"){
  for(const s of [-1,1]){
   const ear=mesh(new THREE.ConeGeometry(.14,.62,4),skin,root,s*.38,2.1,.03);
   ear.rotation.z=-s*.75;
   const antler=mesh(new THREE.ConeGeometry(.08,.42,5),leather,root,s*.21,2.48,-.06);
   antler.rotation.z=s*.4;
  }
 }else if(identity.race==="ashforged"){
  for(const s of [-1,1]){
   const horn=mesh(new THREE.ConeGeometry(.14,.52,6),metal,root,s*.24,2.42,-.05);
   horn.rotation.z=-s*.35;
   box(root,.25,.16,.25,metal,s*.39,1.51,0);
  }
 }else{
  for(const s of [-1,1]){
   const ear=mesh(new THREE.ConeGeometry(.1,.48,4),skin,root,s*.38,2.04,0);
   ear.rotation.z=-s*1.1;
  }
  orb(root,.11,glow,0,2.47,-.05);
 }
 // Readable, low-poly hairstyles visible from the side and from behind.
 if(appearance.hairStyle===0)box(root,.52,.13,.51,hair,0,2.3,-.03);
 if(appearance.hairStyle===1){
   box(root,.57,.2,.52,hair,0,2.29,-.04);
   box(root,.48,.38,.18,hair,0,1.99,-.26);
 }
 if(appearance.hairStyle===2){
   for(let i=-1;i<=1;i++){
    const spike=mesh(new THREE.ConeGeometry(.13,.33,5),hair,root,i*.18,2.42,0);
    spike.rotation.z=i*.2;
   }
 }
 if(appearance.hairStyle===3){
   box(root,.56,.12,.55,hair,0,2.29,-.02);
   box(root,.17,.51,.18,hair,-.24,2,-.13);
   box(root,.17,.51,.18,hair,.24,2,-.13);
 }
 if(appearance.marking>0){
  const mark=material(appearance.marking===1?0xd6dfd8:0x6b3749);mats.push(mark);
  for(const s of [-1,1])box(root,.12,.05,.03,mark,s*.15,2.04,.27);
 }
 const arms:[THREE.Group,THREE.Group]=[new THREE.Group(),new THREE.Group()];
 for(const [i,s] of [-1,1].entries()){
   const arm=arms[i];arm.position.set(s*.5*width,1.65,0);root.add(arm);
   box(arm,.25,.68,.3,armor,0,-.32,0);
   orb(arm,.14,skin,0,-.73,0);
 }
 const legs:[THREE.Group,THREE.Group]=[new THREE.Group(),new THREE.Group()];
 for(const [i,s] of [-1,1].entries()){
   const leg=legs[i];leg.position.set(s*.23,.85,0);root.add(leg);
   box(leg,.29,.74,.34,leather,0,-.37,0);
   box(leg,.34,.22,.45,boots,0,-.76,.06);
 }
 if(identity.characterClass==="vanguard"){
   box(arms[1],.12,.95,.12,metal,0,-1.25,.08);
   box(arms[1],.42,.11,.2,metal,0,-.92,.08);
   const shield=mesh(new THREE.CylinderGeometry(.38,.38,.12,7),metal,arms[0],0,-.43,.26);
   shield.rotation.x=Math.PI/2;
 }else if(identity.characterClass==="spellweaver"){
   box(arms[1],.11,1.52,.11,leather,0,-1.21,.13);
   orb(arms[1],.2,glow,0,-2.02,.13);
   box(root,.8,.2,.45,glow,0,1.5,-.2);
 }else{
   for(const arm of arms){
    box(arm,.12,.62,.16,metal,0,-.98,.13);
    box(arm,.25,.09,.23,leather,0,-.78,.13);
   }
 }
 root.scale.setScalar(identity.race==="ashforged"?1.08:identity.race==="thornkin"?1.04:identity.race==="veilkin"?.96:1);
 return {
  root,
  update(time,moving,attacking){
   const stride=moving?Math.sin(time*9)*.5:0;
   legs[0].rotation.x=stride;legs[1].rotation.x=-stride;
   arms[0].rotation.x=-stride*.5;arms[1].rotation.x=stride*.5;
   arms[1].rotation.z=attacking?-1.1:0;
   torso.rotation.z=moving?Math.sin(time*9)*.025:0;
  },
  dispose(){
   for(const g of geometry)g.dispose();
   for(const m of mats)m.dispose();
  }
 };
}
