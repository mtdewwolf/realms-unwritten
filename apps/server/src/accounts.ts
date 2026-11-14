import {Database} from "bun:sqlite";
import {createHash,randomBytes,randomUUID} from "node:crypto";
export const ACCOUNT_SESSION_DURATION_MS=30*24*60*60*1000;
const digest=(t:string)=>createHash("sha256").update(t).digest("hex");
export function validCredentials(user:unknown,password:unknown):user is string{
 return typeof user==="string"&&/^[a-zA-Z][a-zA-Z0-9_-]{2,23}$/.test(user)&&typeof password==="string"&&password.length>=10&&password.length<=128;
}
type AccountRow={id:string;pass_hash:string};
type SessionRow={account_id:string};
export class AccountStore {
 constructor(private readonly db:Database){
  db.exec("CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,pass_hash TEXT NOT NULL,created_at INTEGER NOT NULL);");
  db.exec("CREATE TABLE IF NOT EXISTS account_sessions(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),expires_at INTEGER NOT NULL);");
  const fields=db.query<{name:string},[]>("PRAGMA table_info(characters)").all();
  if(!fields.some(f=>f.name==="account_id"))db.exec("ALTER TABLE characters ADD COLUMN account_id TEXT REFERENCES accounts(id)");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS characters_account_unique ON characters(account_id) WHERE account_id IS NOT NULL;");
 }
 async register(username:unknown,password:unknown):Promise<{id:string;token:string}|null>{
  if(!validCredentials(username,password))return null;
  // Expensive hashing is performed before the insertion; UNIQUE eliminates registration races.
  const passHash=await Bun.password.hash(password as string,{algorithm:"argon2id",memoryCost:16384,timeCost:3});
  const id=randomUUID();
  try{
   this.db.query("INSERT INTO accounts(id,username,pass_hash,created_at) VALUES (?,?,?,?)").run(id,(username as string).toLowerCase(),passHash,Date.now());
  }catch{return null;}
  return {id,token:this.issue(id)};
 }
 async login(username:unknown,password:unknown):Promise<{id:string;token:string}|null>{
  if(!validCredentials(username,password))return null;
  const row=this.db.query<AccountRow,[string]>("SELECT id,pass_hash FROM accounts WHERE username=? COLLATE NOCASE").get(username as string);
  if(!row||!(await Bun.password.verify(password as string,row.pass_hash)))return null;
  return {id:row.id,token:this.issue(row.id)};
 }
 issue(accountId:string):string{
  const token=randomBytes(32).toString("base64url");
  this.db.query("INSERT INTO account_sessions(token_hash,account_id,expires_at) VALUES (?,?,?)").run(digest(token),accountId,Date.now()+ACCOUNT_SESSION_DURATION_MS);
  return token;
 }
 resume(token:unknown):string|null{
  if(typeof token!=="string"||!/^[-\w]{40,80}$/.test(token))return null;
  const row=this.db.query<SessionRow,[string,number]>("SELECT account_id FROM account_sessions WHERE token_hash=? AND expires_at>?").get(digest(token),Date.now());
  return row?.account_id??null;
 }
 character(id:string):{id:string;name:string;x:number;z:number}|null{
  return this.db.query<{id:string;name:string;x:number;z:number},[string]>("SELECT id,name,x,z FROM characters WHERE account_id=?").get(id)??null;
 }
 linkCharacter(characterId:string,accountId:string):void{
  const result=this.db.query("UPDATE characters SET account_id=? WHERE id=? AND account_id IS NULL").run(accountId,characterId);
  if(result.changes!==1)throw Error("Character is already linked to an account");
 }
}
