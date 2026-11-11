import * as THREE from "three";

export const CHUNK_SIZE = 64;
export const WORLD_CHUNKS_PER_SIDE = 256;
export const WORLD_HALF_SIZE = CHUNK_SIZE * WORLD_CHUNKS_PER_SIDE / 2;
export const ACTIVE_CHUNK_RADIUS = 2;

export function chunkCoordinate(x: number): number {
  return Math.floor(x / CHUNK_SIZE);
}
export function chunkKey(x: number, z: number): string {
  return x + ":" + z;
}
export function chunkSeed(x: number, z: number): number {
  let s = (Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ 0x9e3779b9) | 0;
  s = Math.imul(s ^ s >>> 13, 1274126177);
  return (s ^ s >>> 16) >>> 0;
}
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = Math.imul(state ^ state >>> 15, 1 | state);
    x ^= x + Math.imul(x ^ x >>> 7, 61 | x);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}
export function activeChunkCoordinates(x: number, z: number, radius=ACTIVE_CHUNK_RADIUS): Array<[number,number]> {
  const cx=chunkCoordinate(x), cz=chunkCoordinate(z);
  const result: Array<[number,number]> = [];
  for(let dz=-radius;dz<=radius;dz++) {
    for(let dx=-radius;dx<=radius;dx++) {
      const tx=cx+dx,tz=cz+dz;
      if(tx>=-128 && tx<128 && tz>=-128 && tz<128) result.push([tx,tz]);
    }
  }
  return result;
}
/**
 * Bounded near-player rendering for an addressable 16.384km square.
 * Source models, materials and geometry are shared; only instance transforms vary.
 */
export class ChunkedWorld {
  private readonly active=new Map<string,THREE.Group>();
  private readonly groundGeo=new THREE.PlaneGeometry(CHUNK_SIZE,CHUNK_SIZE);
  private readonly terrainMat=[
    new THREE.MeshLambertMaterial({color:0x557a48}),
    new THREE.MeshLambertMaterial({color:0x707950}),
    new THREE.MeshLambertMaterial({color:0x486a61})
  ];
  private readonly roadGeo=new THREE.PlaneGeometry(2.5,CHUNK_SIZE);
  private readonly roadMat=new THREE.MeshLambertMaterial({color:0x9d8f6b});
  private readonly trunkGeo=new THREE.CylinderGeometry(0.2,0.3,2.1,6);
  private readonly leafGeo=new THREE.ConeGeometry(1.35,3.3,7);
  private readonly rockGeo=new THREE.DodecahedronGeometry(.8,0);
  private readonly trunkMat=new THREE.MeshLambertMaterial({color:0x76553a});
  private readonly rockMat=new THREE.MeshLambertMaterial({color:0x91938b,flatShading:true});
  private readonly leavesMat=[
    new THREE.MeshLambertMaterial({color:0x3c6944}),
    new THREE.MeshLambertMaterial({color:0x667940}),
    new THREE.MeshLambertMaterial({color:0x356b60})
  ];
  private center="";
  constructor(private readonly scene:THREE.Scene){}
  get loadedChunks():number{return this.active.size;}
  private create(cx:number,cz:number):THREE.Group {
    const group=new THREE.Group();
    group.position.set(cx*CHUNK_SIZE,0,cz*CHUNK_SIZE);
    const region=chunkSeed(Math.floor(cx/8),Math.floor(cz/8))%3;
    const ground=new THREE.Mesh(this.groundGeo,this.terrainMat[region]);
    ground.rotation.x=-Math.PI/2;
    ground.position.set(CHUNK_SIZE/2,0,CHUNK_SIZE/2);
    group.add(ground);
    if(cx===-1||cx===0){
      const road=new THREE.Mesh(this.roadGeo,this.roadMat);
      road.rotation.x=-Math.PI/2;
      road.position.set(cx===-1?CHUNK_SIZE-1.25:1.25,.016,CHUNK_SIZE/2);
      group.add(road);
    }
    const rng=seededRandom(chunkSeed(cx,cz));
    const dummy=new THREE.Object3D();
    const trunks=new THREE.InstancedMesh(this.trunkGeo,this.trunkMat,20);
    const crowns=new THREE.InstancedMesh(this.leafGeo,this.leavesMat[region],20);
    for(let i=0;i<20;i++){
      let x=4+rng()*(CHUNK_SIZE-8),z=4+rng()*(CHUNK_SIZE-8);
      const wx=cx*CHUNK_SIZE+x,wz=cz*CHUNK_SIZE+z;
      // Keep the starting settlement and the axial road clear.
      if(Math.abs(wx)<11 && Math.abs(wz)<17) x=wx<0?4:CHUNK_SIZE-4;
      if(Math.abs(wx)<4) x=wx<0?4:CHUNK_SIZE-4;
      const scale=.75+rng()*.5;
      dummy.scale.setScalar(scale);
      dummy.position.set(x,1.05*scale,z);
      dummy.rotation.y=rng()*Math.PI*2;
      dummy.updateMatrix();
      trunks.setMatrixAt(i,dummy.matrix);
      dummy.position.y=3.15*scale;
      dummy.updateMatrix();
      crowns.setMatrixAt(i,dummy.matrix);
    }
    trunks.instanceMatrix.needsUpdate=true;
    crowns.instanceMatrix.needsUpdate=true;
    group.add(trunks,crowns);
    const rocks=new THREE.InstancedMesh(this.rockGeo,this.rockMat,8);
    for(let i=0;i<8;i++){
      dummy.position.set(3+rng()*(CHUNK_SIZE-6),.25,3+rng()*(CHUNK_SIZE-6));
      const size=.3+rng()*.55;
      dummy.scale.set(size,size*.6,size);
      dummy.rotation.y=rng()*Math.PI;
      dummy.updateMatrix();
      rocks.setMatrixAt(i,dummy.matrix);
    }
    rocks.instanceMatrix.needsUpdate=true;
    group.add(rocks);
    return group;
  }
  update(x:number,z:number):void {
    const cx=chunkCoordinate(x),cz=chunkCoordinate(z),key=chunkKey(cx,cz);
    if(this.center===key)return;
    const coords=activeChunkCoordinates(x,z);
    const wanted=new Set(coords.map(([a,b])=>chunkKey(a,b)));
    for(const [k,g] of this.active){
      if(wanted.has(k))continue;
      this.scene.remove(g);
      g.clear();
      this.active.delete(k);
    }
    for(const [a,b] of coords){
      const k=chunkKey(a,b);
      if(this.active.has(k))continue;
      const group=this.create(a,b);
      this.active.set(k,group);
      this.scene.add(group);
    }
    this.center=key;
  }
}
