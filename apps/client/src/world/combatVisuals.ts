import * as THREE from "three";

export type CombatVisualKind="slash"|"quickstrike"|"arc-bolt"|"bulwark"|"dodge"|"gather";
interface ActiveEffect {
 mesh:THREE.Mesh;
 material:THREE.MeshBasicMaterial;
 life:number;duration:number;
 kind:CombatVisualKind;
 start:THREE.Vector3;end:THREE.Vector3;
}
/** Client-only effects. Damage, cost and targets remain Bun-authoritative. */
export class CombatVisuals{
 private readonly active:ActiveEffect[]=[];
 private readonly sphere=new THREE.IcosahedronGeometry(.25,1);
 private readonly slash=new THREE.TorusGeometry(1.06,.10,5,24,Math.PI*1.4);
 private readonly ring=new THREE.TorusGeometry(1.05,.07,5,28);
 constructor(private readonly scene:THREE.Scene){}
 get activeCount():number{return this.active.length;}
 emit(kind:CombatVisualKind,from:THREE.Vector3,to?:THREE.Vector3):void{
  // Hard cap prevents rapid inputs from growing unbounded VFX geometry or materials.
  if(this.active.length>=16)this.removeAt(0);
  const colors:Record<CombatVisualKind,number>={
   slash:0xf4cd7d,quickstrike:0xb3e8d1,"arc-bolt":0x89caff,
   bulwark:0xe4c47a,dodge:0xb2a2ff,gather:0x8be9b8
  };
  const material=new THREE.MeshBasicMaterial({
   color:colors[kind],transparent:true,opacity:.92,side:THREE.DoubleSide,
   blending:THREE.AdditiveBlending,depthWrite:false
  });
  const geo=kind==="arc-bolt"?this.sphere:
   kind==="slash"||kind==="quickstrike"?this.slash:this.ring;
  const mesh=new THREE.Mesh(geo,material);
  mesh.renderOrder=7;
  mesh.name="RU_VFX_"+kind;
  const start=from.clone().add(new THREE.Vector3(0,kind==="gather"?.4:1.2,0));
  const end=(to??from).clone().add(new THREE.Vector3(0,kind==="arc-bolt"?.95:1.2,0));
  mesh.position.copy(start);
  if(kind==="bulwark"){
   mesh.rotation.x=Math.PI/2;mesh.scale.set(1.1,1.1,1.1);
  }
  if(kind==="dodge"||kind==="gather"){
   mesh.rotation.x=-Math.PI/2;mesh.position.y=from.y+.12;
  }
  if(kind==="slash"||kind==="quickstrike"){
   const direction=end.clone().sub(start);
   mesh.rotation.set(0,Math.atan2(direction.x,direction.z),-.32);
  }
  this.scene.add(mesh);
  this.active.push({
   mesh,material,kind,start,end,life:0,
   duration:kind==="arc-bolt"?.48:kind==="bulwark"?4.0:kind==="dodge"?.48:.4
  });
 }
 update(dt:number):void{
  const safeDt=Math.max(0,Math.min(.05,dt));
  for(let i=this.active.length-1;i>=0;i--){
   const effect=this.active[i];effect.life+=safeDt;
   const progress=Math.min(1,effect.life/effect.duration);
   effect.material.opacity=effect.kind==="bulwark"?.65*(1-progress*.7):.93*(1-progress);
   if(effect.kind==="arc-bolt"){
    effect.mesh.position.lerpVectors(effect.start,effect.end,progress);
    effect.mesh.scale.setScalar(1+.33*Math.sin(progress*12));
   }else if(effect.kind==="slash"||effect.kind==="quickstrike"){
    effect.mesh.rotation.z+=safeDt*8;
    effect.mesh.scale.setScalar(.8+progress*.75);
   }else if(effect.kind==="bulwark"){
    effect.mesh.rotation.z+=safeDt;
    effect.mesh.scale.setScalar(1+.09*Math.sin(effect.life*5));
   }else{
    effect.mesh.scale.setScalar(.5+progress*1.25);
   }
   if(progress>=1)this.removeAt(i);
  }
 }
 private removeAt(index:number):void{
  const [effect]=this.active.splice(index,1);
  if(!effect)return;
  this.scene.remove(effect.mesh);
  effect.material.dispose();
 }
 clear():void{while(this.active.length)this.removeAt(0);}
 dispose():void{this.clear();this.sphere.dispose();this.slash.dispose();this.ring.dispose();}
}
