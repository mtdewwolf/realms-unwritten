import { createHash, randomBytes } from "node:crypto";
import type { Database } from "bun:sqlite";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,80}$/;

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class SessionStore {
  constructor(
    private readonly db: Database,
    private readonly ttlMs: number,
  ) {
    db.exec(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`);
  }

  issue(now = Date.now()): string {
    const token = randomBytes(32).toString("base64url");
    this.db.query("INSERT INTO sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)").run(
      digest(token),
      now,
      now + this.ttlMs,
    );
    return token;
  }

  valid(token: string, now = Date.now()): boolean {
    if (!TOKEN_PATTERN.test(token)) return false;
    const hash = digest(token);
    const row = this.db.query<{ expires_at: number }, [string]>(
      "SELECT expires_at FROM sessions WHERE token_hash = ?",
    ).get(hash);
    if (!row) return false;
    if (row.expires_at <= now) {
      this.db.query("DELETE FROM sessions WHERE token_hash = ?").run(hash);
      return false;
    }
    return true;
  }

  revoke(token: string): void {
    if (!TOKEN_PATTERN.test(token)) return;
    this.db.query("DELETE FROM sessions WHERE token_hash = ?").run(digest(token));
  }
}
