export interface InventoryItem{id:"wolf-pelt"|"wolf-fang";name:string;quantity:number}
export interface InventoryState{type:"inventory";items:InventoryItem[];coins:number}
export interface RewardEvent{type:"reward";eventId:string;items:InventoryItem[];coins:number}
export class InventoryPanel{
  readonly element:HTMLElement;
  readonly button:HTMLButtonElement;
  private readonly coins:HTMLElement;
  private readonly items:HTMLElement;
  constructor(host:HTMLElement){
    this.button=document.createElement("button");this.button.id="inventory-toggle";
    this.button.type="button";this.button.textContent="🎒 BAG";host.appendChild(this.button);
    this.element=document.createElement("section");this.element.id="inventory-panel";this.element.hidden=true;
    this.element.setAttribute("aria-label","Inventory");
    this.element.innerHTML='<div class="bag-heading"><strong>BACKPACK</strong><button type="button" id="bag-close">✕</button></div><p id="bag-coins"></p><div id="bag-items"></div><p class="bag-note">The server owns your items. Defeat the wolf online to earn loot.</p>';
    host.appendChild(this.element);
    this.coins=this.element.querySelector<HTMLElement>("#bag-coins")!;
    this.items=this.element.querySelector<HTMLElement>("#bag-items")!;
    this.button.addEventListener("click",()=>this.element.hidden=!this.element.hidden);
    this.element.querySelector("#bag-close")!.addEventListener("click",()=>this.element.hidden=true);
    this.offline();
  }
  update(state:InventoryState):void{
    this.coins.textContent="Coins: "+state.coins;this.items.replaceChildren();
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
  }
}
