import {GAME_TABS,nextMenuView,type GameTab,type MenuView} from "./menuState";
export interface MenuPanel{open:()=>void;close:()=>void}
/**
 * One modal at a time, but the game keeps updating beneath it.
 * Existing map/inventory/quest/hero panels own their contents; this only routes navigation.
 */
export class GameMenu{
  readonly button:HTMLButtonElement;
  readonly drawer:HTMLElement;
  private readonly backdrop:HTMLElement;
  private view:MenuView="closed";
  private readonly entries=new Map<GameTab,MenuPanel>();
  constructor(private readonly host:HTMLElement){
    this.button=document.createElement("button");
    this.button.type="button";this.button.id="game-menu-button";
    this.button.textContent="☰ MENU";
    this.button.setAttribute("aria-label","Open game menu");
    this.button.setAttribute("aria-controls","game-menu-drawer");
    this.button.setAttribute("aria-expanded","false");
    this.backdrop=document.createElement("div");
    this.backdrop.id="game-menu-backdrop";this.backdrop.hidden=true;
    this.drawer=document.createElement("nav");
    this.drawer.id="game-menu-drawer";this.drawer.hidden=true;
    this.drawer.setAttribute("aria-label","Game navigation");
    this.drawer.innerHTML='<div class="menu-top"><strong>REALMS UNWRITTEN</strong><button type="button" id="game-menu-close" aria-label="Close menu">✕</button></div><p class="menu-subtitle">ADVENTURER MENU</p><div class="menu-grid"></div><p class="menu-footnote">Move with the joystick · fight with ATTACK and DODGE · mine beside ore.</p>';
    const grid=this.drawer.querySelector<HTMLElement>(".menu-grid")!;
    const labels:Record<GameTab,{icon:string;title:string;desc:string}>={
      map:{icon:"🗺",title:"Map",desc:"Explore & waypoints"},
      bag:{icon:"🎒",title:"Backpack",desc:"Items & crafting"},
      quest:{icon:"📜",title:"Quests",desc:"Wolf Hunt"},
      hero:{icon:"★",title:"Character",desc:"XP & attributes"},
      network:{icon:"◉",title:"Multiplayer",desc:"Server connection"}
    };
    for(const tab of GAME_TABS){
      const item=document.createElement("button");item.type="button";item.dataset.tab=tab;
      const icon=document.createElement("span");icon.className="menu-entry-icon";icon.textContent=labels[tab].icon;
      const content=document.createElement("span");content.className="menu-entry-text";
      const name=document.createElement("strong");name.textContent=labels[tab].title;
      const desc=document.createElement("small");desc.textContent=labels[tab].desc;
      content.append(name,desc);item.append(icon,content);grid.appendChild(item);
      item.addEventListener("click",()=>this.navigate(tab));
    }
    host.append(this.backdrop,this.drawer,this.button);
    this.button.addEventListener("click",()=>this.toggle());
    this.drawer.querySelector("#game-menu-close")!.addEventListener("click",()=>this.close());
    this.backdrop.addEventListener("click",()=>this.close());
    window.addEventListener("keydown",event=>{
      if(event.key!=="Escape")return;
      if(this.view==="closed")return;
      this.close();event.preventDefault();event.stopImmediatePropagation();
    },true);
  }
  register(tab:GameTab,panel:MenuPanel):void{this.entries.set(tab,panel);}
  get activeView():MenuView{return this.view;}
  toggle():void{this.transition("toggle");}
  navigate(tab:GameTab):void{this.transition(tab);}
  close():void{this.transition("close");}
  private transition(action:"toggle"|"close"|GameTab):void{
    const previous=this.view;
    const next=nextMenuView(previous,action);
    if(previous!=="menu"&&previous!=="closed")this.entries.get(previous)?.close();
    this.view=next;
    this.drawer.hidden=next!=="menu";
    this.backdrop.hidden=next==="closed";
    this.button.textContent=next==="closed"?"☰ MENU":"← BACK";
    this.button.setAttribute("aria-expanded",String(next!=="closed"));
    this.button.setAttribute("aria-label",next==="closed"?"Open game menu":"Back to game menu");
    this.host.classList.toggle("game-menu-open",next!=="closed");
    if(next!=="menu"&&next!=="closed")this.entries.get(next)?.open();
  }
}
