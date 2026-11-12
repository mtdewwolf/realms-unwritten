export interface InventoryItem{id:"wolf-pelt"|"wolf-fang"|"fangblade"|"iron-ore"|"ironblade";name:string;quantity:number}
export interface InventoryState{type:"inventory";items:InventoryItem[];coins:number;equipped:{id:"starter-sword"|"fangblade"|"ironblade";name:string;bonusDamage:number}}
export interface RewardEvent{type:"reward";eventId:string;items:InventoryItem[];coins:number}
export class InventoryPanel{
  readonly element:HTMLElement;
  readonly button:HTMLButtonElement;
  private readonly coins:HTMLElement;
  private readonly items:HTMLElement;
  private readonly equipment:HTMLElement;
  constructor(host:HTMLElement,private readonly equip:(weapon:"starter-sword"|"fangblade"|"ironblade")=>boolean,private readonly craft:()=>boolean){
    this.button=document.createElement("button");this.button.id="inventory-toggle";
    this.button.type="button";this.button.textContent="🎒 BAG";host.appendChild(this.button);
    this.element=document.createElement("section");this.element.id="inventory-panel";this.element.hidden=true;
    this.element.setAttribute("aria-label","Inventory");
    this.element.innerHTML='<div class="bag-heading"><strong>BACKPACK</strong><button type="button" id="bag-close">✕</button></div><p id="bag-coins"></p><div id="bag-equipment"></div><div id="bag-items"></div><button type="button" id="bag-craft">⚒ Craft Ironblade (2 Ore + 1 Fang)</button><p class="bag-note">The server owns your items. Defeat the wolf online to earn loot.</p>';
    host.appendChild(this.element);
    this.coins=this.element.querySelector<HTMLElement>("#bag-coins")!;
    this.items=this.element.querySelector<HTMLElement>("#bag-items")!;
    this.equipment=this.element.querySelector<HTMLElement>("#bag-equipment")!;
    this.element.querySelector("#bag-craft")!.addEventListener("click",()=>this.craft());
    this.button.addEventListener("click",()=>this.element.hidden=!this.element.hidden);
    this.element.querySelector("#bag-close")!.addEventListener("click",()=>this.element.hidden=true);
    this.offline();
  }
  update(state:InventoryState):void{
    this.coins.textContent="Coins: "+state.coins;this.items.replaceChildren();
    this.equipment.replaceChildren();
    const label=document.createElement("div");label.textContent="Weapon: "+state.equipped.name+" (+"+state.equipped.bonusDamage+" damage)";this.equipment.appendChild(label);
    const next=state.equipped.id==="starter-sword"?"fangblade":"starter-sword";
    if(next==="starter-sword"||state.items.some(item=>item.id==="fangblade"&&item.quantity>0)){
      const switcher=document.createElement("button");switcher.type="button";switcher.textContent="Equip "+(next==="fangblade"?"Fangblade (+8)":"Worn Sword (+0)");
      switcher.addEventListener("click",()=>this.equip(next));this.equipment.appendChild(switcher);
    }
    for(const weapon of [{id:"fangblade" as const,name:"Fangblade",bonus:8},{id:"ironblade" as const,name:"Ironblade",bonus:12}]){
      if(state.equipped.id===weapon.id||!state.items.some(i=>i.id===weapon.id&&i.quantity>0))continue;
      if(next===weapon.id)continue;
      const button=document.createElement("button");button.type="button";button.textContent="Equip "+weapon.name+" (+"+weapon.bonus+")";
      button.addEventListener("click",()=>this.equip(weapon.id));this.equipment.appendChild(button);
    }
    const craftButton=this.element.querySelector<HTMLButtonElement>("#bag-craft")!;
    craftButton.disabled=!state.items.some(i=>i.id==="iron-ore"&&i.quantity>=2)||!state.items.some(i=>i.id==="wolf-fang"&&i.quantity>=1);
    if(!state.items.length){this.items.textContent="Your bag is empty.";return;}
    for(const item of state.items){
      const row=document.createElement("div");row.className="bag-item";
      const name=document.createElement("span");name.textContent=item.name;
      const qty=document.createElement("strong");qty.textContent="×"+item.quantity;
      row.append(name,qty);this.items.appendChild(row);
    }
  }
  offline():void{
    this.coins.textContent="Offline inventory unavailable";
    this.items.textContent="Connect to the Bun server to view saved items.";
    this.equipment.replaceChildren();
    this.element.querySelector<HTMLButtonElement>("#bag-craft")!.disabled=true;
  }
}
