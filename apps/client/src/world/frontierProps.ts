import * as THREE from "three";

/**
 * First-pass original procedural world art, no downloaded or unlicensed assets.
 * Disposable geometry: swap with compressed GLB assets by stable catalog ID later.
 */
export function populateFrontierProps(scene: THREE.Scene): void {
  const wood = new THREE.MeshLambertMaterial({ color: 0x76513c });
  const darkWood = new THREE.MeshLambertMaterial({ color: 0x4c392d });
  const cloth = [
    new THREE.MeshLambertMaterial({ color: 0xb15344, side: THREE.DoubleSide }),
    new THREE.MeshLambertMaterial({ color: 0x446d8a, side: THREE.DoubleSide }),
    new THREE.MeshLambertMaterial({ color: 0xaaa16b, side: THREE.DoubleSide })
  ];
  const stone = new THREE.MeshLambertMaterial({ color: 0x8d9388, flatShading: true });
  const groundFlower = [
    new THREE.MeshLambertMaterial({ color: 0xe6c85d }),
    new THREE.MeshLambertMaterial({ color: 0xa8badd }),
    new THREE.MeshLambertMaterial({ color: 0xe9e0dc })
  ];
  function cube(parent: THREE.Object3D, size: [number,number,number], at: [number,number,number], mat: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  }
  function stall(x: number, z: number, material: THREE.Material) {
    const group = new THREE.Group();
    group.position.set(x,0,z);
    cube(group,[2.5,0.18,1.4],[0,1.05,0],wood);
    cube(group,[2.55,0.18,1.45],[0,2.55,0],material);
    for (const dx of [-1.04,1.04]) for (const dz of [-0.54,0.54]) {
      cube(group,[0.13,2.55,0.13],[dx,1.27,dz],darkWood);
    }
    for(let i=0;i<4;i++) cube(group,[0.34,0.3,0.33],[-0.72+i*0.46,1.28,-0.12],i%2?wood:stone);
    scene.add(group);
  }
  stall(-3.75,1.5,cloth[0]);
  stall(3.9,-1.8,cloth[1]);
  stall(4.1,5.0,cloth[2]);

  const rockGeometry = new THREE.DodecahedronGeometry(0.8,0);
  const rocks = new THREE.InstancedMesh(rockGeometry,stone,36);
  const transform = new THREE.Object3D();
  for(let i=0;i<36;i++){
    const angle=i*2.39996;
    const r=15+(i*19%22);
    transform.position.set(Math.cos(angle)*r,0.4,Math.sin(angle)*r);
    const s=0.45+(i%5)*0.16;
    transform.scale.set(s,0.5*s,0.8*s);
    transform.rotation.set(i*0.3,i*0.71,0);
    transform.updateMatrix();
    rocks.setMatrixAt(i,transform.matrix);
  }
  rocks.instanceMatrix.needsUpdate=true;
  scene.add(rocks);

  const flowerGeometry=new THREE.TetrahedronGeometry(0.16,0);
  for(let color=0;color<3;color++){
    const flowers = new THREE.InstancedMesh(flowerGeometry,groundFlower[color],65);
    for(let i=0;i<65;i++){
      const a=i*2.39996+color;
      const r=10+(i*13%28);
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      transform.position.set(x,0.16,z);
      transform.rotation.set(i*0.27,0,i*0.4);
      transform.scale.setScalar(0.7+(i%4)*0.15);
      transform.updateMatrix();
      flowers.setMatrixAt(i,transform.matrix);
    }
    flowers.instanceMatrix.needsUpdate=true;
    scene.add(flowers);
  }

  const fire = new THREE.Group();
  fire.position.set(-3.5,0,-12);
  for(let i=0;i<6;i++){
    const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(0.25,0),stone);
    rock.position.set(Math.cos(i*Math.PI/3)*0.75,0.22,Math.sin(i*Math.PI/3)*0.75);
    fire.add(rock);
  }
  const flame=new THREE.Mesh(
    new THREE.ConeGeometry(0.42,0.95,6),
    new THREE.MeshBasicMaterial({color:0xf5a538})
  );
  flame.position.y=0.63;
  fire.add(flame);
  scene.add(fire);

  const sign=new THREE.Group();
  sign.position.set(2.4,0,11);
  cube(sign,[0.2,2.5,0.2],[0,1.25,0],darkWood);
  cube(sign,[1.8,0.46,0.14],[0.4,2.0,0],wood);
  scene.add(sign);
}
