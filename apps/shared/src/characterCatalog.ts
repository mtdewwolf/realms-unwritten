/** Original Realms Unwritten playable heritage and faction catalog. Pure and shared. */
export const FACTIONS={
  "radiant-accord":{name:"The Radiant Accord",alignment:"good",description:"A federation sworn to protect the living realms.",color:"#d6ad62"},
  "umbral-dominion":{name:"The Umbral Dominion",alignment:"evil",description:"An empire that wields forbidden power to reshape the world.",color:"#a375d6"}
} as const;
export const RACES={
  sunborne:{name:"Sunborne",faction:"radiant-accord",description:"Citadel-born guardians touched by living sunlight.",color:"#e3bc78"},
  thornkin:{name:"Thornkin",faction:"radiant-accord",description:"Forestbound wanderers who defend the ancient groves.",color:"#86bd87"},
  ashforged:{name:"Ashforged",faction:"umbral-dominion",description:"Volcanic smith-clans bound by iron and oath.",color:"#ad665e"},
  veilkin:{name:"Veilkin",faction:"umbral-dominion",description:"Shadow-adapted seekers of hidden truths.",color:"#8f86c7"}
} as const;
export const CLASSES={
  vanguard:{name:"Vanguard",role:"Frontline",description:"Armored melee fighter and protector."},
  spellweaver:{name:"Spellweaver",role:"Magic",description:"Channeler of elemental and arcane power."},
  shadeblade:{name:"Shadeblade",role:"Skirmisher",description:"Quick, precise ambusher and scout."}
} as const;
export type FactionId=keyof typeof FACTIONS;
export type RaceId=keyof typeof RACES;
export type ClassId=keyof typeof CLASSES;
export interface CharacterIdentity {faction:FactionId;race:RaceId;characterClass:ClassId;name:string}
export interface CharacterCreation extends CharacterIdentity{}
const own=(o:object,k:string):boolean=>Object.prototype.hasOwnProperty.call(o,k);
export function parseCharacterCreation(raw:unknown):CharacterCreation|null{
  if(!raw||typeof raw!=="object")return null;
  const r=raw as Record<string,unknown>;
  if(r.type!=="create_character"||typeof r.name!=="string"||typeof r.faction!=="string"||typeof r.race!=="string"||typeof r.characterClass!=="string")return null;
  const name=r.name.trim().replace(/\s+/g," ");
  if(name.length<3||name.length>20||!/^[\p{L}\p{N}][\p{L}\p{N} '-]*$/u.test(name))return null;
  if(!own(FACTIONS,r.faction)||!own(RACES,r.race)||!own(CLASSES,r.characterClass))return null;
  const faction=r.faction as FactionId,race=r.race as RaceId,characterClass=r.characterClass as ClassId;
  if(RACES[race].faction!==faction)return null;
  return {name,faction,race,characterClass};
}
export const LEGACY_IDENTITY:CharacterIdentity={name:"Adventurer",faction:"radiant-accord",race:"sunborne",characterClass:"vanguard"};
