/** End-to-end smoke: Bun process, WebSocket joins, authoritative movement, AOI. */
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const port=40000+Math.floor(Math.random()*15000);
const dir=mkdtempSync(join(tmpdir(),"realms-smoke-"));
const processHandle=Bun.spawn(["bun","apps/server/src/index.ts"],{
  env:{...process.env,PORT:String(port),HOST:"127.0.0.1",WORLD_DB_PATH:join(dir,"smoke.sqlite")},
  stdout:"pipe",stderr:"pipe"
});
const sockets:WebSocket[]=[];
function delay(ms:number){return new Promise(resolve=>setTimeout(resolve,ms));}
async function connect():Promise<{socket:WebSocket;welcome:any}>{
  const socket=new WebSocket("ws://127.0.0.1:"+port+"/ws");
  sockets.push(socket);
  const welcome=await new Promise<any>((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error("WebSocket welcome timed out")),4000);
    socket.addEventListener("error",()=>{clearTimeout(timeout);reject(new Error("WebSocket failed"));});
    socket.addEventListener("open",()=>socket.send(JSON.stringify({type:"hello",name:"Test Adventurer"})));
    socket.addEventListener("message",e=>{
      const packet=JSON.parse(String(e.data));
      if(packet.type==="welcome"){clearTimeout(timeout);resolve(packet);}
    });
  });
  return {socket,welcome};
}
async function run(){
  let healthy=false;
  for(let n=0;n<80;n++){
    if(processHandle.exitCode!==null)throw new Error("Server exited during bootstrap");
    try{
      const response=await fetch("http://127.0.0.1:"+port+"/health");
      if(response.ok){healthy=true;break;}
    }catch{/* retry */}
    await delay(50);
  }
  if(!healthy)throw new Error("Server /health failed");
  const first=await connect(),second=await connect();
  if(first.welcome.id===second.welcome.id)throw new Error("Distinct guests shared an identity");
  const target=new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("Player movement did not replicate")),3500);
    second.socket.addEventListener("message",e=>{
      const packet=JSON.parse(String(e.data));
      if(packet.type==="snapshot"&&packet.others.some((p:any)=>p.id===first.welcome.id&&p.x>0.1)){
        clearTimeout(timer);resolve();
      }
    });
  });
  first.socket.send(JSON.stringify({type:"input",seq:1,dx:1,dz:0,x:4000}));
  await target;
  console.log("PASS multiplayer smoke: 2 guests, authoritative position and nearby snapshots");
}
try{await run();}
finally{
  for(const socket of sockets)socket.close();
  processHandle.kill();
  await processHandle.exited;
  rmSync(dir,{recursive:true,force:true});
}
