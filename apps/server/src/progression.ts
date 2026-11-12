import {Database} from "bun:sqlite";

export const MAX_LEVEL=50;
export const MAX_XP=2_000_000_000;
export const WOLF_KILL_XP=15;
export const WOLF_HUNT_XP=75;
export const WOLF_HUNT_REWARD_ID="quest:verdant-wolf-hunt";

export function experienceForLevel(level:number):number{
  const safe=Math.max(1,Math.min(MAX_LEVEL,Math.floor(Number.isFinite(level)?level:1)));
  return 50*(safe-1)*safe;
}
export function levelForExperience(totalXp:number):number{
  const xp=Math.max(0,Math.min(MAX_XP,Math.floor(Number.isFinite(totalXp)?totalXp:0)));
  let level=1;
  while(level<MAX_LEVEL&&xp>=experienceForLevel(level+1))level++;
  return level;
}
export interface CharacterProgression{
  type:"progression";
  xp:number;
  level:number;
  nextLevelXp:number|null;
  attributes:{strength:number;vitality:number;agility:number};
}
export class ProgressionStore{
  private readonly grantTx;
  constructor(private readonly db:Database){
    db.exec("CREATE TABLE IF NOT EXISTS character_progression(character_id TEXT PRIMARY KEY,xp INTEGER NOT NULL DEFAULT 0 CHECK(xp>=0 AND xp<=2000000000),FOREIGN KEY(character_id) REFERENCES characters(id));");
    db.exec("CREATE TABLE IF NOT EXISTS progression_receipts(character_id TEXT NOT NULL,event_id TEXT NOT NULL,xp INTEGER NOT NULL CHECK(xp>0),PRIMARY KEY(character_id,event_id),FOREIGN KEY(character_id) REFERENCES characters(id));");
    const receipt=db.query("INSERT OR IGNORE INTO progression_receipts(character_id,event_id,xp) VALUES (?,?,?)");
    const credit=db.query("INSERT INTO character_progression(character_id,xp) VALUES (?,?) ON CONFLICT(character_id) DO UPDATE SET xp=MIN(2000000000,xp+excluded.xp)");
    this.grantTx=db.transaction((id:string,eventId:string,amount:number)=>{
      if(!eventId||eventId.length>110||!Number.isSafeInteger(amount)||amount<=0||amount>1000)
        throw new Error("Invalid progression grant");
      if(receipt.run(id,eventId,amount).changes!==1)return false;
      credit.run(id,amount);
      return true;
    });
  }
  grantWolfKill(id:string,eventId:string):boolean{
    if(!/^wolf-kill-[0-9a-f-]{36}$/.test(eventId))throw new Error("Invalid wolf kill event");
    return this.grantTx(id,"xp:"+eventId,WOLF_KILL_XP);
  }
  grantQuest(id:string):boolean{
    return this.grantTx(id,WOLF_HUNT_REWARD_ID,WOLF_HUNT_XP);
  }
  read(id:string):CharacterProgression{
    const row=this.db.query<{xp:number},[string]>("SELECT xp FROM character_progression WHERE character_id=?").get(id);
    const xp=row?.xp??0;
    const level=levelForExperience(xp);
    return {
      type:"progression",xp,level,
      nextLevelXp:level>=MAX_LEVEL?null:experienceForLevel(level+1),
      attributes:{strength:5+(level-1)*2,vitality:5+(level-1),agility:5+Math.floor((level-1)/2)}
    };
  }
}
