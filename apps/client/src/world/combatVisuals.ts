import * as THREE from "three";

export type CombatVisualKind="slash"|"quickstrike"|"shadowstep"|"arc-bolt"|"starfall"|"mend"|"aether-ward"|"bulwark"|"veil"|"keen-senses"|"dodge"|"gather";
type VisualMotion="projectile"|"slash"|"hold"|"pulse";
interface ActiveEffect {
 mesh:THREE.Mesh;
 material:THREE.MeshBasicMaterial;
 life:number;duration:number;
 kind:CombatVisualKind;
 motion:VisualMotion;
 start:THREE.Vector3;end:THREE.Vector3;
}
const COLORS:Record<CombatVisualKind,number>={
 slash:0xf4cd7d,quickstrike:0xb3e8d1,shadowstep:0x9ad7c4,"arc-bolt":0x89caff,
 starfall:0xc9b0ff,mend:0x8ee6a8,"aether-ward":0xd5e4ff,
 bulwark:0xe4c47a,veil:0xb9a6e8,"keen-senses":0xf2e7b0,dodge:0xb2a2ff,gather:0x8be9b8
};
function motionFor(kind:CombatVisualKind):VisualMotion{
 switch(kind){
  case "arc-bolt":return "projectile";
  case "slash":
  case "quickstrike":
  case "shadowstep":return "slash";
  case "bulwark":return "hold";
  case "starfall":
  case "mend":
  case "aether-ward":
  case "veil":
  case "keen-senses":
  case "dodge":
  case "gather":return "pulse";
  default:{
   const unexpected:never=kind;
   return unexpected;
  }
 }
}
function durationFor(kind:CombatVisualKind):number{
 switch(kind){
  case "bulwark":return 4;
  case "arc-bolt":return .48;
  case "dodge":return .48;
  case "starfall":return .55;
  case "keen-senses":return .7;
  case "slash":
  case "quickstrike":
  case "shadowstep":
  case "gather":
  case "mend":
  case "aether-ward":
  case "veil":return .45;
  default:{
   const unexpected:never=kind;
   return unexpected;
  }
 }
}
/** Client-only effects. One reused mesh each, capped so casts cannot allocate without bound. */
export class CombatVisuals{
 private readonly active:ActiveEffect[]=[];
 private readonly sphere=new THREE.IcosahedronGeometry(.25,1);
 private readonly slash=new THREE.TorusGeometry(1.06,.10,5,24,Math.PI*1.4);
 private readonly ring=new THREE.TorusGeometry(1.05,.07,5,28);
 constructor(private readonly scene:THREE.Scene){}
 get activeCount():number{return this.active.length;}
 emit(kind:CombatVisualKind,from:THREE.Vector3,to?:THREE.Vector3):void{
  if(this.active.length>=16)this.removeAt(0);
  const motion=motionFor(kind);
  const material=new THREE.MeshBasicMaterial({
   color:COLORS[kind],transparent:true,opacity:.92,side:THREE.DoubleSide,
   blending:THREE.AdditiveBlending,depthWrite:false
  });
  const geo=motion==="projectile"?this.sphere:motion==="slash"?this.slash:this.ring;
  const mesh=new THREE.Mesh(geo,material);
  mesh.renderOrder=7;
  mesh.name="RU_VFX_"+kind;
  const start=from.clone().add(new THREE.Vector3(0,kind==="gather"?.4:1.2,0));
  const end=(to??from).clone().add(new THREE.Vector3(0,kind==="arc-bolt"?.95:1.2,0));
  mesh.position.copy(motion==="pulse"&&kind==="keen-senses"?end:start);
  if(motion==="hold"){
   mesh.rotation.x=Math.PI/2;mesh.scale.setScalar(1.1);
  }
  if(kind==="dodge"||kind==="gather"||kind==="starfall"||kind==="veil"){
   mesh.rotation.x=-Math.PI/2;mesh.position.y=from.y+.12;
  }
  if(motion==="slash"){
   const direction=end.clone().sub(start);
   mesh.rotation.set(0,Math.atan2(direction.x,direction.z),-.32);
  }
  if(kind==="starfall")mesh.scale.setScalar(1.35);
  this.scene.add(mesh);
  this.active.push({mesh,material,kind,motion,start,end,life:0,duration:durationFor(kind)});
 }
 update(dt:number):void{
  const safeDt=Math.max(0,Math.min(.05,dt));
  for(let i=this.active.length-1;i>=0;i--){
   const effect=this.active[i];effect.life+=safeDt;
   const progress=Math.min(1,effect.life/effect.duration);
   effect.material.opacity=effect.motion==="hold"?.65*(1-progress*.7):.93*(1-progress);
   switch(effect.motion){
    case "projectile":
     effect.mesh.position.lerpVectors(effect.start,effect.end,progress);
     effect.mesh.scale.setScalar(1+.33*Math.sin(progress*12));
     break;
    case "slash":
     effect.mesh.rotation.z+=safeDt*8;
     effect.mesh.scale.setScalar(.8+progress*.75);
     break;
    case "hold":
     effect.mesh.rotation.z+=safeDt;
     effect.mesh.scale.setScalar(1+.09*Math.sin(effect.life*5));
     break;
    case "pulse":
     effect.mesh.scale.setScalar((effect.kind==="starfall"?1.2:.5)+progress*(effect.kind==="starfall"?1.8:1.25));
     break;
    default:{
     const unexpected:never=effect.motion;
     void unexpected;
    }
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
