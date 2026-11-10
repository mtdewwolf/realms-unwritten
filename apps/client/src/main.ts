import * as THREE from "three";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App element missing");
app.innerHTML = `
  <canvas id="game"></canvas>
  <header><strong>⚔ REALMS UNWRITTEN</strong><small>THE VERDANT REACH · ANDROID PROTOTYPE</small></header>
  <div id="status">Explore the frontier</div>
  <div id="stick"><div id="knob"></div></div>
  <div id="actions"><button id="gather">⛏<span>GATHER</span></button><button id="attack">⚔<span>ATTACK</span></button></div>
  <div id="hint">Left thumb to move · Drag open terrain to rotate · Pinch to zoom</div>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.4));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x9dc8d1);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9dc8d1);
scene.fog = new THREE.Fog(0x9dc8d1, 33, 85);
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 150);
scene.add(new THREE.HemisphereLight(0xe4f4ff, 0x526e42, 2));
const sunlight = new THREE.DirectionalLight(0xffeed0, 2.5);
sunlight.position.set(-8, 16, 11);
scene.add(sunlight);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshLambertMaterial({ color: 0x547a45 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const track = new THREE.Mesh(
  new THREE.PlaneGeometry(5, 75),
  new THREE.MeshLambertMaterial({ color: 0x9d8f6b })
);
track.rotation.x = -Math.PI / 2;
track.position.y = 0.015;
scene.add(track);

function box(w: number, h: number, d: number, color: number) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
}
function house(x: number, z: number) {
  const wall = box(3, 2.7, 3, 0xb59d79);
  wall.position.set(x, 1.35, z);
  scene.add(wall);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.65, 2.2, 4),
    new THREE.MeshLambertMaterial({ color: 0x674b3b })
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.set(x, 3.6, z);
  scene.add(roof);
  const door = box(0.8, 1.5, 0.07, 0x48352e);
  door.position.set(x, 0.75, z + 1.53);
  scene.add(door);
}
house(-6, -5);
house(7, -9);
house(-7, 7);

const trunkGeo = new THREE.CylinderGeometry(0.19, 0.27, 2.1, 6);
const leavesGeo = new THREE.ConeGeometry(1.35, 3.4, 7);
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x76553a });
const leafMat = new THREE.MeshLambertMaterial({ color: 0x3b6541 });
for (let i = 0; i < 125; i++) {
  const x = Math.sin(i * 79.7) * 43;
  const z = Math.cos(i * 37.3) * 43;
  if (Math.abs(x) < 9 && Math.abs(z) < 15) continue;
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(x, 1, z);
  const leaves = new THREE.Mesh(leavesGeo, leafMat);
  leaves.position.set(x, 3.1, z);
  scene.add(trunk, leaves);
}
const avatar = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.42, 1.0, 4, 8),
  new THREE.MeshLambertMaterial({ color: 0x355db5 })
);
body.position.y = 1.13;
avatar.add(body);
const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.32, 12, 8),
  new THREE.MeshLambertMaterial({ color: 0xe7c7a2 })
);
head.position.y = 2.17;
avatar.add(head);
const sword = box(0.1, 1.45, 0.13, 0xe5eaf2);
sword.position.set(0.59, 1.15, 0.02);
sword.rotation.z = -0.35;
avatar.add(sword);
scene.add(avatar);

const wolf = new THREE.Group();
wolf.add(new THREE.Mesh(
  new THREE.BoxGeometry(1.25, 0.7, 0.6),
  new THREE.MeshLambertMaterial({ color: 0x6d6257 })
));
wolf.position.set(5, 0.7, 5);
scene.add(wolf);

const stick = document.querySelector<HTMLElement>("#stick")!;
const knob = document.querySelector<HTMLElement>("#knob")!;
const status = document.querySelector<HTMLElement>("#status")!;
let axisX = 0, axisZ = 0;
let yaw = Math.PI / 4;
let distance = 20;
let activeStick: number | null = null;
let cameraPointer: number | null = null;
let lastX = 0;
const keys = new Set<string>();
window.addEventListener("keydown", e => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
stick.addEventListener("pointerdown", e => {
  activeStick = e.pointerId;
  stick.setPointerCapture(e.pointerId);
  joystick(e);
});
stick.addEventListener("pointermove", e => {
  if (e.pointerId === activeStick) joystick(e);
});
function joystick(e: PointerEvent) {
  const rect = stick.getBoundingClientRect();
  const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.36);
  const dz = (e.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.36);
  const m = Math.max(1, Math.hypot(dx, dz));
  axisX = Math.abs(dx / m) < 0.12 ? 0 : dx / m;
  axisZ = Math.abs(dz / m) < 0.12 ? 0 : dz / m;
  knob.style.transform = `translate(${axisX * 36}px, ${axisZ * 36}px)`;
}
function endStick(e: PointerEvent) {
  if (activeStick !== e.pointerId) return;
  activeStick = null;
  axisX = axisZ = 0;
  knob.style.transform = "translate(0,0)";
}
stick.addEventListener("pointerup", endStick);
stick.addEventListener("pointercancel", endStick);
canvas.addEventListener("pointerdown", e => {
  cameraPointer = e.pointerId;
  lastX = e.clientX;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", e => {
  if (cameraPointer !== e.pointerId) return;
  yaw -= (e.clientX - lastX) * 0.007;
  lastX = e.clientX;
});
canvas.addEventListener("pointerup", e => {
  if (cameraPointer === e.pointerId) cameraPointer = null;
});
canvas.addEventListener("pointercancel", e => {
  if (cameraPointer === e.pointerId) cameraPointer = null;
});
canvas.addEventListener("wheel", e => {
  distance = THREE.MathUtils.clamp(distance + e.deltaY * 0.01, 11, 30);
}, { passive: true });
document.querySelector("#attack")!.addEventListener("click", () => {
  status.textContent = "Sword slash!";
  sword.rotation.z = -1.3;
  setTimeout(() => sword.rotation.z = -0.35, 180);
});
document.querySelector("#gather")!.addEventListener("click", () => {
  status.textContent = "Gathering requires the multiplayer world server (next milestone).";
});

let previous = performance.now();
function frame(now: number) {
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  const x = axisX + Number(keys.has("d")) - Number(keys.has("a"));
  const z = axisZ + Number(keys.has("s")) - Number(keys.has("w"));
  const length = Math.hypot(x, z);
  if (length > 0.05) {
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const heading = right.multiplyScalar(x).addScaledVector(forward, -z).normalize();
    avatar.position.addScaledVector(heading, dt * 5.5);
    avatar.position.x = THREE.MathUtils.clamp(avatar.position.x, -46, 46);
    avatar.position.z = THREE.MathUtils.clamp(avatar.position.z, -46, 46);
    avatar.rotation.y = Math.atan2(heading.x, heading.z);
  }
  const pitch = THREE.MathUtils.degToRad(55);
  const offset = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch)
  ).multiplyScalar(distance);
  camera.position.copy(avatar.position).add(offset);
  camera.lookAt(avatar.position.x, 1, avatar.position.z);
  const width = window.innerWidth, height = window.innerHeight;
  if (canvas.width !== Math.round(width * renderer.getPixelRatio()) ||
      canvas.height !== Math.round(height * renderer.getPixelRatio())) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
