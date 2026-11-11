import * as THREE from "three";
import { ROAD_OFFSET_METERS, settlementsInChunk } from "./settlements";

const roadMaterial=new THREE.MeshLambertMaterial({color:0x9c8969,side:THREE.DoubleSide});
const wood=new THREE.MeshLambertMaterial({color:0x75563d});
const wall=new THREE.MeshLambertMaterial({color:0xbda77f});
const roof=new THREE.MeshLambertMaterial({color:0x68493b});
const light=new THREE.MeshBasicMaterial({color:0xffcb77});

function addRoad(group:THREE.Group,chunkSize:number,axis:"x"|"z",cx:number,cz:number,heightAt:(x:number,z:number)=>number):void {
  // A 4m-wide terrain-following ribbon. Coordinates match at 64m borders.
  const points:number[]=[],faces:number[]=[];
  const segments=16;
  for(let i=0;i<=segments;i++){
    const along=i*chunkSize/segments;
    for(const side of [-1,1]){
      const x=axis==="x"?along:ROAD_OFFSET_METERS+side*2;
      const z=axis==="x"?ROAD_OFFSET_METERS+side*2:along;
      const wx=cx*chunkSize+x,wz=cz*chunkSize+z;
      points.push(x,heightAt(wx,wz)+.075,z);
    }
    if(i<segments){
      const a=i*2;
      // Winding is double-sided; the road follows terrain without large flat planes.
      faces.push(a,a+2,a+1,a+1,a+2,a+3);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(points,3));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  const road=new THREE.Mesh(geometry,roadMaterial);
  road.userData.disposableWorldGeometry=true;
  group.add(road);
}
export function addChunkInfrastructure(group:THREE.Group,cx:number,cz:number,chunkSize:number,heightAt:(x:number,z:number)=>number):void {
  // Roads form a deterministic orthogonal network every 512 meters.
  if(cz%8===0)addRoad(group,chunkSize,"x",cx,cz,heightAt);
  if(cx%8===0)addRoad(group,chunkSize,"z",cx,cz,heightAt);
  const settlements=settlementsInChunk(cx,cz,chunkSize);
  for(const settlement of settlements){
    if(settlement.id==="settlement-starter")continue;
    const village=new THREE.Group();
    village.name=settlement.id;
    village.userData.settlementId=settlement.id;
    village.position.set(settlement.x-cx*chunkSize,heightAt(settlement.x,settlement.z),settlement.z-cz*chunkSize);
    const houses=settlement.tier==="outpost"?4:2;
    for(let i=0;i<houses;i++){
      const angle=i*Math.PI*2/houses;
      const x=Math.cos(angle)*11,z=Math.sin(angle)*11;
      const home=new THREE.Mesh(new THREE.BoxGeometry(3,2.6,3),wall);
      home.position.set(x,1.3,z);
      village.add(home);
      const top=new THREE.Mesh(new THREE.ConeGeometry(2.6,1.7,4),roof);
      top.rotation.y=Math.PI/4;
      top.position.set(x,3.45,z);
      village.add(top);
    }
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.2,.25,5,6),wood);
    post.position.y=2.5;
    village.add(post);
    const beacon=new THREE.Mesh(new THREE.OctahedronGeometry(.62),light);
    beacon.position.y=5.4;
    village.add(beacon);
    group.add(village);
  }
}
export function disposeChunkInfrastructure(group:THREE.Group):void {
  for(const object of group.children){
    if(object instanceof THREE.Mesh && object.userData.disposableWorldGeometry)object.geometry.dispose();
    if(!object.userData.settlementId)continue;
    object.traverse(child=>{if(child instanceof THREE.Mesh)child.geometry.dispose();});
  }
}
