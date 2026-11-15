/** Server-owned class kits. The client may display these labels, never the numbers. */
import type {ClassId} from "./characterCatalog";

export const CLASS_ABILITY_IDS={
  vanguard:["bulwark"],
  spellweaver:["arc-bolt","starfall","mend","aether-ward"],
  shadeblade:["quickstrike","shadowstep","veil","keen-senses"]
} as const;
export type ClassAbility=(typeof CLASS_ABILITY_IDS)[ClassId][number];
export type AbilityKind="barrier"|"bolt"|"area"|"heal"|"ward"|"strike"|"dash"|"stealth"|"scout";
export interface AbilitySpec{
  id:ClassAbility;
  classId:ClassId;
  kind:AbilityKind;
  name:string;
  label:string;
  glyph:string;
  stamina:number;
  cooldown:number;
  summary:string;
  damage?:number;
  range?:number;
  heal?:number;
  duration?:number;
  stopDistance?:number;
  allyRange?:number;
  biteReduction?:number;
  halvesIncoming?:boolean;
}
export const ABILITY_SPECS:Record<ClassAbility,AbilitySpec>={
  bulwark:{
    id:"bulwark",classId:"vanguard",kind:"barrier",name:"Bulwark",label:"BULWARK",glyph:"❖",
    stamina:22,cooldown:14,duration:4,halvesIncoming:true,
    summary:"Halve incoming wolf bites for 4 seconds."
  },
  "arc-bolt":{
    id:"arc-bolt",classId:"spellweaver",kind:"bolt",name:"Arc Bolt",label:"BOLT",glyph:"✶",
    stamina:30,cooldown:9,damage:28,range:9,
    summary:"Deal 28 arcane damage to the wolf within 9 meters."
  },
  starfall:{
    id:"starfall",classId:"spellweaver",kind:"area",name:"Starfall",label:"FALL",glyph:"✺",
    stamina:34,cooldown:12,damage:18,range:6.5,
    summary:"Deal 18 arcane damage to the wolf within 6.5 meters of you."
  },
  mend:{
    id:"mend",classId:"spellweaver",kind:"heal",name:"Mend",label:"MEND",glyph:"✚",
    stamina:26,cooldown:11,heal:22,range:10,
    summary:"Restore 22 health to the most injured ally within 10 meters, or to yourself."
  },
  "aether-ward":{
    id:"aether-ward",classId:"spellweaver",kind:"ward",name:"Aether Ward",label:"WARD",glyph:"◇",
    stamina:20,cooldown:13,duration:3,range:10,biteReduction:4,
    summary:"Reduce wolf bites by 4 for 3 seconds. Prefers an injured ally within 10 meters."
  },
  quickstrike:{
    id:"quickstrike",classId:"shadeblade",kind:"strike",name:"Quickstrike",label:"STRIKE",glyph:"✦",
    stamina:25,cooldown:7,damage:34,range:3.25,
    summary:"Deal 34 melee damage within 3.25 meters."
  },
  shadowstep:{
    id:"shadowstep",classId:"shadeblade",kind:"dash",name:"Shadowstep",label:"STEP",glyph:"↝",
    stamina:28,cooldown:10,damage:18,range:8,stopDistance:2.2,
    summary:"Close to 2.2 meters from a wolf within 8 meters, then strike for 18."
  },
  veil:{
    id:"veil",classId:"shadeblade",kind:"stealth",name:"Veil",label:"VEIL",glyph:"◌",
    stamina:18,cooldown:16,duration:4,
    summary:"Drop the wolf's attention for 4 seconds. Attacking ends the veil."
  },
  "keen-senses":{
    id:"keen-senses",classId:"shadeblade",kind:"scout",name:"Keen Senses",label:"SENSE",glyph:"◉",
    stamina:14,cooldown:8,range:28,allyRange:24,
    summary:"Sense the wolf within 28 meters and count living allies within 24 meters."
  }
};
const ABILITY_ID_LIST=Object.keys(ABILITY_SPECS);
export function isClassAbility(value:unknown):value is ClassAbility{
  return typeof value==="string"&&ABILITY_ID_LIST.includes(value);
}
export function classOwnsAbility(classId:ClassId,ability:ClassAbility):boolean{
  return (CLASS_ABILITY_IDS[classId] as readonly ClassAbility[]).includes(ability);
}
export function abilitiesForClass(classId:ClassId):readonly AbilitySpec[]{
  return CLASS_ABILITY_IDS[classId].map(id=>ABILITY_SPECS[id]);
}
