import {describe,expect,test} from "bun:test";
import {Database} from "bun:sqlite";
import {existsSync,mkdtempSync,rmSync,unlinkSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

describe("server persistence on shutdown",()=>{
 test("creates WORLD_DB_PATH's directory and checkpoints SQLite on SIGTERM",async()=>{
  const dir=mkdtempSync(join(tmpdir(),"realms-shutdown-"));
  const dbPath=join(dir,"missing","realms-world.sqlite");
  const port=30000+Math.floor(Math.random()*20000);
  const proc=Bun.spawn(["bun","apps/server/src/index.ts"],{
   cwd:join(import.meta.dir,".."),
   env:{...process.env,HOST:"127.0.0.1",PORT:String(port),WORLD_DB_PATH:dbPath},
   stdout:"pipe",stderr:"pipe"
  });
  const logs:string[]=[];
  const collect=(stream:ReadableStream<Uint8Array>)=>void (async()=>{
   const reader=stream.getReader();
   const decoder=new TextDecoder();
   while(true){
    const chunk=await reader.read();
    if(chunk.done)break;
    logs.push(decoder.decode(chunk.value));
   }
  })();
  collect(proc.stdout);collect(proc.stderr);
  const sockets:WebSocket[]=[];
  try{
   let healthy=false;
   for(let n=0;n<80&&proc.exitCode===null;n++){
    try{
     const response=await fetch("http://127.0.0.1:"+port+"/health");
     if(response.ok){healthy=true;break;}
    }catch{/* process still booting */}
    await Bun.sleep(50);
   }
   expect(healthy).toBe(true);
   expect(existsSync(dbPath)).toBe(true);
   const socket=new WebSocket("ws://127.0.0.1:"+port+"/ws");
   sockets.push(socket);
   const welcome=await new Promise<{id:string}>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("Welcome timed out: "+logs.join(""))),4000);
    socket.addEventListener("open",()=>socket.send(JSON.stringify({type:"hello",name:"Rail Hero"})));
    socket.addEventListener("message",event=>{
     const packet=JSON.parse(String(event.data));
     if(packet.type==="creation_required")socket.send(JSON.stringify({type:"create_character",name:"Rail Hero",faction:"radiant-accord",race:"sunborne",characterClass:"vanguard"}));
     if(packet.type==="welcome"){clearTimeout(timer);resolve(packet);}
    });
   });
   const moved=new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("Position was not saved into motion")),3000);
    socket.addEventListener("message",event=>{
     const packet=JSON.parse(String(event.data));
     if(packet.type==="snapshot"&&packet.you?.x>0.1){clearTimeout(timer);resolve();}
    });
   });
   socket.send(JSON.stringify({type:"input",seq:1,dx:1,dz:0}));
   await moved;
   proc.kill("SIGTERM");
   await proc.exited;
   expect(proc.exitCode).toBe(0);
   for(const suffix of ["-wal","-shm"])if(existsSync(dbPath+suffix))unlinkSync(dbPath+suffix);
   const db=new Database(dbPath,{readonly:true});
   const integrity=db.query<{integrity_check:string},[]>("PRAGMA integrity_check").get();
   const row=db.query<{name:string;x:number},[string]>("SELECT name,x FROM characters WHERE id=?").get(welcome.id);
   db.close();
   expect(integrity?.integrity_check).toBe("ok");
   expect(row?.name).toBe("Rail Hero");
   expect(row?.x??0).toBeGreaterThan(0.1);
  }finally{
   for(const socket of sockets)socket.close();
   if(proc.exitCode===null)proc.kill();
   rmSync(dir,{recursive:true,force:true});
  }
 });
});
