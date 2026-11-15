import * as THREE from "three";
import "./style.css";
import { populateFrontierProps } from "./world/frontierProps";
import {createFantasyCottage,decorateVillage} from "./world/fantasyArchitecture";
import {decorateFactionOutposts} from "./world/factionOutposts";
import {WorldAtmosphere} from "./world/worldAtmosphere";
import {CombatVisuals} from "./world/combatVisuals";
import { ChunkedWorld, WORLD_HALF_SIZE, chunkCoordinate, groundHeightAt } from "./world/chunkedWorld";
import { biomeAt } from "./world/terrain";
import { landmarksNear, discoverableLandmarks } from "./world/landmarks";
import { WorldMap } from "./ui/worldMap";
import { MultiplayerClient, type ServerWolf, type ServerVitals, type CombatActionResult } from "./multiplayer/client";
import { InventoryPanel } from "./ui/inventory";
import { QuestPanel } from "./ui/quests";
import { CharacterPanel } from "./ui/character";
import { ResourceGuide } from "./ui/resourceGuide";
import { GameMenu } from "./ui/gameMenu";
import { CharacterCreator } from "./ui/characterCreator";
import {TitleScreen} from "./ui/titleScreen";
import {createRaceCharacter} from "./characters/raceModel";
import {createAnimatedRace,type AnimatedRace} from "./characters/raceAsset";
import {DEFAULT_APPEARANCE} from "../../shared/src/characterCatalog";
import {AbilityBar} from "./ui/abilityBar";
import {describeAbilityResult} from "./ui/abilityFeedback";
import { moveWithCollision } from "./world/collision";
import { settlementsNear, discoverySettlements } from "./world/settlements";
import { createWolf } from "./characters/rig";
import { mountAnimatedAsset, type AnimatedAsset, type AnimationState } from "./characters/animatedAsset";
import { pointerSpacing, zoomFromPinch } from "./input/touchCamera";
import { movementWire } from "./multiplayer/prediction";
import { gatherRequest } from "./ui/resourceGuidance";
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
  <div id="actions"><button id="gather" type="button">⛏<span>GATHER</span></button><button id="attack" type="button">⚔<span>ATTACK</span></button></div>
  <div id="hint">Left thumb to move · Drag open terrain to rotate · Pinch to zoom</div>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.4));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0xa4c6be);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa4c6be);
scene.fog = new THREE.FogExp2(0xa4c6be,0.009);
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 150);
scene.add(new THREE.HemisphereLight(0xe6ddbd, 0x4c6550, 2.1));
const sunlight = new THREE.DirectionalLight(0xffd69a, 2.1);
sunlight.position.set(-8, 16, 11);
scene.add(sunlight);
const atmosphere=new WorldAtmosphere(scene,sunlight);
const combatVisuals=new CombatVisuals(scene);

const world = new ChunkedWorld(scene);
world.update(0,0);

for(const [x,z,style] of [[-6,-5,0],[7,-9,1],[-7,7,2]] as const)
  scene.add(createFantasyCottage(x,z,style));
decorateVillage(scene);
decorateFactionOutposts(scene);
populateFrontierProps(scene);

