import * as THREE from "three";
type AnimatedCharacter = {
  root: THREE.Group;
  update: (elapsed: number, moving: boolean, attacking: boolean) => void;
};
export function createAdventurer(): AnimatedCharacter {
  const root = new THREE.Group();
  const tunic = new THREE.MeshLambertMaterial({color:0x315f91});
  const leather = new THREE.MeshLambertMaterial({color:0x5d4434});
  const skin = new THREE.MeshLambertMaterial({color:0xdfb88e});
  const steel = new THREE.MeshLambertMaterial({color:0xc8d9e0});
  const boots = new THREE.MeshLambertMaterial({color:0x322a28});
  const hair = new THREE.MeshLambertMaterial({color:0x3d3029});
  function box(parent: THREE.Object3D, w:number,h:number,d:number,material:THREE.Material, x=0,y=0,z=0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    m.position.set(x,y,z); parent.add(m); return m;
  }
  const torso = box(root,0.78,0.88,0.45,tunic,0,1.32,0);
  box(root,0.85,0.16,0.51,leather,0,0.91,0);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.29,12,9),skin);
  head.position.set(0,2.02,0);root.add(head);
  box(root,0.6,0.17,0.52,hair,0,2.27,0);
  const leftArm=new THREE.Group(), rightArm=new THREE.Group();
  leftArm.position.set(-0.49,1.68,0);rightArm.position.set(0.49,1.68,0);
  box(leftArm,0.24,0.75,0.28,tunic,0,-0.37,0);
  box(rightArm,0.24,0.75,0.28,tunic,0,-0.37,0);
  box(leftArm,0.26,0.16,0.3,leather,0,-0.76,0);
  box(rightArm,0.26,0.16,0.3,leather,0,-0.76,0);
  root.add(leftArm,rightArm);
  const leftLeg=new THREE.Group(),rightLeg=new THREE.Group();
  leftLeg.position.set(-0.21,0.84,0);rightLeg.position.set(0.21,0.84,0);
  box(leftLeg,0.28,0.79,0.33,leather,0,-0.38,0);
  box(rightLeg,0.28,0.79,0.33,leather,0,-0.38,0);
  box(leftLeg,0.32,0.22,0.43,boots,0,-0.73,0.07);
  box(rightLeg,0.32,0.22,0.43,boots,0,-0.73,0.07);
  root.add(leftLeg,rightLeg);
  const swordGrip=box(rightArm,0.11,0.28,0.11,leather,0,-0.86,0.08);
  swordGrip.rotation.z=0.1;
  box(rightArm,0.13,1.18,0.13,steel,0,-1.48,0.08);
  box(rightArm,0.48,0.12,0.2,steel,0,-0.98,0.08);
  const shield=new THREE.Mesh(new THREE.CylinderGeometry(0.43,0.43,0.11,8),steel);
  shield.rotation.x=Math.PI/2;
  shield.position.set(0,-0.55,0.25);
  leftArm.add(shield);
  let hit=0;
  return {
    root,
    update(elapsed,moving,attacking) {
      const walk=moving?Math.sin(elapsed*10)*0.55:0;
      leftLeg.rotation.x=walk;rightLeg.rotation.x=-walk;
      leftArm.rotation.x=-walk*0.65;
      rightArm.rotation.x=walk*0.65;
      if(attacking){hit=Math.min(1,hit+0.2);}
      else hit=Math.max(0,hit-0.10);
      rightArm.rotation.z=-hit*1.3;
      rightArm.rotation.x+=hit*0.5;
      torso.rotation.z=moving?Math.sin(elapsed*10)*0.03:0;
    }
  };
}
export function createWolf(): THREE.Group {
  const root=new THREE.Group();
  const fur=new THREE.MeshLambertMaterial({color:0x74665d});
  const dark=new THREE.MeshLambertMaterial({color:0x514943});
  const eye=new THREE.MeshBasicMaterial({color:0xffce60});
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.15,0.63,0.53),fur);
  body.position.y=0.66;root.add(body);
  const snout=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.33,0.34),dark);
  snout.position.set(0,0.79,0.56);root.add(snout);
  for(const x of [-0.29,0.29]){
    const ear=new THREE.Mesh(new THREE.ConeGeometry(0.14,0.3,4),dark);
    ear.position.set(x,1.15,0.3);root.add(ear);
    const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.06,6,5),eye);
    pupil.position.set(x*0.8,0.86,0.35);root.add(pupil);
  }
  for(const x of [-0.37,0.37])for(const z of [-0.19,0.19]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(0.19,0.49,0.21),dark);
    leg.position.set(x,0.25,z);root.add(leg);
  }
  return root;
}
