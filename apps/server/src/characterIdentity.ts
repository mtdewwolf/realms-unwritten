import {Database} from "bun:sqlite";
import {DEFAULT_APPEARANCE,LEGACY_IDENTITY,parseAppearance,type CharacterCreation,type CharacterIdentity} from "../../shared/src/characterCatalog";
type Row={name:string;faction:string;race:string;character_class:string;appearance_json:string};
export class CharacterIdentityStore{
 constructor(private readonly db:Database){
  const createTable=(table:string)=>"CREATE TABLE "+table+"(character_id TEXT PRIMARY KEY,faction TEXT NOT NULL CHECK(faction IN ('radiant-accord','umbral-dominion')),race TEXT NOT NULL CHECK(race IN ('sunborne','thornkin','stonehearth','aetheri','ashforged','hornwarden','hollowborn','veilkin')),character_class TEXT NOT NULL CHECK(character_class IN ('vanguard','spellweaver','shadeblade')),appearance_json TEXT NOT NULL DEFAULT '{}',FOREIGN KEY(character_id) REFERENCES characters(id))";
  db.exec(createTable("IF NOT EXISTS character_identities"));
  // Old versions constrained the race field to four options. Rebuild the table atomically
  // while keeping the same character IDs, appearances, and ownership references.
  const schema=db.query<{sql:string},[]>("SELECT sql FROM sqlite_master WHERE type='table' AND name='character_identities'").get()?.sql??"";
  if(!schema.includes("stonehearth")){
   db.transaction(()=>{
    const columns=db.query<{name:string},[]>("PRAGMA table_info(character_identities)").all();
    if(!columns.some(c=>c.name==="appearance_json"))
      db.exec("ALTER TABLE character_identities ADD COLUMN appearance_json TEXT NOT NULL DEFAULT '{}'");
    db.exec("ALTER TABLE character_identities RENAME TO character_identities_v1");
    db.exec(createTable("character_identities"));
    db.exec("INSERT INTO character_identities(character_id,faction,race,character_class,appearance_json) SELECT character_id,faction,race,character_class,appearance_json FROM character_identities_v1");
    db.exec("DROP TABLE character_identities_v1");
   })();
  }
  const columns=db.query<{name:string},[]>("PRAGMA table_info(character_identities)").all();
  if(!columns.some(c=>c.name==="appearance_json"))
   db.exec("ALTER TABLE character_identities ADD COLUMN appearance_json TEXT NOT NULL DEFAULT '{}'");
 }
 assign(id:string,selection:CharacterCreation):void{
  const inserted=this.db.query("INSERT INTO character_identities(character_id,faction,race,character_class,appearance_json) VALUES (?,?,?,?,?)").run(id,selection.faction,selection.race,selection.characterClass,JSON.stringify(selection.appearance));
  if(inserted.changes!==1)throw Error("Character already configured");
 }
 migrateLegacy(id:string):void{
  this.db.query("INSERT OR IGNORE INTO character_identities(character_id,faction,race,character_class,appearance_json) VALUES (?,?,?,?,?)").run(id,LEGACY_IDENTITY.faction,LEGACY_IDENTITY.race,LEGACY_IDENTITY.characterClass,JSON.stringify(DEFAULT_APPEARANCE));
 }
 read(id:string):CharacterIdentity|null{
  const row=this.db.query<Row,[string]>("SELECT c.name,i.faction,i.race,i.character_class,i.appearance_json FROM character_identities i JOIN characters c ON c.id=i.character_id WHERE i.character_id=?").get(id);
  if(!row)return null;
  let appearance={...DEFAULT_APPEARANCE};
  try{appearance=parseAppearance(JSON.parse(row.appearance_json))??appearance;}catch{/* legacy row */}
  return {name:row.name,faction:row.faction as CharacterIdentity["faction"],race:row.race as CharacterIdentity["race"],characterClass:row.character_class as CharacterIdentity["characterClass"],appearance};
 }
}
