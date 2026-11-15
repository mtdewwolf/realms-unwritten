import {ABILITY_SPECS,abilitiesForClass,type ClassAbility} from "../../../shared/src/classAbilities";
import type {ClassId} from "../../../shared/src/characterCatalog";

export function cooldownCaption(label:string,readyAtMs:number,nowMs:number):{text:string;cooling:boolean}{
  const remaining=Math.ceil((readyAtMs-nowMs)/1000);
  if(remaining>0)return {text:label+" "+remaining+"s",cooling:true};
  return {text:label,cooling:false};
}
/** Touch ability bar. Cooldown text follows server results; it does not grant the cast. */
export class AbilityBar{
  readonly root:HTMLElement;
  private readonly buttons=new Map<ClassAbility,HTMLButtonElement>();
  private readonly readyAt=new Map<ClassAbility,number>();
  private readonly onKey=(event:KeyboardEvent):void=>{
    if(event.repeat||event.metaKey||event.ctrlKey||event.altKey||this.typing(event.target))return;
    const index=["1","2","3","4"].indexOf(event.key);
    if(index<0)return;
    const button=[...this.buttons.values()][index];
    if(!button||button.disabled)return;
    event.preventDefault();
    button.click();
  };
  private typing(target:EventTarget|null):boolean{
    if(!target||typeof target!=="object")return false;
    if("isContentEditable" in target&&(target as HTMLElement).isContentEditable)return true;
    const tag="tagName" in target?String((target as {tagName?:string}).tagName).toLowerCase():"";
    return tag==="input"||tag==="textarea";
  }
  constructor(parent:HTMLElement,private readonly onUse:(ability:ClassAbility)=>void,private readonly dom:Document=document,private readonly hostWindow:Window=window){
    const root=this.dom.createElement("div");
    root.id="ability-bar";
    root.setAttribute("role","group");
    root.setAttribute("aria-label","Class abilities");
    parent.append(root);
    this.root=root;
    this.setClass("vanguard");
    this.hostWindow.addEventListener("keydown",this.onKey);
  }
  setClass(classId:ClassId):void{
    this.root.dataset.class=classId;
    this.root.replaceChildren();
    this.buttons.clear();
    this.readyAt.clear();
    for(const spec of abilitiesForClass(classId)){
      const button=this.dom.createElement("button");
      button.type="button";
      button.dataset.ability=spec.id;
      button.setAttribute("aria-label",spec.name);
      const glyph=this.dom.createElement("b");
      glyph.textContent=spec.glyph;
      const caption=this.dom.createElement("span");
      caption.textContent=spec.label;
      button.append(glyph,caption);
      button.addEventListener("click",()=>{
        if(button.disabled)return;
        this.onUse(spec.id);
      });
      this.root.append(button);
      this.buttons.set(spec.id,button);
    }
  }
  note(ability:ClassAbility,cooldownSeconds:number,now=performance.now()):void{
    if(!(cooldownSeconds>0))return;
    this.readyAt.set(ability,now+cooldownSeconds*1000);
    this.update(now);
  }
  reset():void{
    this.readyAt.clear();
    this.update(performance.now());
  }
  update(now:number):void{
    for(const [id,button] of this.buttons){
      const caption=cooldownCaption(ABILITY_SPECS[id].label,this.readyAt.get(id)??0,now);
      const span=button.querySelector("span");
      if(span)span.textContent=caption.text;
      button.disabled=caption.cooling;
      button.classList.toggle("ability-cooling",caption.cooling);
    }
  }
}
