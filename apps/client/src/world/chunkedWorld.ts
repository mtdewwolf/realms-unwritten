import * as THREE from "three";
import { biomeAt, terrainHeightAt, terrainColorAt, TERRAIN_GRID_STEP } from "./terrain";

export const CHUNK_SIZE=64;
export const WORLD_CHUNKS_PER_SIDE=256;
export const WORLD_HALF_SIZE=CHUNK_SIZE*WORLD_CHUNKS_PER_SIDE/2;
export const ACTIVE_CHUNK_RADIUS=2;
export function chunkCoordinate(x:number):number {return Math.floor(x/CHUNK_SIZE);}
export function chunkKey(x:number,z:number):string{return x+":"+z;}
export function chunkSeed(x:number,z:number):number {
  let s=(Math.imul(x,374761393)^Math.imul(z,668265263)^0x9e3779b9)|0;
  s=Math.imul(s^s>>>13,1274126177);
  return (s^s>>>16)>>>0;
}
export function seededRandom(seed:number):()=>number {
  let state=seed>>>0;
  return ()=>{
    state=(state+0x6d2b79f5)>>>0;
    let x=Math.imul(state^state>>>15,1|state);
    x^=x+Math.imul(x^x>>>7,61|x);
    return ((x^x>>>14)>>>0)/4294967296;
  };
}
export function activeChunkCoordinates(x:number,z:number,radius=ACTIVE_CHUNK_RADIUS):Array<[number,number]> {
  const cx=chunkCoordinate(x),cz=chunkCoordinate(z);
  const result:Array<[number,number]>=[];
  for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
    const tx=cx+dx,tz=cz+dz;
    if(tx>=-128&&tx<128&&tz>=-128&&tz<128)result.push([tx,tz]);
  }
  return result;
}

