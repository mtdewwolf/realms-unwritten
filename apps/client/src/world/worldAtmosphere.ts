import * as THREE from "three";

/** Single draw call sky and inexpensive avatar shadow; mobile-first art direction. */
export class WorldAtmosphere{
 readonly sky:THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;
 private readonly dayFog=new THREE.Color(0xa4c6be);
 private readonly duskFog=new THREE.Color(0x8d7d9c);
 private readonly nightFog=new THREE.Color(0x202f43);
 private readonly contactShadow:THREE.Mesh;
 constructor(private readonly scene:THREE.Scene,private readonly sunlight:THREE.DirectionalLight){
  const shader=new THREE.ShaderMaterial({
   side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,
   uniforms:{
    uTime:{value:0},uSun:{value:new THREE.Vector3(.25,.75,-.15)},
    uDay:{value:1},uTwilight:{value:0}
   },
   vertexShader:[
    "varying vec3 vDir;",
    "void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
   ].join("\n"),
   fragmentShader:[
    "precision mediump float;",
    "varying vec3 vDir;",
    "uniform vec3 uSun;uniform float uTime;uniform float uDay;uniform float uTwilight;",
    "void main(){",
    "vec3 d=normalize(vDir);float h=smoothstep(-.18,.7,d.y);",
    "vec3 night=mix(vec3(.09,.13,.21),vec3(.015,.035,.11),h);",
    "vec3 day=mix(vec3(.67,.78,.71),vec3(.22,.47,.75),h);",
    "vec3 dusk=mix(vec3(.88,.49,.36),vec3(.25,.27,.52),h);",
    "vec3 color=mix(night,day,uDay);color=mix(color,dusk,uTwilight*.75);",
    "float sunDot=max(0.,dot(d,normalize(uSun)));",
    "float glow=pow(sunDot,30.)*(.15+uDay*.23);",
    "float disk=smoothstep(.995,.999,sunDot)*uDay;",
    "color+=vec3(1.,.77,.42)*(glow+disk*.68);",
    "float streak=sin(d.x*46.+d.z*18.+uTime*.008)*.5+.5;",
    "float band=(sin(d.x*27.+uTime*.004)*sin(d.z*29.-uTime*.003))*.5+.5;",
    "float cloud=smoothstep(.72,.96,streak*.55+band*.45)*smoothstep(.02,.19,d.y)*(1.-smoothstep(.53,.78,d.y));",
    "color=mix(color,vec3(.88,.84,.74),cloud*uDay*.28);",
    "gl_FragColor=vec4(color,1.);}"
   ].join("\n")
  });
  this.sky=new THREE.Mesh(new THREE.SphereGeometry(115,24,12),shader);
  this.sky.name="RU_AtmosphericSky";this.sky.frustumCulled=false;this.sky.renderOrder=-1000;
  scene.add(this.sky);
  this.contactShadow=new THREE.Mesh(new THREE.CircleGeometry(.62,20),
   new THREE.MeshBasicMaterial({color:0x19251d,transparent:true,opacity:.26,depthWrite:false,side:THREE.DoubleSide}));
  this.contactShadow.rotation.x=-Math.PI/2;
  this.contactShadow.renderOrder=5;
  scene.add(this.contactShadow);
 }
 update(camera:THREE.Camera,avatar:THREE.Vector3,elapsedSeconds:number):void{
  const angle=((elapsedSeconds/1200)%1)*Math.PI*2;
  const elevation=Math.cos(angle);
  const day=THREE.MathUtils.smoothstep(elevation,-.28,.3);
  const twilight=1-Math.min(1,Math.abs(elevation)/.4);
  const dir=new THREE.Vector3(.45*Math.sin(angle)+.2,elevation*.9+.12,-.4).normalize();
  const uniforms=this.sky.material.uniforms;
  uniforms.uTime.value=elapsedSeconds;
  uniforms.uSun.value.copy(dir);
  uniforms.uDay.value=day;
  uniforms.uTwilight.value=twilight;
  this.sky.position.copy(camera.position);
  this.sunlight.position.copy(dir).multiplyScalar(30);
  this.sunlight.intensity=.4+day*1.75;
  if(this.scene.fog instanceof THREE.FogExp2)
   this.scene.fog.color.copy(this.dayFog.clone().lerp(this.nightFog,1-day).lerp(this.duskFog,twilight*.35));
  this.contactShadow.position.set(avatar.x,avatar.y+.045,avatar.z);
 }
 dispose():void{
  this.scene.remove(this.sky,this.contactShadow);
  this.sky.geometry.dispose();this.sky.material.dispose();
  this.contactShadow.geometry.dispose();(this.contactShadow.material as THREE.Material).dispose();
 }
}
