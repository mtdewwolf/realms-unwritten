import * as THREE from "three";
import {groundHeightAt} from "../world/chunkedWorld";

export interface QuestState{
  type:"quest_status";id:"verdant-wolf-hunt";title:string;
  stage:"available"|"active"|"ready"|"completed";
  kills:number;required:number;rewardCoins:number;
}
export interface QuestResult{
  type:"quest_result";action:"status"|"accept"|"turnin";ok:boolean;reason?:string;
}
export class QuestPanel {
  readonly button:HTMLButtonElement;
  readonly element:HTMLElement;
  private readonly stateText:HTMLElement;
  private readonly details:HTMLElement;
  private readonly acceptButton:HTMLButtonElement;
  private readonly turninButton:HTMLButtonElement;
  constructor(host:HTMLElement,scene:THREE.Scene,send:(action:"status"|"accept"|"turnin")=>boolean){
    // A simple recognizable guard blockout, not a rigged production NPC.
    const guard=new THREE.Group();
    guard.position.set(2,groundHeightAt(2,-3),-3);
    const coat=new THREE.Mesh(new THREE.CylinderGeometry(.45,.55,1.45,8),new THREE.MeshLambertMaterial({color:0x345b70}));
    coat.position.y=.9;guard.add(coat);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.34,9,8),new THREE.MeshLambertMaterial({color:0xddb48a}));
    head.position.y=1.86;guard.add(head);
    const helmet=new THREE.Mesh(new THREE.ConeGeometry(.47,.48,8),new THREE.MeshLambertMaterial({color:0x86959b}));
    helmet.position.y=2.25;guard.add(helmet);
    const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.38),new THREE.MeshBasicMaterial({color:0xffd17c}));
    marker.position.y=3;guard.add(marker);scene.add(guard);
    this.button=document.createElement("button");
    this.button.id="quest-toggle";this.button.type="button";this.button.textContent="❕ QUEST";
    host.appendChild(this.button);
    this.element=document.createElement("section");this.element.id="quest-panel";this.element.hidden=true;
    this.element.setAttribute("aria-label","Verdant Reach quests");
    this.element.innerHTML='<div class="quest-heading"><strong>GUARD · VERDANT REACH</strong><button type="button" id="quest-close">✕</button></div><h3>Wolf Hunt</h3><p id="quest-details">Connect to the world server to begin.</p><p id="quest-state"></p><div class="quest-actions"><button type="button" id="quest-accept">Accept Quest</button><button type="button" id="quest-turnin">Claim Reward</button></div><p class="quest-note">Speak to the guard at the starter village. Quest progress is saved on the server.</p>';
    host.appendChild(this.element);
    this.stateText=this.element.querySelector<HTMLElement>("#quest-state")!;
    this.details=this.element.querySelector<HTMLElement>("#quest-details")!;
    this.acceptButton=this.element.querySelector<HTMLButtonElement>("#quest-accept")!;
    this.turninButton=this.element.querySelector<HTMLButtonElement>("#quest-turnin")!;
    this.button.addEventListener("click",()=>{
      this.element.hidden=!this.element.hidden;
      if(!this.element.hidden)send("status");
    });
    this.element.querySelector("#quest-close")!.addEventListener("click",()=>this.element.hidden=true);
    this.acceptButton.addEventListener("click",()=>send("accept"));
    this.turninButton.addEventListener("click",()=>send("turnin"));
    this.offline();
  }
  update(state:QuestState):void{
    const message:Record<QuestState["stage"],string>={
      available:"The wolves threaten the road. Speak with the guard to accept the hunt.",
      active:"Defeat the shared starter wolf three times. Qualifying kills count for every contributor with an active quest.",
      ready:"Objective complete! Return to the guard to claim 25 coins.",
      completed:"Wolf Hunt completed. Your reward has been claimed."
    };
    this.details.textContent=message[state.stage];
    this.stateText.textContent=state.stage.toUpperCase()+" · "+state.kills+"/"+state.required+" wolf kills · "+state.rewardCoins+" coin reward";
    this.acceptButton.hidden=state.stage!=="available";
    this.turninButton.hidden=state.stage!=="ready";
  }
  result(result:QuestResult):void{
    if(!result.ok)this.stateText.textContent=result.reason??"The guard cannot complete that action.";
  }
  offline():void{
    this.details.textContent="Connect to the Bun multiplayer server and visit the Verdant Reach guard.";
    this.stateText.textContent="Quest progress unavailable offline";
    this.acceptButton.hidden=true;this.turninButton.hidden=true;
  }
}
