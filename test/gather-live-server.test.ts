import {describe,expect,test} from "bun:test";
import {closestResource} from "../apps/client/src/ui/resourceGuidance";

describe("gathering against a running realm server",()=>{
  test("walking onto a node and gathering credits inventory",async()=>{
    const port=41000+Math.floor(Math.random()*10000);
    const proc=Bun.spawn(["bun","apps/server/src/index.ts"],{
      env:{...process.env,PORT:String(port),HOST:"127.0.0.1",WORLD_DB_PATH:":memory:"},
      stdout:"pipe",stderr:"pipe"
    });
    const sockets:WebSocket[]=[];
    const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
    try{
      let healthy=false;
      for(let i=0;i<60;i++){
        try{
          const response=await fetch("http://127.0.0.1:"+port+"/health");
          if(response.ok){healthy=true;break;}
        }catch{/* server still binding */}
        await delay(50);
      }
      expect(healthy).toBe(true);
      const node=closestResource(0,0);
      expect(node).not.toBeNull();
      const ws=new WebSocket("ws://127.0.0.1:"+port+"/ws");
      sockets.push(ws);
      const inbox:any[]=[];
      let snapshot:any=null;
      ws.addEventListener("message",event=>{
        const packet=JSON.parse(String(event.data));
        if(packet.type==="snapshot")snapshot=packet;
        else inbox.push(packet);
        if(packet.type==="creation_required"){
          ws.send(JSON.stringify({type:"create_character",name:"Gatherer",faction:"radiant-accord",race:"sunborne",characterClass:"vanguard"}));
        }
      });
      await new Promise<void>((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error("welcome timed out")),5000);
        ws.addEventListener("open",()=>ws.send(JSON.stringify({type:"hello",name:"Gatherer"})));
        const wait=setInterval(()=>{
          if(inbox.some(packet=>packet.type==="welcome")){clearInterval(wait);clearTimeout(timer);resolve();}
        },20);
      });
      const early=waitFor(ws,"resource_result");
      ws.send(JSON.stringify({type:"gather",x:node!.x,z:node!.z}));
      const rejected=await early;
      expect(rejected.ok).toBe(false);
      expect(rejected.action).toBe("gather");
      let seq=0;
      const started=Date.now();
      while(Date.now()-started<40000){
        const you=snapshot?.you??{x:0,z:0};
        const dx=node!.x-you.x,dz=node!.z-you.z;
        const distance=Math.hypot(dx,dz);
        if(distance<1.2)break;
        const scale=Math.max(1,distance);
        seq++;
        ws.send(JSON.stringify({type:"input",seq,dx:dx/scale,dz:dz/scale}));
        await delay(50);
      }
      seq++;
      ws.send(JSON.stringify({type:"input",seq,dx:0,dz:0}));
      await delay(250);
      const settled=Math.hypot((snapshot?.you.x??0)-node!.x,(snapshot?.you.z??0)-node!.z);
      expect(settled).toBeLessThan(5);
      const gathered=waitFor(ws,"resource_result");
      ws.send(JSON.stringify({type:"gather"}));
      const result=await gathered;
      expect(result.ok).toBe(true);
      expect(result.nodeId).toBe(node!.id);
      expect(result.amount).toBe(1);
      let bag:any=null;
      for(let i=0;i<20;i++){
        bag=inbox.filter(packet=>packet.type==="inventory").at(-1);
        if(bag?.items?.some((item:{id:string;quantity:number})=>item.quantity>0))break;
        await delay(25);
      }
      expect(bag.items.some((item:{id:string;quantity:number})=>item.quantity===1&&(item.id==="moonleaf"||item.id==="iron-ore"))).toBe(true);
      const again=waitFor(ws,"resource_result");
      ws.send(JSON.stringify({type:"gather"}));
      const cooled=await again;
      expect(cooled.ok).toBe(false);
      expect(cooled.nodeId).toBe(node!.id);
    }finally{
      for(const socket of sockets)socket.close();
      proc.kill();
      await delay(50);
    }
  },45_000);
});

function waitFor(socket:WebSocket,type:string):Promise<any>{
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("timed out waiting for "+type)),4000);
    const listener=(event:MessageEvent)=>{
      const packet=JSON.parse(String(event.data));
      if(packet.type!==type)return;
      socket.removeEventListener("message",listener);
      clearTimeout(timer);
      resolve(packet);
    };
    socket.addEventListener("message",listener);
  });
}
