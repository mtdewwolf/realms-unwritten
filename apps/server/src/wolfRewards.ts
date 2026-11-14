import {Database} from "bun:sqlite";
import type {InventoryStore,RewardView} from "./inventory";
import type {QuestStore} from "./quests";
import type {ProgressionStore} from "./progression";
export interface WolfRewardResult{reward:RewardView;questAdvanced:boolean;xpGranted:boolean}
/** One SQLite commit for loot, quest credit and XP, or none. */
export class WolfRewardCoordinator{
  private readonly award;
  constructor(db:Database,inventory:InventoryStore,quests:QuestStore,progression:ProgressionStore){
    this.award=db.transaction((characterId:string,eventId:string):WolfRewardResult|null=>{
      const reward=inventory.grantWolfKill(eventId,characterId);
      if(!reward)return null;
      const questAdvanced=quests.recordWolfKill(characterId,eventId);
      const xpGranted=progression.grantWolfKill(characterId,eventId);
      if(!xpGranted)throw new Error("Wolf reward XP receipt conflict");
      return {reward,questAdvanced,xpGranted};
    });
  }
  grant(characterId:string,eventId:string):WolfRewardResult|null{
    return this.award(characterId,eventId);
  }
}
