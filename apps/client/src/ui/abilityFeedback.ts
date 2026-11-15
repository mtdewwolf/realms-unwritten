import type {ClassAbilityResult} from "../../../server/src/protocol";
import type {CombatVisualKind} from "../world/combatVisuals";

export interface AbilityFeedback{
  visual:CombatVisualKind;
  text:string;
  gesture:"strike"|"cast"|"none";
  anchor:"self"|"wolf"|"scout";
}
/** Presentation only. Damage and ranges stay on the server result. */
export function describeAbilityResult(result:ClassAbilityResult):AbilityFeedback{
  const wolf="wolf HP "+result.wolfHealth;
  const you=result.subjectSelf===true;
  switch(result.ability){
    case "bulwark":return {visual:"bulwark",text:"Bulwark active · reduced incoming damage",gesture:"none",anchor:"self"};
    case "arc-bolt":return {visual:"arc-bolt",text:"Arc Bolt hit · "+wolf,gesture:"cast",anchor:"wolf"};
    case "starfall":return {visual:"starfall",text:"Starfall hit · "+wolf,gesture:"cast",anchor:"self"};
    case "mend":return {visual:"mend",text:"Mend restored "+(you?"you":"an ally")+" to "+result.healedHealth,gesture:"cast",anchor:"self"};
    case "aether-ward":return {visual:"aether-ward",text:"Aether Ward on "+(you?"you":"an ally"),gesture:"cast",anchor:"self"};
    case "quickstrike":return {visual:"quickstrike",text:"Quickstrike hit · "+wolf,gesture:"strike",anchor:"wolf"};
    case "shadowstep":return {visual:"shadowstep",text:"Shadowstep hit · "+wolf,gesture:"strike",anchor:"wolf"};
    case "veil":return {visual:"veil",text:"Veil active · the wolf loses you",gesture:"cast",anchor:"self"};
    case "keen-senses":{
      const allies="allies "+(result.scout?.allies??0);
      const sensed=result.scout?.wolf?"Wolf sensed "+result.scout.wolf.distance+"m · "+allies:"No wolf in sense range · "+allies;
      return {visual:"keen-senses",text:sensed,gesture:"cast",anchor:result.scout?.wolf?"scout":"self"};
    }
    default:{
      const unexpected:never=result.ability;
      throw new Error("Unhandled ability "+unexpected);
    }
  }
}
