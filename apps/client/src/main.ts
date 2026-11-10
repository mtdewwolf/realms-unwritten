import * as THREE from "three";
import "./style.css";
import { populateFrontierProps } from "./world/frontierProps";
import { createAdventurer, createWolf } from "./characters/rig";
import { PLAYER_MAX_STAMINA, WOLF_MAX_HEALTH, ATTACK_STAMINA, DODGE_STAMINA, regenerateStamina, useStamina, withinAttackRange } from "./gameplay/combat";

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
populateFrontierProps(scene);

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
const adventurer = createAdventurer();
const avatar = adventurer.root;
scene.add(avatar);
const wolf = createWolf();
wolf.position.set(5, 0, 5);
scene.add(wolf);

const warningRing = new THREE.Mesh(
  new THREE.RingGeometry(1.05, 1.26, 40),
  new THREE.MeshBasicMaterial({color:0xf76553,side:THREE.DoubleSide,transparent:true,opacity:0.8,depthWrite:false})
);
warningRing.rotation.x = -Math.PI/2;
warningRing.position.set(5,0.05,5);
warningRing.visible = false;
scene.add(warningRing);
let wolfHealth = WOLF_MAX_HEALTH;
let playerStamina = PLAYER_MAX_STAMINA;
let lastAttackTime = -10;
let attackingUntil = 0;
let dodgeUntil = 0;
let wolfWarningAt = 0;
let wolfStrikeAt = 0;
let playerHealth = 100;
let previousAttackDistance = 0;
const combatHud = document.createElement("div");
combatHud.id = "combat-hud";
combatHud.innerHTML = '<div>HEALTH <meter id="hp" min="0" max="100" value="100"></meter></div><div>STAMINA <meter id="stamina" min="0" max="100" value="100"></meter></div><div>WOLF <meter id="wolf-hp" min="0" max="60" value="60"></meter></div><strong id="battle-info">Wolf encounter · move closer to attack</strong>';
document.querySelector("#app")!.appendChild(combatHud);
const hpDisplay = document.querySelector<HTMLMeterElement>("#hp")!;
const staminaDisplay = document.querySelector<HTMLMeterElement>("#stamina")!;
const wolfDisplay = document.querySelector<HTMLMeterElement>("#wolf-hp")!;
const battleInfo = document.querySelector<HTMLElement>("#battle-info")!;
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
function attack() {
  const now=performance.now()/1000;
  if(now-lastAttackTime < 0.65 || wolfHealth <= 0) return;
  const next=useStamina(playerStamina,ATTACK_STAMINA);
  if(next===null){battleInfo.textContent="Not enough stamina";return;}
  playerStamina=next;lastAttackTime=now;
  attackingUntil=now+0.27;
  if(withinAttackRange(avatar.position.x,avatar.position.z,wolf.position.x,wolf.position.z)) {
    wolfHealth=Math.max(0,wolfHealth-20);
    battleInfo.textContent=wolfHealth>0?"Sword hit · 20 damage":"Wolf defeated!";
    wolfDisplay.value=wolfHealth;
    if(!wolfHealth) {wolf.visible=false;warningRing.visible=false;}
  } else battleInfo.textContent="Too far from the wolf";
}
function dodge() {
  const now=performance.now()/1000;
  if(now<dodgeUntil)return;
  const next=useStamina(playerStamina,DODGE_STAMINA);
  if(next===null) {battleInfo.textContent="Not enough stamina";return;}
  playerStamina=next;
  dodgeUntil=now+0.6;
  const direction=new THREE.Vector3(Math.sin(avatar.rotation.y),0,Math.cos(avatar.rotation.y));
  avatar.position.addScaledVector(direction,2.25);
  avatar.position.x=THREE.MathUtils.clamp(avatar.position.x,-46,46);
  avatar.position.z=THREE.MathUtils.clamp(avatar.position.z,-46,46);
  battleInfo.textContent="Dodged!";
}
document.querySelector("#attack")!.addEventListener("click", attack);
document.querySelector("#gather")!.addEventListener("click", () => {
  status.textContent="Gathering needs an authoritative world server (planned).";
});
const dodgeButton = document.createElement("button");
dodgeButton.id="dodge";
dodgeButton.innerHTML='↝<span>DODGE</span>';
document.querySelector("#actions")!.prepend(dodgeButton);
dodgeButton.addEventListener("click",dodge);
let previous = performance.now();
let elapsed = 0;
function frame(now: number) {
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  elapsed += dt;
  playerStamina = regenerateStamina(playerStamina,dt);
  staminaDisplay.value=playerStamina;
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
  adventurer.update(elapsed,length>0.05,now/1000<attackingUntil);
  if(wolfHealth>0){
    const dx=avatar.position.x-wolf.position.x, dz=avatar.position.z-wolf.position.z;
    const range=Math.hypot(dx,dz);
    wolf.lookAt(avatar.position.x,0,avatar.position.z);
    if(range<7 && range>2.2 && wolfStrikeAt===0){
      const speed=Math.min(dt*0.85,range-2.2);
      wolf.position.x+=dx/range*speed;
      wolf.position.z+=dz/range*speed;
    }
    if(range<2.7 && wolfStrikeAt===0){
      wolfWarningAt=now/1000;
      wolfStrikeAt=wolfWarningAt+0.85;
      battleInfo.textContent="⚠ Wolf preparing to strike!";
    }
    warningRing.visible=wolfStrikeAt>0;
    warningRing.position.set(wolf.position.x,0.05,wolf.position.z);
    if(wolfStrikeAt>0 && now/1000>=wolfStrikeAt){
      if(range<3.0 && now/1000>dodgeUntil){
        playerHealth=Math.max(0,playerHealth-12);
        hpDisplay.value=playerHealth;
        battleInfo.textContent="Wolf bite · 12 damage";
      } else battleInfo.textContent="Wolf attack missed!";
      wolfStrikeAt=0;
    }
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