let adventurer = createRaceCharacter({race:"sunborne",characterClass:"vanguard",appearance:DEFAULT_APPEARANCE});
const avatar = new THREE.Group();
avatar.add(adventurer.root);
scene.add(avatar);
const wolf = new THREE.Group();
const fallbackWolf = createWolf();
wolf.add(fallbackWolf);
wolf.position.set(5, 0, 5);
scene.add(wolf);
let riggedPlayer:AnimatedRace|null=null;
let rigGeneration=0;
let wolfAsset: AnimatedAsset | null = null;
// Procedural race avatars remain visible; the generic GLB would hide the selected race.
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
const resourceGuide=new ResourceGuide(app,scene,(x,z)=>atlas.setWaypoint({x,z}));
let lastResourceUpdate=0;
const inventoryPanel=new InventoryPanel(app,item=>multiplayer.sendEquip(item),recipe=>multiplayer.sendCraft(recipe),()=>multiplayer.useTonic());
const questPanel=new QuestPanel(app,scene,action=>multiplayer.sendQuest(action));
const characterPanel=new CharacterPanel(app,()=>multiplayer.requestProgression());
const creator=new CharacterCreator(app,choice=>multiplayer.createCharacter(choice));
let title:TitleScreen;
inventoryPanel.button.addEventListener("click",()=>multiplayer.requestInventory());
let onlineWolf:ServerWolf|null=null;
let lastServerStrikePhase="";
let abilityBar:AbilityBar|null=null;
let castingUntil=0;
const multiplayer = new MultiplayerClient(scene, avatar,
  text=>{status.textContent=text;if(title?.visible)title.message(text);},
  (vitals:ServerVitals,wolfState:ServerWolf|null)=>{
    playerHealth=vitals.health;playerStamina=vitals.stamina;
    hpDisplay.value=playerHealth;staminaDisplay.value=playerStamina;
    onlineWolf=wolfState;
    if(wolfState){
      wolf.position.x=wolfState.x;wolf.position.z=wolfState.z;
      wolfHealth=wolfState.health;wolfDisplay.value=wolfHealth;
      wolf.visible=true;
      warningRing.visible=wolfState.phase==="windup";
      warningRing.position.set(wolfState.x,groundHeightAt(wolfState.x,wolfState.z)+.06,wolfState.z);
      if(lastServerStrikePhase!==wolfState.phase&&wolfState.phase==="strike")wolfAttackAnimationUntil=performance.now()/1000+.55;
      lastServerStrikePhase=wolfState.phase;
    }else{wolf.visible=false;warningRing.visible=false;}
  },
  (result:CombatActionResult)=>{
    if(!result.ok)battleInfo.textContent=result.reason||"Action rejected by server";
    else if(result.action==="attack")battleInfo.textContent="Wolf hit · shared HP "+result.wolfHealth;
    else battleInfo.textContent="Dodge active";
    if(result.ok&&result.action==="attack"){
      attackingUntil=performance.now()/1000+.27;
      combatVisuals.emit("slash",avatar.position,wolf.position);
    }
    if(result.ok&&result.action==="dodge"){
      dodgeUntil=performance.now()/1000+.6;
      combatVisuals.emit("dodge",avatar.position);
    }
  },
  ()=>{
    onlineWolf=null;lastServerStrikePhase="";
    wolf.position.set(5,0,5);
    wolf.visible=wolfHealth>0;
    warningRing.visible=false;
    inventoryPanel.offline();
    questPanel.offline();
    characterPanel.offline();
    abilityBar?.reset();
    app.classList.remove("game-entered");
    if(title)title.show();
  },
  state=>inventoryPanel.update(state),
  reward=>{battleInfo.textContent="Loot earned: "+reward.items.map(item=>item.name).join(", ")+" +"+reward.coins+" coins";},
  quest=>questPanel.update(quest),
  result=>{questPanel.result(result);if(result.ok&&result.action==="turnin")status.textContent="Wolf Hunt complete · +25 coins";},
  state=>{const newLevel=characterPanel.update(state);if(newLevel!==null)status.textContent="Level up! You reached level "+newLevel;},
  result=>{if(result.action==="gather"&&result.nodeId&&result.retryAfterMs)resourceGuide.markCooldown(result.nodeId,result.retryAfterMs);},
  ()=>{title.hide();creator.show();},
  identity=>{
    creator.hide();title.hide();app.classList.add("game-entered");characterPanel.setIdentity(identity);
    avatar.remove(adventurer.root);adventurer.dispose();
    adventurer=createRaceCharacter(identity);avatar.add(adventurer.root);
    const generation=++rigGeneration;
    if(riggedPlayer){avatar.remove(riggedPlayer.root);riggedPlayer.dispose();riggedPlayer=null;}
    void createAnimatedRace(identity).then(rig=>{
      if(generation!==rigGeneration){rig.dispose();return;}
      riggedPlayer=rig;avatar.add(rig.root);adventurer.root.visible=false;
    }).catch(error=>console.warn("Using procedural race fallback",error));
    abilityBar?.setClass(identity.characterClass);
  },
  result=>{
    if(result.cooldownSeconds>0)abilityBar?.note(result.ability,result.cooldownSeconds);
    if(!result.ok){battleInfo.textContent=result.reason??"Class ability rejected";return;}
    const feedback=describeAbilityResult(result);
    const seconds=performance.now()/1000;
    const scout=result.scout?.wolf;
    const from=feedback.anchor==="scout"&&scout?new THREE.Vector3(scout.x,avatar.position.y,scout.z):avatar.position;
    const to=feedback.anchor==="wolf"?wolf.position:from;
    combatVisuals.emit(feedback.visual,from,to);
    battleInfo.textContent=feedback.text;
    if(feedback.gesture==="strike")attackingUntil=seconds+.35;
    if(feedback.gesture==="cast")castingUntil=seconds+.45;
    if(result.position)multiplayer.adoptServerPosition(result.position.x,result.position.z);
  },
  ()=>title.authRequired(),
  hasCharacter=>{title.authenticated();title.message(hasCharacter?"Account loaded · entering world":"Account ready · create your character");},
  error=>{title.message(error);title.show();}
);
title=new TitleScreen(app,(url,mode,freshAuth)=>multiplayer.connect(url,mode,freshAuth),req=>multiplayer.authenticate(req.mode,req.username,req.password),()=>{
  multiplayer.disconnect();app.classList.add("game-entered");status.textContent="Offline demo · no account or progression saved";
});
const multiplayerPanel=document.createElement("div");
multiplayerPanel.id="multiplayer-panel";
multiplayerPanel.innerHTML='<input id="server-url" aria-label="Multiplayer server URL" placeholder="ws://192.168.1.50:3001/ws" autocomplete="off"/><button id="server-connect" type="button">CONNECT</button><button id="server-disconnect" type="button">OFFLINE</button>';
app.appendChild(multiplayerPanel);
const serverUrlInput=multiplayerPanel.querySelector<HTMLInputElement>("#server-url")!;
multiplayerPanel.querySelector("#server-connect")!.addEventListener("click",()=>{app.classList.remove("game-entered");title.show();title.url.value=serverUrlInput.value.trim();});
multiplayerPanel.querySelector("#server-disconnect")!.addEventListener("click",()=>{multiplayer.signOut();title.show();status.textContent="Signed out";});
const gameMenu=new GameMenu(app);
const controlledPanels=[
  {tab:"map" as const,open:()=>atlas.open(),close:()=>atlas.close()},
  {tab:"bag" as const,open:()=>{inventoryPanel.element.hidden=false;multiplayer.requestInventory();},close:()=>{inventoryPanel.element.hidden=true;}},
  {tab:"quest" as const,open:()=>{questPanel.element.hidden=false;multiplayer.sendQuest("status");},close:()=>{questPanel.element.hidden=true;}},
  {tab:"hero" as const,open:()=>{characterPanel.panel.hidden=false;multiplayer.requestProgression();},close:()=>{characterPanel.panel.hidden=true;}},
  {tab:"network" as const,open:()=>{multiplayerPanel.hidden=false;serverUrlInput.focus();},close:()=>{multiplayerPanel.hidden=true;serverUrlInput.blur();}}
];
for(const panel of controlledPanels)gameMenu.register(panel.tab,panel);
// Close controls inside each legacy panel must also close the centralized backdrop.
for(const selector of ["#map-close","#bag-close","#quest-close","#character-close"]){
  const close=app.querySelector<HTMLButtonElement>(selector);
  close?.addEventListener("click",()=>gameMenu.close());
}
// Keep the desktop M shortcut routed through the same single-panel controller.
window.addEventListener("keydown",event=>{
  if(event.key.toLowerCase()!=="m"||event.repeat||event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
  gameMenu.navigate("map");
  event.preventDefault();
  event.stopImmediatePropagation();
},true);
multiplayerPanel.hidden=true;
app.classList.add("game-menu-enabled");
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
  if(multiplayer.connected){multiplayer.sendAction("attack");return;}
  const now=performance.now()/1000;
  if(now-lastAttackTime < 0.65 || wolfHealth <= 0 || playerHealth <= 0) return;
  const next=useStamina(playerStamina,ATTACK_STAMINA);
  if(next===null){battleInfo.textContent="Not enough stamina";return;}
  playerStamina=next;lastAttackTime=now;
  attackingUntil=now+0.27;
  combatVisuals.emit("slash",avatar.position,wolf.position);
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
  if(multiplayer.connected){multiplayer.sendAction("dodge");return;}
  const now=performance.now()/1000;
  if(now<dodgeUntil || playerHealth<=0)return;
  const next=useStamina(playerStamina,DODGE_STAMINA);
  if(next===null) {battleInfo.textContent="Not enough stamina";return;}
  playerStamina=next;
  dodgeUntil=now+0.6;
  combatVisuals.emit("dodge",avatar.position);
  const direction=new THREE.Vector3(Math.sin(avatar.rotation.y),0,Math.cos(avatar.rotation.y));
  const landing=moveWithCollision(avatar.position.x,avatar.position.z,direction.x*2.25,direction.z*2.25);
  avatar.position.x=landing.x;avatar.position.z=landing.z;
  battleInfo.textContent="Dodged!";
}
document.querySelector("#attack")!.addEventListener("click", attack);
document.querySelector("#gather")!.addEventListener("click", () => {
  const sample=multiplayer.connected?multiplayer.authoritativePosition(performance.now()):{x:avatar.position.x,z:avatar.position.z};
  const decision=gatherRequest(sample,multiplayer.connected);
  if(!decision.send){status.textContent=decision.message??"Move closer to ore or Moonleaf.";return;}
  if(!multiplayer.sendGather())status.textContent="Connect to the Bun server to mine Ironstone Outcrops.";
});
const dodgeButton = document.createElement("button");
dodgeButton.id="dodge";
dodgeButton.innerHTML='↝<span>DODGE</span>';
document.querySelector("#actions")!.prepend(dodgeButton);
dodgeButton.addEventListener("click",dodge);
abilityBar=new AbilityBar(app,ability=>{
  if(!multiplayer.connected){battleInfo.textContent="Class abilities require the Bun server";return;}
  multiplayer.sendClassAbility(ability);
});
let previous = performance.now();
let elapsed = 0;
const moveForward=new THREE.Vector3();
const moveRight=new THREE.Vector3();
const cameraOffset=new THREE.Vector3();
function frame(now: number) {
  if(!app!.classList.contains("game-entered")){
    previous=now;
    renderer.render(scene,camera);
    requestAnimationFrame(frame);
    return;
  }
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  elapsed += dt;
  if(!multiplayer.connected)playerStamina = regenerateStamina(playerStamina,dt);
  staminaDisplay.value=playerStamina;
  abilityBar?.update(now);
  const x = axisX + Number(keys.has("d")) - Number(keys.has("a"));
  const z = axisZ + Number(keys.has("s")) - Number(keys.has("w"));
  const length = Math.hypot(x, z);
  const aliveForInput=playerHealth>0;
  moveForward.set(-Math.sin(yaw),0,-Math.cos(yaw));
  moveRight.set(Math.cos(yaw),0,-Math.sin(yaw));
  const vx=moveRight.x*x+moveForward.x*(-z);
  const vz=moveRight.z*x+moveForward.z*(-z);
  if (length > 0.05 && aliveForInput && !multiplayer.connected) {
    const headingLen=Math.hypot(vx,vz)||1;
    const next=moveWithCollision(avatar.position.x,avatar.position.z,vx/headingLen*dt*5.5,vz/headingLen*dt*5.5);
    avatar.position.x=next.x;avatar.position.z=next.z;
    avatar.position.x = THREE.MathUtils.clamp(avatar.position.x, -WORLD_HALF_SIZE+2, WORLD_HALF_SIZE-2);
    avatar.position.z = THREE.MathUtils.clamp(avatar.position.z, -WORLD_HALF_SIZE+2, WORLD_HALF_SIZE-2);
  }
  if(length>0.05 && aliveForInput) avatar.rotation.y=Math.atan2(vx,vz);
  if(multiplayer.connected){
    const command=movementWire(vx,vz,aliveForInput);
    multiplayer.predictLocal(command.dx,command.dz,dt,now);
    multiplayer.sendMovement(command,now);
  }
  multiplayer.update(dt,groundHeightAt);
  adventurer.update(elapsed,length>0.05 && playerHealth>0,now/1000<attackingUntil||now/1000<castingUntil);
  const playerState = now/1000<attackingUntil ? "attack" as const :
    now/1000<castingUntil ? "cast" as const :
    now/1000<dodgeUntil ? "dodge" as const : length>0.05 && playerHealth>0 ? "walk" as const : "idle" as const;
  riggedPlayer?.setState(playerState);
  riggedPlayer?.update(dt);
  const wolfDistance = Math.hypot(avatar.position.x-wolf.position.x,avatar.position.z-wolf.position.z);
  const wolfState: AnimationState = wolfHealth<=0 ? "death" :
    now/1000<wolfAttackAnimationUntil ? "attack" :
    (multiplayer.connected? onlineWolf?.phase==="windup" : wolfStrikeAt>0) ? "idle" :
    (multiplayer.connected ? onlineWolf?.phase==="chase" : wolfDistance<7 && wolfDistance>2.2) ? "walk" : "idle";
  if(multiplayer.connected&&onlineWolf){
    wolf.position.y=groundHeightAt(wolf.position.x,wolf.position.z);
    wolf.rotation.y=onlineWolf.heading;
  }
  wolfAsset?.setState(wolfState);
  wolfAsset?.update(dt);
  if(!multiplayer.connected && wolfHealth>0){
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
  if(now-lastResourceUpdate>=100){
    const sample=multiplayer.connected?multiplayer.authoritativePosition(now):{x:avatar.position.x,z:avatar.position.z};
    resourceGuide.update(sample.x,sample.z,multiplayer.connected,now);
    const decision=gatherRequest(sample,multiplayer.connected);
    const nearResource=decision.send&&decision.target?.inRange===true;
    const kind=decision.target?.kind;
    const gatherButton=document.querySelector<HTMLButtonElement>("#gather")!;
    gatherButton.querySelector("span")!.textContent=nearResource?(kind==="moonleaf"?"PICK":"MINE"):"GATHER";
    gatherButton.classList.toggle("action-context-ready",nearResource&&multiplayer.connected);
    lastResourceUpdate=now;
  }
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
  const offset = cameraOffset.set(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch)
  ).multiplyScalar(distance);
  camera.position.copy(avatar.position).add(offset);
  camera.lookAt(avatar.position.x, 1, avatar.position.z);
  atmosphere.update(camera,avatar.position,elapsed);
  combatVisuals.update(dt);
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
