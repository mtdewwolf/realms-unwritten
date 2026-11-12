export interface ProgressionState{
  type:"progression";
  xp:number;
  level:number;
  nextLevelXp:number|null;
  attributes:{strength:number;vitality:number;agility:number};
}
export class CharacterPanel {
  readonly button:HTMLButtonElement;
  readonly panel:HTMLElement;
  private readonly info:HTMLElement;
  private readonly progress:HTMLProgressElement;
  private readonly stats:HTMLElement;
  private lastLevel:number|null=null;
  constructor(host:HTMLElement,private readonly refresh:()=>void){
    this.button=document.createElement("button");
    this.button.id="character-toggle";
    this.button.type="button";
    this.button.textContent="★ HERO";
    this.button.setAttribute("aria-label","Open character progression");
    host.appendChild(this.button);
    this.panel=document.createElement("section");
    this.panel.id="character-panel";this.panel.hidden=true;
    this.panel.setAttribute("aria-label","Character progression");
    this.panel.innerHTML='<div class="character-heading"><strong>ADVENTURER</strong><button type="button" id="character-close">✕</button></div><p id="character-level">Connect to view your character.</p><progress id="character-xp" max="100" value="0"></progress><div id="character-stats"></div><p class="character-note">XP and levels are saved on the Bun server. Attributes are visible now; combat scaling and equipment arrive later.</p>';
    host.appendChild(this.panel);
    this.info=this.panel.querySelector<HTMLElement>("#character-level")!;
    this.progress=this.panel.querySelector<HTMLProgressElement>("#character-xp")!;
    this.stats=this.panel.querySelector<HTMLElement>("#character-stats")!;
    this.button.addEventListener("click",()=>{
      this.panel.hidden=!this.panel.hidden;
      if(!this.panel.hidden)this.refresh();
    });
    this.panel.querySelector("#character-close")!.addEventListener("click",()=>this.panel.hidden=true);
    this.offline();
  }
  update(p:ProgressionState):number|null{
    const previous=this.lastLevel;
    this.lastLevel=p.level;
    this.info.textContent="Level "+p.level+" · "+p.xp+" total XP";
    const base=50*Math.max(0,p.level-1)*p.level;
    const needed=p.nextLevelXp===null?0:p.nextLevelXp-base;
    this.progress.max=Math.max(1,needed);
    this.progress.value=p.nextLevelXp===null?1:Math.min(needed,Math.max(0,p.xp-base));
    this.stats.replaceChildren();
    for(const [name,value] of Object.entries(p.attributes)){
      const row=document.createElement("div");row.className="character-stat";
      const label=document.createElement("span");label.textContent=name[0].toUpperCase()+name.slice(1);
      const score=document.createElement("strong");score.textContent=String(value);
      row.append(label,score);this.stats.appendChild(row);
    }
    return previous!==null&&p.level>previous?p.level:null;
  }
  offline():void{
    this.lastLevel=null;
    this.info.textContent="Connect to the game server to view progression.";
    this.progress.max=100;this.progress.value=0;
    this.stats.textContent="Character stats unavailable offline.";
  }
}
