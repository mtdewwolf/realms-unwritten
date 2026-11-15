import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function openDatabase(dbPath: string): Database {
  if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath, { create: true });
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  if (dbPath !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  return db;
}

export function checkpointDatabase(db: Database, dbPath: string): void {
  if (dbPath === ":memory:") return;
  // Fold the WAL into the main file before close so a redeploy cannot lose the latest cards.
  db.query("PRAGMA wal_checkpoint(TRUNCATE)").get();
}
