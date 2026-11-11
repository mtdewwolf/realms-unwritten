/**
 * Pure deterministic terrain sampling. Identical coordinates always produce
 * identical heights, including at boundaries between independently built chunks.
 */
export const TERRAIN_VERSION = 1;
export const TERRAIN_GRID_STEP = 4; // 64m chunk / 16 subdivisions
export type Biome = "meadow" | "woodland" | "highlands";

function smooth(t: number): number { return t*t*(3-2*t); }
function mix(a: number,b: number,t: number): number { return a+(b-a)*t; }
function hash(ix: number, iz: number, salt: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ salt;
  h = Math.imul(h ^ h>>>13,1274126177);
  return ((h ^ h>>>16)>>>0)/4294967295;
}
function noise(x: number,z: number,scale: number,salt: number): number {
  const px=x/scale,pz=z/scale,ix=Math.floor(px),iz=Math.floor(pz);
  const fx=smooth(px-ix),fz=smooth(pz-iz);
  return mix(
    mix(hash(ix,iz,salt),hash(ix+1,iz,salt),fx),
    mix(hash(ix,iz+1,salt),hash(ix+1,iz+1,salt),fx),
    fz
  );
}
export function biomeAt(x:number,z:number):Biome {
  const moisture=noise(x,z,680,0x3f13ac);
  const altitude=noise(x,z,980,0x6bd921);
  if(altitude>0.63)return "highlands";
  if(moisture>0.49)return "woodland";
  return "meadow";
}
export function terrainHeightAt(x:number,z:number):number {
  // Low amplitude heightfield keeps early walking combat practical.
  const broad=(noise(x,z,340,0x593dc4)-0.5)*22;
  const detail=(noise(x,z,90,0x3259de)-0.5)*5;
  const ridges=Math.max(0,noise(x,z,730,0x5187dd)-0.6)*32;
  const raw=broad+detail+ridges;
  // Keep village's authored buildings at y=0 without abrupt borders.
  const distance=Math.hypot(x,z);
  const blend=smooth(Math.max(0,Math.min(1,(distance-24)/58)));
  return raw*blend;
}
export function terrainColorAt(x:number,z:number):[number,number,number] {
  const biome=biomeAt(x,z);
  const height=terrainHeightAt(x,z);
  const palette:Record<Biome,[number,number,number]>={
    meadow:[0.33,0.48,0.27],
    woodland:[0.22,0.38,0.27],
    highlands:[0.44,0.46,0.36],
  };
  const c=palette[biome];
  const shade=0.90+(noise(x,z,34,0x51adeb)-0.5)*0.18 + Math.min(0.15,Math.max(-0.12,height/85));
  return [c[0]*shade,c[1]*shade,c[2]*shade];
}
