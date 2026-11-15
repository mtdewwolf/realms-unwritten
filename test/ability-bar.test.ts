import {readFileSync} from "node:fs";
import {describe,expect,test} from "bun:test";
import {cooldownCaption,AbilityBar} from "../apps/client/src/ui/abilityBar";
import {describeAbilityResult} from "../apps/client/src/ui/abilityFeedback";
import type {ClassAbility} from "../apps/shared/src/classAbilities";
import type {ClassAbilityResult} from "../apps/server/src/protocol";

interface FakeElement{
 tag:string;type:string;disabled:boolean;textContent:string;
 dataset:Record<string,string>;
 children:FakeElement[];
 attrs:Map<string,string>;
 listeners:Map<string,Array<()=>void>>;
 classList:{toggle:(name:string,on?:boolean)=>void};
 setAttribute(name:string,value:string):void;
 getAttribute(name:string):string|null;
 append(...nodes:FakeElement[]):void;
 replaceChildren():void;
 addEventListener(type:string,fn:()=>void):void;
 click():void;
 querySelector(sel:string):FakeElement|null;
 querySelectorAll(sel:string):FakeElement[];
}
function element(tag:string):FakeElement{
 const node:FakeElement={
  tag,type:"",disabled:false,textContent:"",dataset:{},children:[],
  attrs:new Map(),listeners:new Map(),
  classList:{toggle(){}},
  setAttribute(name,value){this.attrs.set(name,value);},
  getAttribute(name){return this.attrs.get(name)??null;},
  append(...nodes){this.children.push(...nodes);},
  replaceChildren(){this.children=[];},
  addEventListener(type,fn){
   const list=this.listeners.get(type)??[];
   list.push(fn);this.listeners.set(type,list);
  },
  click(){if(this.disabled)return;for(const fn of this.listeners.get("click")??[])fn();},
  querySelector(sel){return this.querySelectorAll(sel)[0]??null;},
  querySelectorAll(sel){
   const found=this.children.flatMap(child=>[child,...child.querySelectorAll("*")]);
   if(sel==="button")return found.filter(child=>child.tag==="button");
   if(sel==="span")return found.filter(child=>child.tag==="span");
   const ability=/^\[data-ability='([^']+)'\]$/.exec(sel);
   if(ability)return found.filter(child=>child.dataset.ability===ability[1]);
   if(sel==="*")return found;
   return [];
  }
 };
 return node;
}
function mountBar(onUse:(ability:ClassAbility)=>void){
 const keys:Array<(event:KeyboardEvent)=>void>=[];
 const host=element("div");
 const doc={createElement:element} as unknown as Document;
 const view={addEventListener(_type:string,fn:(event:KeyboardEvent)=>void){keys.push(fn);}} as unknown as Window;
 const bar=new AbilityBar(host as unknown as HTMLElement,onUse,doc,view);
 return {host,bar,pressKey(key:string){
  const event={key,repeat:false,metaKey:false,ctrlKey:false,altKey:false,target:null,preventDefault(){}} as unknown as KeyboardEvent;
  for(const fn of keys)fn(event);
 }};
}
function result(partial:Pick<ClassAbilityResult,"ability"> & Partial<ClassAbilityResult>):ClassAbilityResult{
 return {type:"ability_result",seq:1,ok:true,wolfHealth:60,health:100,stamina:80,cooldownSeconds:8,...partial};
}
describe("ability bar and result copy",()=>{
 test("cooldown captions count whole seconds and clear at zero",()=>{
  expect(cooldownCaption("BOLT",3500,1000)).toEqual({text:"BOLT 3s",cooling:true});
  expect(cooldownCaption("BOLT",1000,1000)).toEqual({text:"BOLT",cooling:false});
 });
 test("successful results describe the server outcome",()=>{
  expect(describeAbilityResult(result({ability:"arc-bolt",wolfHealth:32})).text).toBe("Arc Bolt hit · wolf HP 32");
  expect(describeAbilityResult(result({ability:"mend",healedHealth:62,subjectSelf:false})).text).toBe("Mend restored an ally to 62");
  expect(describeAbilityResult(result({ability:"aether-ward",subjectSelf:true})).text).toBe("Aether Ward on you");
  expect(describeAbilityResult(result({ability:"keen-senses",scout:{wolf:{x:5,z:5,distance:15},allies:1}})).text).toBe("Wolf sensed 15m · allies 1");
  expect(describeAbilityResult(result({ability:"keen-senses",scout:{wolf:null,allies:0}})).anchor).toBe("self");
  expect(describeAbilityResult(result({ability:"shadowstep"})).gesture).toBe("strike");
  expect(describeAbilityResult(result({ability:"veil"})).visual).toBe("veil");
 });
 test("the bar shows one button per ability and blocks a cooling slot",()=>{
  const pressed:ClassAbility[]=[];
  const {host,bar,pressKey}=mountBar(ability=>pressed.push(ability));
  bar.setClass("spellweaver");
  const buttons=host.querySelectorAll("button");
  expect(buttons).toHaveLength(4);
  expect(buttons[0]?.getAttribute("aria-label")).toBe("Arc Bolt");
  expect(buttons.every(button=>button.type==="button")).toBe(true);
  bar.note("arc-bolt",9,1_000);
  bar.update(2_000);
  expect(buttons[0]?.disabled).toBe(true);
  expect(buttons[0]?.querySelector("span")?.textContent).toBe("BOLT 8s");
  buttons[0]?.click();
  buttons[1]?.click();
  expect(pressed).toEqual(["starfall"]);
  bar.setClass("shadeblade");
  expect(host.querySelectorAll("button")).toHaveLength(4);
  expect(host.querySelector("[data-ability='veil']")).toBeTruthy();
  pressKey("1");
  expect(pressed).toEqual(["starfall","quickstrike"]);
  const css=readFileSync(new URL("../apps/client/src/style.css",import.meta.url),"utf8");
  expect(css).toContain("#ability-bar button{width:52px;height:52px;min-width:48px;min-height:48px;");
  expect(css).toContain("touch-action:manipulation");
 });
});
