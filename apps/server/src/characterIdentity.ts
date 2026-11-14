import {Database} from "bun:sqlite";
import {LEGACY_IDENTITY,type CharacterCreation,type CharacterIdentity} from "../../shared/src/characterCatalog";
type IdentityRow={name:string;faction:string;race:string;character_class:string};
export class CharacterIdentityStore{
 constructor(private readonly db:Database){
  db.exec("CREATE TABLE IF NOT EXISTS character_identities(character_id TEXT PRIMARY KEY,faction TEXT NOT NULL CHECK(faction IN ('radiant-accord','umbral-dominion')),race TEXT NOT NULL CHECK(race IN ('sunborne','thornkin','ashforged','veilkin')),character_class TEXT NOT NULL CHECK(character_class IN ('vanguard','spellweaver','shadeblade')),FOREIGN KEY(character_id) REFERENCES characters(id));");
 }
 assign(id:string,selection:CharacterCreation):void{
  const inserted=this.db.query("INSERT INTO character_identities(character_id,faction,race,character_class) VALUES (?,?,?,?)").run(id,selection.faction,selection.race,selection.characterClass);
  if(inserted.changes!==1)throw Error("Character already configured");
 }
 migrateLegacy(id:string):void{
  this.db.query("INSERT OR IGNORE INTO character_identities(character_id,faction,race,character_class) VALUES (?,?,?,?)").run(id,LEGACY_IDENTITY.faction,LEGACY_IDENTITY.race,LEGACY_IDENTITY.characterClass);
 }
 read(id:string):CharacterIdentity|null{
  const row=this.db.query<IdentityRow,[string]>("SELECT c.name,i.faction,i.race,i.character_class FROM character_identities i JOIN characters c ON c.id=i.character_id WHERE i.character_id=?").get(id);
  if(!row)return null;
  return {name:row.name,faction:row.faction as CharacterIdentity["faction"],race:row.race as CharacterIdentity["race"],characterClass:row.character_class as CharacterIdentity["characterClass"]};
 }
}
