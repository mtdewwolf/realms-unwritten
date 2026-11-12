import type {ServerWebSocket} from "bun";
import {Database} from "bun:sqlite";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import {mkdirSync} from "node:fs";
import {dirname} from "node:path";
import {WorldSimulation,view} from "./simulation";
import {CombatSimulation} from "./combat";
import {InventoryStore} from "./inventory";
import {QuestStore,closeToGuard,parseQuestCommand} from "./quests";
import {PROTOCOL_VERSION,SIMULATION_HZ,SNAPSHOT_HZ,validateHello,type ServerMessage} from "./protocol";

const dbFile=process.env.WORLD_DB_PATH||"data/realms-world.sqlite";
if(dbFile!==":memory:")mkdirSync(dirname(dbFile),{recursive:true});
const db=new Database(dbFile,{create:true});
db.exec("PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS characters (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, name TEXT NOT NULL, x REAL NOT NULL, z REAL NOT NULL, updated_at INTEGER NOT NULL)");
type Stored={id:string;name:string;x:number;z:number};
const fetchCharacter=db.query<Stored,[string]>("SELECT id,name,x,z FROM characters WHERE token_hash = ?");
const insertCharacter=db.query("INSERT INTO characters (id,token_hash,name,x,z,updated_at) VALUES (?,?,?,?,?,?)");
const saveCharacter=db.query("UPDATE characters SET x=?,z=?,updated_at=? WHERE id=?");
const world=new WorldSimulation();
const combat=new CombatSimulation(world);
const inventory=new InventoryStore(db);
const quests=new QuestStore(db);
type Session={playerId:string|null; token:string|null; lastInputAt:number;messages:number; windowStart:number};
const socketByPlayer=new Map<string,ServerWebSocket<Session>>();
const hash=(token:string)=>createHash("sha256").update(token).digest("hex");
combat.onWolfDefeated=(eventId,contributors)=>{
  for(const id of contributors){
    const ws=socketByPlayer.get(id);
    if(!ws)continue;
    const reward=inventory.grantWolfKill(eventId,id);
    if(!reward)continue;
    send(ws,reward);
    send(ws,inventory.read(id));
    if(quests.recordWolfKill(id,eventId))send(ws,quests.status(id));
  }
};
const save=(id:string)=>{
  const p=world.players.get(id);
  if(p)saveCharacter.run(p.x,p.z,Date.now(),id);
};
function send(ws:ServerWebSocket<Session>,message:ServerMessage):void{
  if(ws.readyState===1)ws.send(JSON.stringify(message));
}
function disconnect(ws:ServerWebSocket<Session>):void{
  const id=ws.data.playerId;
  if(!id)return;
  if(socketByPlayer.get(id)!==ws)return;
  save(id);
  socketByPlayer.delete(id);
  world.remove(id);
  combat.leave(id);
  ws.data.playerId=null;
}
const server=Bun.serve<Session>({
  hostname:process.env.HOST||"0.0.0.0",
  port:Number(process.env.PORT||3001),
  fetch(req,server){
    const url=new URL(req.url);
    if(url.pathname==="/health")return Response.json({ok:true,game:"realms-unwritten",protocol:PROTOCOL_VERSION,players:world.players.size,wolfHealth:combat.wolf.health});
    if(url.pathname==="/ws"){
      // A public deployment must implement TLS, origin policy, auth and rate limiting at the edge.
      const ok=server.upgrade(req,{data:{playerId:null,token:null,lastInputAt:Date.now(),messages:0,windowStart:Date.now()}});
      return ok?undefined:new Response("WebSocket upgrade required",{status:426});
    }
    return new Response("Realms Unwritten authoritative movement prototype");
  },
  websocket:{
    maxPayloadLength:2048,
    idleTimeout:90,
    open(ws){send(ws,{type:"error",message:"Send hello to join the world"});},
    message(ws,message){
      if(typeof message!=="string"||message.length>2048){ws.close(1009,"Invalid message");return;}
      const now=Date.now();
      if(now-ws.data.windowStart>=1000){ws.data.windowStart=now;ws.data.messages=0;}
      if(++ws.data.messages>40){ws.close(1008,"Rate limit");return;}
      let packet:unknown;
      try{packet=JSON.parse(message);}catch{return;}
      if(!ws.data.playerId){
        const hello=validateHello(packet);
        if(!hello){send(ws,{type:"error",message:"Send a valid hello packet"});return;}
        let token=hello.token||randomBytes(32).toString("base64url");
        let stored=fetchCharacter.get(hash(token));
        if(!stored){
          if(hello.token){send(ws,{type:"error",message:"Unknown guest token"});ws.close(1008,"Invalid credentials");return;}
          const id=randomUUID();
          stored={id,name:hello.name||"Adventurer",x:0,z:0};
          insertCharacter.run(id,hash(token),stored.name,0,0,Date.now());
        }
        if(socketByPlayer.has(stored.id)){
          send(ws,{type:"error",message:"Character already connected"});
          ws.close(1008,"Duplicate session");return;
        }
        ws.data.playerId=stored.id;ws.data.token=token;
        const player=world.add(stored.id,stored.name,stored.x,stored.z);
        combat.join(stored.id);
        socketByPlayer.set(stored.id,ws);
        send(ws,{type:"welcome",protocol:PROTOCOL_VERSION,id:stored.id,token,player:view(player)});
        send(ws,inventory.read(stored.id));
        send(ws,quests.status(stored.id));
        return;
      }
      if((packet as {type?:unknown})?.type==="quest"){
        const action=parseQuestCommand(packet);
        if(!action){send(ws,{type:"quest_result",action:"status",ok:false,reason:"Invalid quest command"});return;}
        const id=ws.data.playerId;
        if(action==="status"){send(ws,quests.status(id));return;}
        const actor=world.players.get(id);
        const alive=combat.players.get(id)?.alive===true;
        if(!actor||!alive||!closeToGuard(actor.x,actor.z)){
          send(ws,{type:"quest_result",action,ok:false,reason:"Approach the Verdant Reach guard"});
          return;
        }
        const ok=action==="accept"?quests.accept(id):quests.turnin(id);
        send(ws,{type:"quest_result",action,ok,reason:ok?undefined:action==="accept"?"Quest already accepted":"Defeat three wolves before turning in"});
        send(ws,quests.status(id));
        if(ok&&action==="turnin")send(ws,inventory.read(id));
        return;
      }
      if((packet as {type?:unknown})?.type==="inventory"){
        send(ws,inventory.read(ws.data.playerId));
        return;
      }
      if((packet as {type?:unknown})?.type==="action"){
        const result=combat.action(ws.data.playerId,packet);
        if(result)send(ws,result);
        return;
      }
      if((packet as {type?:unknown})?.type==="input"){
        if(world.input(ws.data.playerId,packet))ws.data.lastInputAt=now;
      }
    },
    close(ws){disconnect(ws);}
  }
});
const simulation=setInterval(()=>{
  const now=Date.now();
  for(const [id,ws] of socketByPlayer){
    if(now-ws.data.lastInputAt>400){const player=world.players.get(id);if(player){player.dx=0;player.dz=0;}}
  }
  for(const [id,p] of world.players)if(combat.players.get(id)?.alive===false){p.dx=0;p.dz=0;}
  world.tick();
  combat.tick();
},1000/SIMULATION_HZ);
const broadcast=setInterval(()=>{
  for(const [id,ws] of socketByPlayer){
    const snapshot=world.snapshot(id);
    const vitals=combat.vital(id);
    if(snapshot&&vitals)send(ws,{...snapshot,vitals,wolf:Math.hypot(snapshot.you.x-combat.wolf.x,snapshot.you.z-combat.wolf.z)<=160?combat.wolfView():null});
  }
},1000/SNAPSHOT_HZ);
const persistence=setInterval(()=>{
  for(const id of world.players.keys())save(id);
},10000);
const stop=()=>{
  clearInterval(simulation);clearInterval(broadcast);clearInterval(persistence);
  for(const id of world.players.keys())save(id);
  db.close();server.stop(true);
};
process.once("SIGINT",()=>{stop();process.exit(0);});
process.once("SIGTERM",()=>{stop();process.exit(0);});
console.log("Realms Unwritten server on "+server.url+" (WebSocket: /ws)");
