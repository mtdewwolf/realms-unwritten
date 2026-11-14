import * as THREE from "three";
import {biomeAt,type Biome} from "./terrain";

/** Deterministic, decorative low-poly flora. No server gameplay/collision changes. */
export type FloraKind="grass"|"fern"|"bloom"|"shrub"|"mushroom"|"heather";
export interface FloraPlacement {kind:FloraKind;x:number;z:number;scale:number;rotation:number}
const allKinds:readonly FloraKind[]=["grass","fern","bloom","shrub","mushroom","heather"];
function seed(cx:number,cz:number):number{
 let x=Math.imul(cx,374761393)^Math.imul(cz,668265263)^0x7f4a7c15;
 x=Math.imul(x^(x>>>13),1274126177);
 return (x^(x>>>16))>>>0;
}
function randomStream(value:number):()=>number{
 let state=value>>>0;
 return ()=>{state=(state+0x6d2b79f5)>>>0;let x=Math.imul(state^state>>>15,1|state);x^=x+Math.imul(x^x>>>7,61|x);return ((x^x>>>14)>>>0)/4294967296;};
}
const weights:Record<Biome,readonly number[]>={
 meadow:[.42,.12,.22,.09,.03,.12],
 woodland:[.20,.34,.07,.18,.16,.05],
 highlands:[.15,.07,.07,.09,.12,.50]
};
/** All numbers and IDs are derived solely from chunk coordinates, not streaming order. */
export function floraInChunk(cx:number,cz:number,size=64,count=88):FloraPlacement[]{
 const rng=randomStream(seed(cx,cz));
 const results:FloraPlacement[]=[];
 for(let i=0;i<count;i++){
  const x=2+rng()*(size-4),z=2+rng()*(size-4);
  const wx=cx*size+x,wz=cz*size+z;
  const choice=rng(),weightsHere=weights[biomeAt(wx,wz)];
  let cum=0,index=0;
  for(let k=0;k<weightsHere.length;k++){cum+=weightsHere[k];if(choice<cum){index=k;break;}}
  const scale=.65+rng()*.85,rotation=rng()*Math.PI*2;
  // Keep central town, roads and quest NPC visually readable.
  if(Math.abs(wx)<18&&Math.abs(wz)<22)continue;
  if(Math.abs(wx-8)<3.4||Math.abs(wz-8)<3.4)continue;
  results.push({kind:allKinds[index],x,z,scale,rotation});
 }
 return results;
}
const stem=new THREE.MeshLambertMaterial({color:0x4e7950,side:THREE.DoubleSide,flatShading:true});
const leaf=new THREE.MeshLambertMaterial({color:0x56835b,side:THREE.DoubleSide,flatShading:true});
const fernLeaf=new THREE.MeshLambertMaterial({color:0x3c765b,side:THREE.DoubleSide,flatShading:true});
const bloom=new THREE.MeshLambertMaterial({color:0xe2c478,side:THREE.DoubleSide,flatShading:true});
const pink=new THREE.MeshLambertMaterial({color:0xac7795,side:THREE.DoubleSide,flatShading:true});
const mushroom=new THREE.MeshLambertMaterial({color:0xd0a56d,side:THREE.DoubleSide,flatShading:true});
const cap=new THREE.MeshLambertMaterial({color:0xab6650,side:THREE.DoubleSide,flatShading:true});
const geometryCache=new Map<FloraKind,THREE.BufferGeometry>();
const materialCache=new Map<FloraKind,THREE.Material[]>();
function buildKind(kind:FloraKind):{geometry:THREE.BufferGeometry;materials:THREE.Material[]}{
 const saved=geometryCache.get(kind),materials=materialCache.get(kind);
 if(saved&&materials)return {geometry:saved,materials};
 const specs:Record<FloraKind,()=>{parts:Array<{g:THREE.BufferGeometry;m:THREE.Material;pos:[number,number,number];rot?:[number,number,number]}>;mats:THREE.Material[]}>={
  grass:()=>({mats:[stem,leaf],parts:[
   {g:new THREE.ConeGeometry(.20,.95,3),m:stem,pos:[0,.45,0],rot:[0,0,-.2]},
   {g:new THREE.ConeGeometry(.17,.75,3),m:leaf,pos:[.13,.32,.07],rot:[.18,0,.42]},
   {g:new THREE.ConeGeometry(.15,.82,3),m:stem,pos:[-.13,.39,-.08],rot:[-.14,0,-.4]}]}),
  fern:()=>({mats:[stem,fernLeaf],parts:Array.from({length:5},(_,i)=>({
   g:new THREE.ConeGeometry(.18,.95,4),m:i%2?stem:fernLeaf,
   pos:[Math.cos(i*1.256)*.26,.37,Math.sin(i*1.256)*.26] as [number,number,number],
   rot:[Math.sin(i*1.256)*.7,0,Math.cos(i*1.256)*-.7] as [number,number,number]
  }))}),
  bloom:()=>({mats:[stem,bloom],parts:[
   {g:new THREE.CylinderGeometry(.035,.05,.74,4),m:stem,pos:[0,.36,0]},
   {g:new THREE.IcosahedronGeometry(.24,0),m:bloom,pos:[0,.81,0]},
   {g:new THREE.ConeGeometry(.14,.48,3),m:leaf,pos:[-.15,.28,0],rot:[0,0,-.7]}]}),
  shrub:()=>({mats:[leaf,fernLeaf],parts:[
   {g:new THREE.IcosahedronGeometry(.53,0),m:leaf,pos:[0,.48,0]},
   {g:new THREE.IcosahedronGeometry(.34,0),m:fernLeaf,pos:[-.36,.61,.1]},
   {g:new THREE.IcosahedronGeometry(.34,0),m:leaf,pos:[.38,.57,-.05]}]}),
  mushroom:()=>({mats:[mushroom,cap],parts:[
   {g:new THREE.CylinderGeometry(.09,.12,.47,6),m:mushroom,pos:[0,.24,0]},
   {g:new THREE.ConeGeometry(.37,.43,7),m:cap,pos:[0,.65,0]}]}),
  heather:()=>({mats:[pink,stem],parts:[
   {g:new THREE.ConeGeometry(.24,.85,5),m:pink,pos:[0,.48,0]},
   {g:new THREE.ConeGeometry(.18,.72,4),m:stem,pos:[.19,.33,.04],rot:[0,0,.4]},
   {g:new THREE.ConeGeometry(.16,.66,4),m:pink,pos:[-.19,.3,0],rot:[0,0,-.45]}]})
 };
 const {parts,mats}=specs[kind]();
 // Merge via explicit indexed, transformed triangles: one geometry/draw per flora type.
 const pos:number[]=[],normal:number[]=[],indices:number[]=[],groups:Array<{start:number;count:number;materialIndex:number}>=[];
 let base=0;
 for(const part of parts){
  part.g.computeVertexNormals();
  const matIndex=mats.indexOf(part.m);
  const transform=new THREE.Matrix4().compose(new THREE.Vector3(...part.pos),
   new THREE.Quaternion().setFromEuler(new THREE.Euler(...(part.rot??[0,0,0]))),new THREE.Vector3(1,1,1));
  const normalMatrix=new THREE.Matrix3().getNormalMatrix(transform);
  const p=part.g.getAttribute("position"),n=part.g.getAttribute("normal"),ix=part.g.getIndex();
  for(let j=0;j<p.count;j++){
   const v=new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(transform);
   const nv=new THREE.Vector3().fromBufferAttribute(n,j).applyMatrix3(normalMatrix).normalize();
   pos.push(v.x,v.y,v.z);normal.push(nv.x,nv.y,nv.z);
  }
  const start=indices.length;
  if(ix){for(let j=0;j<ix.count;j++)indices.push(base+ix.getX(j));}
  else for(let j=0;j<p.count;j++)indices.push(base+j);
  groups.push({start,count:indices.length-start,materialIndex:matIndex});
  base+=p.count;
  part.g.dispose();
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
 geometry.setAttribute("normal",new THREE.Float32BufferAttribute(normal,3));
 geometry.setIndex(indices);
 for(const group of groups)geometry.addGroup(group.start,group.count,group.materialIndex);
 geometryCache.set(kind,geometry);materialCache.set(kind,mats);
 return {geometry,materials:mats};
}
/** Returns one container per chunk. Shared geometry/materials are never disposed during streaming. */
export function addBiomeFlora(group:THREE.Group,cx:number,cz:number,size:number,heightAt:(x:number,z:number)=>number):void{
 const list=floraInChunk(cx,cz,size),object=new THREE.Object3D();
 for(const kind of allKinds){
  const items=list.filter(p=>p.kind===kind);
  if(!items.length)continue;
  const {geometry,materials}=buildKind(kind);
  const batch=new THREE.InstancedMesh(geometry,materials,items.length);
  batch.name="flora-"+kind;
  for(let i=0;i<items.length;i++){
   const p=items[i],wx=cx*size+p.x,wz=cz*size+p.z;
   object.position.set(p.x,heightAt(wx,wz)-.03,p.z);
   object.rotation.set(0,p.rotation,0);
   object.scale.setScalar(p.scale);object.updateMatrix();
   batch.setMatrixAt(i,object.matrix);
  }
  batch.instanceMatrix.needsUpdate=true;
  batch.computeBoundingSphere();
  group.add(batch);
 }
}
