import * as THREE from "three";
import "./style.css";
import { populateFrontierProps } from "./world/frontierProps";
import { ChunkedWorld, WORLD_HALF_SIZE, chunkCoordinate, groundHeightAt } from "./world/chunkedWorld";
import { biomeAt } from "./world/terrain";
import { landmarksNear, discoverableLandmarks } from "./world/landmarks";
import { WorldMap } from "./ui/worldMap";
import { MultiplayerClient } from "./multiplayer/client";
import { settlementsNear, discoverySettlements } from "./world/settlements";
import { createAdventurer, createWolf } from "./characters/rig";
import { mountAnimatedAsset, type AnimatedAsset, type AnimationState } from "./characters/animatedAsset";
import { pointerSpacing, zoomFromPinch } from "./input/touchCamera";
import { PLAYER_MAX_STAMINA, WOLF_MAX_HEALTH, ATTACK_STAMINA, DODGE_STAMINA, regenerateStamina, useStamina, withinAttackRange } from "./gameplay/combat";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App element missing");
app.innerHTML = `
  <canvas id="game"></canvas>
  <header><strong>⚔ REALMS UNWRITTEN</strong><small>THE VERDANT REACH · ANDROID PROTOTYPE</small></header>
  <div id="status">Explore the frontier</div>
  <div id="world-coordinates">REGION 0,0</div>
  <div id="exploration">Discover the frontier</div>
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

const world = new ChunkedWorld(scene);
world.update(0,0);

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

const adventurer = createAdventurer();
const avatar = new THREE.Group();
avatar.add(adventurer.root);
scene.add(avatar);
const wolf = new THREE.Group();
const fallbackWolf = createWolf();
wolf.add(fallbackWolf);
wolf.position.set(5, 0, 5);
scene.add(wolf);
let playerAsset: AnimatedAsset | null = null;
let wolfAsset: AnimatedAsset | null = null;
mountAnimatedAsset(avatar, adventurer.root, "/assets/adventurer.glb", ["idle","walk","attack","dodge"])
  .then(asset => { playerAsset = asset; status.textContent = asset.loaded ? "Adventurer GLB loaded" : "Adventurer fallback active"; });
mountAnimatedAsset(wolf, fallbackWolf, "/assets/wolf.glb", ["idle","walk","attack","death"])
  .then(asset => { wolfAsset = asset; if(!asset.loaded) console.warn("Wolf GLB unavailable"); });
let wolfAttackAnimationUntil = 0;

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
let nextWolfAttackAt = 0;
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
const coordinates = document.querySelector<HTMLElement>("#world-coordinates")!;
const exploration = document.querySelector<HTMLElement>("#exploration")!;
const atlas = new WorldMap(app);
const multiplayer = new MultiplayerClient(scene, avatar, text=>{status.textContent=text;});
const multiplayerPanel=document.createElement("div");
multiplayerPanel.id="multiplayer-panel";
multiplayerPanel.innerHTML='<input id="server-url" aria-label="Multiplayer server URL" placeholder="ws://192.168.1.50:3001/ws" autocomplete="off"/><button id="server-connect" type="button">CONNECT</button><button id="server-disconnect" type="button">OFFLINE</button>';
app.appendChild(multiplayerPanel);
const serverUrlInput=multiplayerPanel.querySelector<HTMLInputElement>("#server-url")!;
multiplayerPanel.querySelector("#server-connect")!.addEventListener("click",()=>multiplayer.connect(serverUrlInput.value.trim()));
multiplayerPanel.querySelector("#server-disconnect")!.addEventListener("click",()=>{multiplayer.disconnect();status.textContent="Offline · local exploration";});
const isLocalHost=["localhost","127.0.0.1"].includes(location.hostname);
if(isLocalHost)serverUrlInput.value="ws://"+location.hostname+":3001/ws";

const discoveryKey = "realms-unwritten-discoveries-v1";
let discovered = new Set<string>();
try { const saved=JSON.parse(localStorage.getItem(discoveryKey) || "[]"); if(Array.isArray(saved))discovered=new Set(saved.filter((id): id is string => typeof id==="string")); } catch { /* Private mode or bad data: current session only */ }
let nextDiscoveryScan = 0;
const settlementDiscoveryKey="realms-unwritten-settlement-discoveries-v1";
let knownSettlements=new Set<string>();
try {const data=JSON.parse(localStorage.getItem(settlementDiscoveryKey)||"[]");if(Array.isArray(data))knownSettlements=new Set(data.filter((id):id is string=>typeof id==="string"));}catch{/* Device-only progress */}
let axisX = 0, axisZ = 0;
let yaw = Math.PI / 4;
let distance = 20;
let activeStick: number | null = null;
const cameraTouches = new Map<number, {x: number; y: number}>();
let lastCameraX = 0;
let lastPinchDistance = 0;
const keys = new Set<string>();
window.addEventListener("keydown", e => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
function resetTouchInput(){
  axisX=axisZ=0;activeStick=null;cameraTouches.clear();
  lastPinchDistance=0;knob.style.transform="translate(0,0)";
  keys.clear();
}
document.addEventListener("visibilitychange",()=>{if(document.hidden)resetTouchInput();});
window.addEventListener("blur",resetTouchInput);
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
  if (cameraTouches.size >= 2) return;
  cameraTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  canvas.setPointerCapture(e.pointerId);
  if(cameraTouches.size===1) lastCameraX=e.clientX;
  else lastPinchDistance=pointerSpacing([...cameraTouches.values()]);
});
canvas.addEventListener("pointermove", e => {
  if (!cameraTouches.has(e.pointerId)) return;
  cameraTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(cameraTouches.size===1) {
    yaw -= (e.clientX-lastCameraX)*0.007;
    lastCameraX=e.clientX;
  } else if(cameraTouches.size===2) {
    const nextDistance=pointerSpacing([...cameraTouches.values()]);
    if(lastPinchDistance>0) distance=zoomFromPinch(distance,lastPinchDistance,nextDistance);
    lastPinchDistance=nextDistance;
  }
});
function releaseCameraPointer(e:PointerEvent) {
  if(!cameraTouches.delete(e.pointerId)) return;
  if(cameraTouches.size===1) lastCameraX=[...cameraTouches.values()][0].x;
  else lastPinchDistance=0;
}
canvas.addEventListener("pointerup", releaseCameraPointer);
canvas.addEventListener("pointercancel", releaseCameraPointer);
canvas.addEventListener("wheel", e => {
  distance = THREE.MathUtils.clamp(distance + e.deltaY * 0.01, 11, 30);
}, { passive: true });
function attack() {
  const now=performance.now()/1000;
  if(now-lastAttackTime < 0.65 || wolfHealth <= 0 || playerHealth <= 0) return;
  const next=useStamina(playerStamina,ATTACK_STAMINA);
  if(next===null){battleInfo.textContent="Not enough stamina";return;}
  playerStamina=next;lastAttackTime=now;
  attackingUntil=now+0.27;
  if(withinAttackRange(avatar.position.x,avatar.position.z,wolf.position.x,wolf.position.z)) {
    wolfHealth=Math.max(0,wolfHealth-20);
    battleInfo.textContent=wolfHealth>0?"Sword hit · 20 damage":"Wolf defeated!";
    wolfDisplay.value=wolfHealth;
    if(!wolfHealth) {
      warningRing.visible=false;
      if (!wolfAsset?.loaded) wolf.visible=false;
    }
  } else battleInfo.textContent="Too far from the wolf";
}
function dodge() {
  const now=performance.now()/1000;
  if(now<dodgeUntil || playerHealth<=0)return;
  const next=useStamina(playerStamina,DODGE_STAMINA);
  if(next===null) {battleInfo.textContent="Not enough stamina";return;}
  playerStamina=next;
  dodgeUntil=now+0.6;
  const direction=new THREE.Vector3(Math.sin(avatar.rotation.y),0,Math.cos(avatar.rotation.y));
  avatar.position.addScaledVector(direction,2.25);
  avatar.position.x=THREE.MathUtils.clamp(avatar.position.x,-WORLD_HALF_SIZE+2,WORLD_HALF_SIZE-2);
  avatar.position.z=THREE.MathUtils.clamp(avatar.position.z,-WORLD_HALF_SIZE+2,WORLD_HALF_SIZE-2);
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
  if (length > 0.05 && playerHealth > 0) {
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const heading = right.multiplyScalar(x).addScaledVector(forward, -z).normalize();
    if(!multiplayer.connected)avatar.position.addScaledVector(heading, dt * 5.5);
    avatar.position.x = THREE.MathUtils.clamp(avatar.position.x, -WORLD_HALF_SIZE+2, WORLD_HALF_SIZE-2);
    avatar.position.z = THREE.MathUtils.clamp(avatar.position.z, -WORLD_HALF_SIZE+2, WORLD_HALF_SIZE-2);
    avatar.rotation.y = Math.atan2(heading.x, heading.z);
  }
  if(multiplayer.connected){
    const rawForward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
    const rawRight=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    const vec=rawRight.multiplyScalar(x).addScaledVector(rawForward,-z);
    const magnitude=Math.hypot(vec.x,vec.z);
    multiplayer.sendMovement({dx:magnitude>.05?vec.x/Math.max(1,magnitude):0,dz:magnitude>.05?vec.z/Math.max(1,magnitude):0},now);
  }
  multiplayer.update(dt,groundHeightAt);
  adventurer.update(elapsed,length>0.05 && playerHealth>0,now/1000<attackingUntil);
  const playerState: AnimationState = now/1000<attackingUntil ? "attack" :
    now/1000<dodgeUntil ? "dodge" : length>0.05 && playerHealth>0 ? "walk" : "idle";
  playerAsset?.setState(playerState);
  playerAsset?.update(dt);
  const wolfDistance = Math.hypot(avatar.position.x-wolf.position.x,avatar.position.z-wolf.position.z);
  const wolfState: AnimationState = wolfHealth<=0 ? "death" :
    now/1000<wolfAttackAnimationUntil ? "attack" :
    wolfStrikeAt>0 ? "idle" : wolfDistance<7 && wolfDistance>2.2 ? "walk" : "idle";
  wolfAsset?.setState(wolfState);
  wolfAsset?.update(dt);
  if(wolfHealth>0){
    const dx=avatar.position.x-wolf.position.x, dz=avatar.position.z-wolf.position.z;
    const range=Math.hypot(dx,dz);
    wolf.lookAt(avatar.position.x,0,avatar.position.z);
    if(range<7 && range>2.2 && wolfStrikeAt===0 && playerHealth>0){
      const speed=Math.min(dt*0.85,range-2.2);
      wolf.position.x+=dx/range*speed;
      wolf.position.z+=dz/range*speed;
    }
    if(range<2.7 && wolfStrikeAt===0 && now/1000>=nextWolfAttackAt && playerHealth>0){
      wolfWarningAt=now/1000;
      wolfStrikeAt=wolfWarningAt+0.85;
      battleInfo.textContent="⚠ Wolf preparing to strike!";
    }
    warningRing.visible=wolfStrikeAt>0;
    warningRing.position.set(wolf.position.x,0.05,wolf.position.z);
    if(wolfStrikeAt>0 && now/1000>=wolfStrikeAt){
      const strikeRange=Math.hypot(avatar.position.x-wolf.position.x,avatar.position.z-wolf.position.z);
      if(strikeRange<3.0 && now/1000>dodgeUntil && playerHealth>0){
        playerHealth=Math.max(0,playerHealth-12);
        hpDisplay.value=playerHealth;
        battleInfo.textContent="Wolf bite · 12 damage";
      } else battleInfo.textContent="Wolf attack missed!";
      wolfAttackAnimationUntil=now/1000+0.6;
      wolfStrikeAt=0;
      nextWolfAttackAt=now/1000+1.5;
      if(playerHealth===0) battleInfo.textContent="Defeated · restart to retry";
    }
  }
  avatar.position.y=groundHeightAt(avatar.position.x,avatar.position.z);
  atlas.update(avatar.position.x,avatar.position.z,now);
  world.update(avatar.position.x,avatar.position.z);
  const label=biomeAt(avatar.position.x,avatar.position.z).toUpperCase()+" | CHUNK "+chunkCoordinate(avatar.position.x)+","+chunkCoordinate(avatar.position.z)+" | X "+Math.round(avatar.position.x)+" Z "+Math.round(avatar.position.z)+" | "+world.loadedChunks+" loaded";
  if(coordinates.textContent!==label) coordinates.textContent=label;
  if(now>=nextDiscoveryScan){
    nextDiscoveryScan=now+650;
    const found=discoverableLandmarks(avatar.position.x,avatar.position.z,16);
    const nearbySettlements=settlementsNear(avatar.position.x,avatar.position.z,700);
    let newlyVisitedTown=false;
    for(const town of discoverySettlements(avatar.position.x,avatar.position.z,28)) {
      if(knownSettlements.has(town.id))continue;
      knownSettlements.add(town.id);
      atlas.recordSettlement(town);
      newlyVisitedTown=true;
      status.textContent="Settlement discovered: "+town.name;
    }
    if(newlyVisitedTown)try{localStorage.setItem(settlementDiscoveryKey,JSON.stringify([...knownSettlements]));}catch{/* Session-only */}
    for(const town of nearbySettlements)if(knownSettlements.has(town.id))atlas.recordSettlement(town);
    let newlyDiscovered=false;
    for(const location of found){
      if(discovered.has(location.id))continue;
      discovered.add(location.id);
      atlas.recordDiscovered(location);
      newlyDiscovered=true;
      status.textContent="Discovered: "+location.name;
    }
    if(newlyDiscovered) {
      try {localStorage.setItem(discoveryKey,JSON.stringify([...discovered]));} catch { /* Session-only progress */ }
    }
    const nearby=landmarksNear(avatar.position.x,avatar.position.z,450);
    for(const point of nearby) if(discovered.has(point.id))atlas.recordDiscovered(point);
    nearby.sort((a,b)=>Math.hypot(a.x-avatar.position.x,a.z-avatar.position.z)-Math.hypot(b.x-avatar.position.x,b.z-avatar.position.z));
    const closest=nearby[0];
    const distance=closest?Math.round(Math.hypot(closest.x-avatar.position.x,closest.z-avatar.position.z)):0;
    exploration.textContent=closest?("Discoveries "+discovered.size+" | "+closest.name+" "+distance+"m"):("Discoveries "+discovered.size+" | Explore outward");
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
