import {FACTIONS,RACES,CLASSES,BODY_TYPES,DEFAULT_APPEARANCE,type CharacterCreation,type FactionId,type RaceId,type ClassId,type CharacterAppearance} from "../../../shared/src/characterCatalog";
import {RacePreview} from "./racePreview";
import {RaceLineup} from "./raceLineup";

export class CharacterCreator{
 readonly element:HTMLElement;
 private faction:FactionId="radiant-accord";
 private race:RaceId="sunborne";
 private characterClass:ClassId="vanguard";
 private appearance:CharacterAppearance={...DEFAULT_APPEARANCE};
 private readonly preview:RacePreview;
 private readonly lineup:RaceLineup;
 private readonly choices:HTMLElement;
 private readonly display:HTMLElement;
 private readonly message:HTMLElement;
 private readonly name:HTMLInputElement;
 constructor(host:HTMLElement,private readonly submit:(choice:CharacterCreation)=>boolean){
  const el=document.createElement("section");
  el.id="character-creator";el.hidden=true;el.setAttribute("aria-label","Create your character");
  el.innerHTML='<div class="creator-header"><strong>REALMS UNWRITTEN</strong><small>FORGE YOUR LEGEND</small></div><h2>Choose your allegiance</h2><p class="creator-intro">The Radiant Accord stands for protection. The Umbral Dominion seeks power through darkness. Your character can challenge the beliefs of their faction.</p><div id="creator-factions"></div><h3>Choose your bloodline</h3><div id="creator-lineup"></div><div class="creator-preview"><div id="creator-portrait" aria-label="Live 3D character preview"></div><div id="creator-display"></div></div><div id="creator-rotate"><button type="button" id="creator-left">↶</button><span>Drag to rotate</span><button type="button" id="creator-right">↷</button></div><h3>Heritage</h3><div id="creator-races"></div><h3>Calling</h3><div id="creator-classes"></div><h3>Appearance</h3><div id="creator-appearance"></div><label for="creator-name">Character name</label><input id="creator-name" maxlength="20" autocomplete="off" placeholder="3–20 characters"/><p class="creator-message" role="status"></p><button type="button" id="creator-submit">ENTER THE REALM</button><p class="creator-footnote">Faction, race and class are permanent on this guest character. Appearance is saved on Bun. Faction homelands and talents are future milestones.</p>';
  host.appendChild(el);this.element=el;
  this.choices=el.querySelector<HTMLElement>("#creator-factions")!;
  this.display=el.querySelector<HTMLElement>("#creator-display")!;
  this.message=el.querySelector<HTMLElement>(".creator-message")!;
  this.name=el.querySelector<HTMLInputElement>("#creator-name")!;
  this.preview=new RacePreview(el.querySelector<HTMLElement>("#creator-portrait")!);
  this.lineup=new RaceLineup(el.querySelector<HTMLElement>("#creator-lineup")!,race=>{this.race=race;this.render();});
  el.querySelector("#creator-left")!.addEventListener("click",()=>this.preview.rotate(-Math.PI/6));
  el.querySelector("#creator-right")!.addEventListener("click",()=>this.preview.rotate(Math.PI/6));
  el.querySelector<HTMLButtonElement>("#creator-submit")!.addEventListener("click",()=>{
    const value=this.name.value.trim();
    if(value.length<3||value.length>20){this.error("Name must be 3–20 characters");return;}
    const ok=this.submit({name:value,faction:this.faction,race:this.race,characterClass:this.characterClass,appearance:{...this.appearance}});
    if(!ok)this.error("Connect to the game server before creating a character");
    else this.error("Creating your character…");
  });
  this.render();
 }
 show():void{this.element.hidden=false;this.error("");}
 hide():void{this.element.hidden=true;}
 error(message:string):void{this.message.textContent=message;}
 private render():void{
   this.choices.replaceChildren();
   for(const faction of Object.keys(FACTIONS) as FactionId[]){
     const definition=FACTIONS[faction];
     const button=document.createElement("button");button.type="button";button.className="creator-choice";
     button.setAttribute("aria-pressed",String(faction===this.faction));
     button.innerHTML="<strong>"+definition.name+"</strong><small>"+definition.alignment.toUpperCase()+" · "+definition.description+"</small>";
     button.addEventListener("click",()=>{
       this.faction=faction;this.race=faction==="radiant-accord"?"sunborne":"ashforged";this.render();
     });
     this.choices.appendChild(button);
   }
   const races=this.element.querySelector<HTMLElement>("#creator-races")!;
   const classes=this.element.querySelector<HTMLElement>("#creator-classes")!;
   races.replaceChildren();classes.replaceChildren();
   for(const key of Object.keys(RACES) as RaceId[]){
     if(RACES[key].faction!==this.faction)continue;
     const button=document.createElement("button");button.type="button";button.className="creator-choice";button.setAttribute("aria-pressed",String(key===this.race));
     const title=document.createElement("strong");title.textContent=RACES[key].name;
     const description=document.createElement("small");description.textContent=RACES[key].description;
     button.append(title,description);button.addEventListener("click",()=>{this.race=key;this.render();});races.appendChild(button);
   }
   for(const key of Object.keys(CLASSES) as ClassId[]){
     const button=document.createElement("button");button.type="button";button.className="creator-choice";
     button.setAttribute("aria-pressed",String(key===this.characterClass));
     const title=document.createElement("strong");title.textContent=CLASSES[key].name+" · "+CLASSES[key].role;
     const description=document.createElement("small");description.textContent=CLASSES[key].description;
     button.append(title,description);button.addEventListener("click",()=>{this.characterClass=key;this.render();});classes.appendChild(button);
   }
   const appearancePanel=this.element.querySelector<HTMLElement>("#creator-appearance")!;
   appearancePanel.replaceChildren();
   const selections=[
     {key:"bodyType" as const,title:"Body type",names:["Male","Female"]},
     {key:"frame" as const,title:"Build",names:["Lean","Sturdy"]},
     {key:"skinTone" as const,title:"Skin tone",names:["I","II","III","IV"]},
     {key:"hairStyle" as const,title:"Hairstyle",names:["Cropped","Long","Spiked","Braided"]},
     {key:"hairColor" as const,title:"Hair color",names:["Midnight","Gold","Ivory","Auburn","Violet"]},
     {key:"marking" as const,title:"Markings",names:["None","Runic","Warpaint"]}
   ];
   for(const setting of selections){
     const label=document.createElement("label");label.textContent=setting.title;
     const select=document.createElement("select");select.setAttribute("aria-label",setting.title);
     setting.names.forEach((value,index)=>{
       const option=document.createElement("option");
       option.value=String(index);option.textContent=value;select.appendChild(option);
     });
     const { key }=setting;
     select.value=String(key==="bodyType"?BODY_TYPES.indexOf(this.appearance.bodyType):
       key==="frame"?Number(this.appearance.frame==="sturdy"):this.appearance[key]);
     select.addEventListener("change",()=>{
       const value=Number(select.value);
       if(key==="bodyType"){
         const bodyType=BODY_TYPES[value];
         if(!bodyType)return;
         this.appearance={...this.appearance,bodyType};
         this.lineup.update(this.faction,this.characterClass,this.race,bodyType);
       }else if(key==="frame"){
         this.appearance={...this.appearance,frame:value===0?"lean":"sturdy"};
       }else{
         this.appearance={...this.appearance,[key]:value};
       }
       this.preview.update(this.race,this.characterClass,this.appearance);
     });
     label.appendChild(select);appearancePanel.appendChild(label);
   }
   this.preview.update(this.race,this.characterClass,this.appearance);
   this.lineup.update(this.faction,this.characterClass,this.race,this.appearance.bodyType);
   this.display.textContent=RACES[this.race].name+" · "+CLASSES[this.characterClass].name;
   this.element.style.setProperty("--creator-accent",RACES[this.race].color);
 }
}