/** Build a piecewise-linear heightfield in the same coordinate system used by collision. */
export function buildTerrainChunkGeometry(cx:number,cz:number):THREE.BufferGeometry {
  const sides=CHUNK_SIZE/TERRAIN_GRID_STEP;
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  for(let z=0;z<=sides;z++){
    for(let x=0;x<=sides;x++){
      const lx=x*TERRAIN_GRID_STEP,lz=z*TERRAIN_GRID_STEP;
      const wx=cx*CHUNK_SIZE+lx,wz=cz*CHUNK_SIZE+lz;
      const y=terrainHeightAt(wx,wz);
      positions.push(lx,y,lz);
      colors.push(...terrainColorAt(wx,wz));
    }
  }
  for(let z=0;z<sides;z++)for(let x=0;x<sides;x++){
    const a=z*(sides+1)+x,b=a+1,c=a+sides+1,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
/** Matches the actual triangles in buildTerrainChunkGeometry, not just raw noise. */
export function groundHeightAt(x:number,z:number):number{
  const cx=chunkCoordinate(x),cz=chunkCoordinate(z);
  const localX=x-cx*CHUNK_SIZE,localZ=z-cz*CHUNK_SIZE;
  const col=Math.min(15,Math.floor(localX/TERRAIN_GRID_STEP));
  const row=Math.min(15,Math.floor(localZ/TERRAIN_GRID_STEP));
  const u=(localX-col*TERRAIN_GRID_STEP)/TERRAIN_GRID_STEP;
  const v=(localZ-row*TERRAIN_GRID_STEP)/TERRAIN_GRID_STEP;
  const x0=cx*CHUNK_SIZE+col*TERRAIN_GRID_STEP;
  const z0=cz*CHUNK_SIZE+row*TERRAIN_GRID_STEP;
  const h00=terrainHeightAt(x0,z0),h10=terrainHeightAt(x0+TERRAIN_GRID_STEP,z0);
  const h01=terrainHeightAt(x0,z0+TERRAIN_GRID_STEP),h11=terrainHeightAt(x0+TERRAIN_GRID_STEP,z0+TERRAIN_GRID_STEP);
  return u+v<=1 ? h00+(h10-h00)*u+(h01-h00)*v : h11+(h01-h11)*(1-u)+(h10-h11)*(1-v);
}
export class ChunkedWorld {
  private readonly active=new Map<string,{group:THREE.Group;geometry:THREE.BufferGeometry}>();
  private readonly groundMaterial=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.FrontSide});
  private readonly trunkGeo=new THREE.CylinderGeometry(.2,.3,2.1,6);
  private readonly foliageGeo=new THREE.ConeGeometry(1.35,3.3,7);
  private readonly stoneGeo=new THREE.DodecahedronGeometry(.8,0);
  private readonly trunkMat=new THREE.MeshLambertMaterial({color:0x76553a});
  private readonly stoneMat=new THREE.MeshLambertMaterial({color:0x91938b,flatShading:true});
  private readonly foliageMat=[
    new THREE.MeshLambertMaterial({color:0x3c6944}),
    new THREE.MeshLambertMaterial({color:0x667940}),
    new THREE.MeshLambertMaterial({color:0x356b60})
  ];
  private center="";
  constructor(private readonly scene:THREE.Scene){}
  get loadedChunks():number{return this.active.size;}
  private create(cx:number,cz:number):{group:THREE.Group;geometry:THREE.BufferGeometry}{
    const group=new THREE.Group();
    group.position.set(cx*CHUNK_SIZE,0,cz*CHUNK_SIZE);
    const geometry=buildTerrainChunkGeometry(cx,cz);
    group.add(new THREE.Mesh(geometry,this.groundMaterial));
    const rng=seededRandom(chunkSeed(cx,cz));
    const dummy=new THREE.Object3D();
    const trunks=new THREE.InstancedMesh(this.trunkGeo,this.trunkMat,20);
    const crowns=new THREE.InstancedMesh(this.foliageGeo,this.foliageMat[
      biomeAt(cx*CHUNK_SIZE+32,cz*CHUNK_SIZE+32)==="woodland"?0:
      biomeAt(cx*CHUNK_SIZE+32,cz*CHUNK_SIZE+32)==="meadow"?1:2
    ],20);
    for(let i=0;i<20;i++){
      let x=4+rng()*56,z=4+rng()*56;
      let wx=cx*CHUNK_SIZE+x,wz=cz*CHUNK_SIZE+z;
      // Leave the original starter buildings and central approach clear.
      if(Math.abs(wx)<15&&Math.abs(wz)<20){x=wx<0?4:60;wx=cx*CHUNK_SIZE+x;}
      if(Math.abs(wx)<4){x=wx<0?4:60;wx=cx*CHUNK_SIZE+x;}
      const scale=.75+rng()*.5;
      dummy.scale.setScalar(scale);
      dummy.position.set(x,groundHeightAt(wx,wz)+1.05*scale,z);
      dummy.rotation.y=rng()*Math.PI*2;
      dummy.updateMatrix();
      trunks.setMatrixAt(i,dummy.matrix);
      dummy.position.y=groundHeightAt(wx,wz)+3.15*scale;
      dummy.updateMatrix();
      crowns.setMatrixAt(i,dummy.matrix);
    }
    trunks.instanceMatrix.needsUpdate=true;
    crowns.instanceMatrix.needsUpdate=true;
    group.add(trunks,crowns);
    const rocks=new THREE.InstancedMesh(this.stoneGeo,this.stoneMat,8);
    for(let i=0;i<8;i++){
      const x=3+rng()*58,z=3+rng()*58;
      const wx=cx*CHUNK_SIZE+x,wz=cz*CHUNK_SIZE+z;
      const size=.3+rng()*.55;
      dummy.position.set(x,groundHeightAt(wx,wz)+.25*size,z);
      dummy.scale.set(size,size*.6,size);
      dummy.rotation.y=rng()*Math.PI;
      dummy.updateMatrix();
      rocks.setMatrixAt(i,dummy.matrix);
    }
    rocks.instanceMatrix.needsUpdate=true;
    group.add(rocks);
    return {group,geometry};
  }
  update(x:number,z:number):void{
    const cx=chunkCoordinate(x),cz=chunkCoordinate(z),key=chunkKey(cx,cz);
    if(this.center===key)return;
    const wanted=new Set(activeChunkCoordinates(x,z).map(([a,b])=>chunkKey(a,b)));
    for(const [k,chunk] of this.active){
      if(wanted.has(k))continue;
      this.scene.remove(chunk.group);
      chunk.group.clear();
      chunk.geometry.dispose();
      this.active.delete(k);
    }
    for(const [a,b] of activeChunkCoordinates(x,z)){
      const k=chunkKey(a,b);
      if(this.active.has(k))continue;
      const chunk=this.create(a,b);
      this.active.set(k,chunk);
      this.scene.add(chunk.group);
    }
    this.center=key;
  }
}
