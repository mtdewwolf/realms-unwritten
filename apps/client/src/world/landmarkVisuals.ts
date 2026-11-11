import * as THREE from "three";
import { landmarkInChunk, type Landmark } from "./landmarks";

/** Original, inexpensive world-space landmark blockouts. */
const material = {
  stone:new THREE.MeshLambertMaterial({color:0x737d75,flatShading:true}),
  darkStone:new THREE.MeshLambertMaterial({color:0x4b5452,flatShading:true}),
  ore:new THREE.MeshLambertMaterial({color:0x607b92}),
  amber:new THREE.MeshBasicMaterial({color:0xe6b56b}),
  earth:new THREE.MeshLambertMaterial({color:0x4e3a31}),
  bone:new THREE.MeshLambertMaterial({color:0xc7b7a0}),
};
function block(parent:THREE.Group,geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number):void{
  const mesh=new THREE.Mesh(geo,mat);
  mesh.position.set(x,y,z);
  parent.add(mesh);
}
function shape(poi:Landmark):THREE.Group {
  const group=new THREE.Group();
  if(poi.type==="ruins"){
    const pillar=new THREE.BoxGeometry(1.1,4,1.1);
    const cap=new THREE.BoxGeometry(1.8,.45,1.8);
    for(const [x,z,h] of [[-1.7,-1.7,1],[1.7,-1.7,0.7],[-1.7,1.7,0.55],[1.7,1.7,0.85]]){
      const mesh=new THREE.Mesh(pillar,material.stone);
      mesh.scale.y=h;
      mesh.position.set(x,2*h,z);
      group.add(mesh);
    }
    block(group,cap,material.darkStone,0,3.65,0);
    const beacon=new THREE.Mesh(new THREE.OctahedronGeometry(.5),material.amber);
    beacon.position.y=4.6;group.add(beacon);
  } else if(poi.type==="ore") {
    for(let i=0;i<5;i++){
      const shard=new THREE.Mesh(new THREE.OctahedronGeometry(.7+(i%3)*.25),material.ore);
      shard.position.set(Math.cos(i*2.4)*1.7,.55+((i%3)*.2),Math.sin(i*2.4)*1.7);
      shard.rotation.set(i*.2,i*.6,i*.12);
      group.add(shard);
    }
  } else {
    const mound=new THREE.Mesh(new THREE.SphereGeometry(2.5,9,5,0,Math.PI*2,0,Math.PI/2),material.earth);
    mound.scale.set(1,.72,1);group.add(mound);
    const entrance=new THREE.Mesh(new THREE.SphereGeometry(.95,10,6),material.darkStone);
    entrance.position.set(0,.55,1.85);group.add(entrance);
    for(const x of [-.8,.8]){
      const fang=new THREE.Mesh(new THREE.ConeGeometry(.2,.65,6),material.bone);
      fang.position.set(x,.4,2.65);group.add(fang);
    }
  }
  group.userData.landmarkId=poi.id;
  return group;
}
export function addChunkLandmarks(group:THREE.Group,cx:number,cz:number,chunkSize:number,heightAt:(x:number,z:number)=>number):void{
  for(const poi of landmarkInChunk(cx,cz,chunkSize)){
    const model=shape(poi);
    model.position.set(poi.x-cx*chunkSize,heightAt(poi.x,poi.z),poi.z-cz*chunkSize);
    model.name=poi.id;
    group.add(model);
  }
}
/** Each independently authored landmark contains owned geometry.
 *  Called before unloading a chunk; shared materials are intentionally retained.
 */
export function disposeChunkLandmarks(group:THREE.Group):void{
  for(const obj of group.children){
    if(!obj.userData.landmarkId)continue;
    obj.traverse(child=>{
      if(child instanceof THREE.Mesh)child.geometry.dispose();
    });
  }
}
