import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {clone as cloneSkinned} from "three/addons/utils/SkeletonUtils.js";
import {DEFAULT_APPEARANCE,type CharacterAppearance,type CharacterIdentity,type RaceId,type ClassId} from "../../../shared/src/characterCatalog";
import type {AnimationState} from "./animatedAsset";

const RACE_SKINS:Record<RaceId,readonly number[]>={
 sunborne:[0xe5b68b,0xc99169,0xa97350,0x815038],
 thornkin:[0xa9c28c,0x8fa776,0x6e8f70,0x4b7157],
 stonehearth:[0xdcb08a,0xb58b69,0x997054,0x75513c],
 aetheri:[0xd9c9dd,0xb4a9d3,0x938ec1,0x706f9b],
 ashforged:[0x7da067,0x628450,0x496c40,0x35543b],
 hornwarden:[0xbc997d,0xa38369,0x846a58,0x6d5649],
 hollowborn:[0xb3b7a9,0x8f988e,0x757e78,0x5f6b64],
 veilkin:[0xb4a6ca,0x958cb9,0x77709f,0x58517a]
};
const HAIR_PALETTE=[0x30252c,0xbe925b,0xdacaaa,0x7f4a45,0x8a72b6];
const actions=["idle","walk","attack","dodge","cast","death"] as const;
type AnimationClipName=typeof actions[number];
interface RaceTemplate {scene:THREE.Group;animations:THREE.AnimationClip[]}
const loader=new GLTFLoader();
const templates=new Map<string,Promise<RaceTemplate>>();
const assetUrl=(race:RaceId,characterClass:ClassId)=>"/assets/hero-"+race+"-"+characterClass+".glb";
export function raceAssetUrl(race:RaceId,characterClass:ClassId):string{return assetUrl(race,characterClass);}
function loadTemplate(race:RaceId,characterClass:ClassId):Promise<RaceTemplate>{
 const url=assetUrl(race,characterClass);
 let stored=templates.get(url);
 if(!stored){
  stored=loader.loadAsync(url).then(result=>{
   const present=new Set(result.animations.map(clip=>clip.name));
   for(const name of actions)if(!present.has(name))throw Error("Missing animation "+name+" in "+url);
   return {scene:result.scene,animations:result.animations};
  }).catch(error=>{templates.delete(url);throw error;});
  templates.set(url,stored);
 }
 return stored;
}
export interface AnimatedRace{
 root:THREE.Group;
 setState:(state:AnimationState|"cast")=>void;
 update:(dt:number)=>void;
 dispose:()=>void;
}
function shadeMaterial(material:THREE.Material,appearance:CharacterAppearance,race:RaceId):THREE.Material{
 const clone=material.clone();
 if(!(clone instanceof THREE.MeshStandardMaterial))return clone;
 if(material.name.includes("RU_SKIN"))clone.color.setHex(RACE_SKINS[race][appearance.skinTone]);
 if(material.name.includes("RU_HAIR"))clone.color.setHex(HAIR_PALETTE[appearance.hairColor]);
 if(material.name.includes("RU_ARMOR")&&appearance.frame==="sturdy")clone.color.multiplyScalar(.91);
 if(material.name.includes("RU_GLOW")&&appearance.marking===2)clone.color.setHex(0x933e5a);
 return clone;
}
/** Skeleton-safe clone of the original rig; never shares animation state between players. */
export async function createAnimatedRace(identity:Pick<CharacterIdentity,"race"|"characterClass"> & {appearance?:CharacterAppearance}):Promise<AnimatedRace>{
 const appearance=identity.appearance??DEFAULT_APPEARANCE;
 const template=await loadTemplate(identity.race,identity.characterClass);
 const root=cloneSkinned(template.scene) as THREE.Group;
 const ownedMaterials=new Set<THREE.Material>();
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  if(object.name.startsWith("RU_HAIR_STYLE_")){
   const value=Number(object.name.match(/RU_HAIR_STYLE_(\d)/)?.[1]??-1);
   object.visible=value===appearance.hairStyle;
  }
  if(object.name.startsWith("RU_MARKING_"))object.visible=appearance.marking!==0;
  const materials=Array.isArray(object.material)?object.material:[object.material];
  const replacements=materials.map(m=>{
   const replacement=shadeMaterial(m,appearance,identity.race);
   ownedMaterials.add(replacement);return replacement;
  });
  object.material=Array.isArray(object.material)?replacements:replacements[0];
 });
 if(appearance.frame==="sturdy")root.scale.set(1.11,1.025,1.06);
 if(appearance.frame==="lean")root.scale.set(.96,1,.96);
 const mixer=new THREE.AnimationMixer(root);
 const clips=new Map<AnimationClipName,THREE.AnimationAction>();
 for(const clip of template.animations){
  if(!(actions as readonly string[]).includes(clip.name))continue;
  const action=mixer.clipAction(clip);
  if(["attack","dodge","cast","death"].includes(clip.name)){
   action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;
  }
  clips.set(clip.name as AnimationClipName,action);
 }
 let current:AnimationClipName|null=null;
 const setState=(value:AnimationState|"cast")=>{
  if(value===current)return;
  const next=clips.get(value);if(!next)return;
  const prev=current?clips.get(current):null;
  next.enabled=true;next.reset();next.setEffectiveWeight(1);next.play();
  if(prev&&prev!==next)next.crossFadeFrom(prev,.16,false);
  current=value;
 };
 setState("idle");
 return {
  root,setState,
  update(dt){mixer.update(Math.max(0,Math.min(.05,dt)));},
  dispose(){mixer.stopAllAction();mixer.uncacheRoot(root);for(const material of ownedMaterials)material.dispose();}
 };
}
