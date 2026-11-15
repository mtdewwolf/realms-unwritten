import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createKanbanApp, type KanbanApp } from "../apps/kanban/src/app";
import { resolveConfig } from "../apps/kanban/src/config";
import { renderMarkdown } from "../apps/kanban/src/web/markdown";
import type { Board, Card, Column } from "../apps/kanban/src/domain";

const PASSWORD = "test-password-123";

async function withApp(
  password: string | null,
  run: (app: KanbanApp) => Promise<void>,
  extra: { dbPath?: string; loginAttemptLimit?: number } = {},
): Promise<void> {
  const app = await createKanbanApp({
    dbPath: extra.dbPath ?? ":memory:",
    password,
    port: 0,
    ...(extra.loginAttemptLimit ? { loginAttemptLimit: extra.loginAttemptLimit } : {}),
  });
  try {
    await run(app);
  } finally {
    app.stop();
  }
}

async function login(app: KanbanApp, password = PASSWORD, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${app.url}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ password }),
  });
}

function cookieFrom(response: Response): string {
  const header = response.headers.get("set-cookie");
  const match = header ? /kanban_session=([^;]+)/.exec(header) : null;
  if (!header || !match?.[1]) throw new Error(`expected a session cookie, got ${header}`);
  return `kanban_session=${match[1]}`;
}

async function authed(app: KanbanApp): Promise<string> {
  const response = await login(app);
  expect(response.status).toBe(200);
  return cookieFrom(response);
}

async function board(app: KanbanApp, cookie: string, query = ""): Promise<Board> {
  const response = await fetch(`${app.url}/api/board${query}`, { headers: { cookie } });
  expect(response.status).toBe(200);
  return response.json() as Promise<Board>;
}

function columnNamed(snapshot: Board, name: string): Column {
  const column = snapshot.columns.find(item => item.name === name);
  if (!column) throw new Error(`missing column ${name}`);
  return column;
}

function titlesIn(snapshot: Board, columnId: string): string[] {
  return snapshot.cards.filter(card => card.columnId === columnId).sort((a, b) => a.position - b.position).map(card => card.title);
}

describe("kanban configuration", () => {
  test("requires a password in production and warns when local access is open", () => {
    const refused = resolveConfig({ NODE_ENV: "production" });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toContain("KANBAN_PASSWORD");
    const open = resolveConfig({});
    expect(open.ok).toBe(true);
    if (open.ok) {
      expect(open.password).toBeNull();
      expect(open.warning).toContain("WARNING");
      expect(open.warning).toContain("OPEN");
      expect(open.dbPath).toBe("./data/kanban.sqlite");
      expect(open.port).toBe(3002);
    }
    const hosted = resolveConfig({
      NODE_ENV: "production",
      KANBAN_PASSWORD: PASSWORD,
      PORT: "8080",
      KANBAN_DB_PATH: "/data/kanban.sqlite",
    });
    expect(hosted.ok).toBe(true);
    if (hosted.ok) {
      expect(hosted.password).toBe(PASSWORD);
      expect(hosted.warning).toBeNull();
      expect(hosted.port).toBe(8080);
      expect(hosted.dbPath).toBe("/data/kanban.sqlite");
    }
    expect(resolveConfig({ PORT: "nope" }).ok).toBe(false);
  });
});

describe("kanban api", () => {
  test("health and the login page stay public while the board requires a session", async () => {
    await withApp(PASSWORD, async app => {
      const health = await fetch(`${app.url}/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toEqual({ ok: true });
      const page = await fetch(`${app.url}/`);
      expect(page.status).toBe(200);
      const html = await page.text();
      expect(html).toContain("Realms Unwritten");
      expect(html).toContain("/assets/app.js?v=");
      expect(html).toContain("/assets/app.css?v=");
      expect((await fetch(`${app.url}/assets/app.js`)).status).toBe(200);
      expect((await fetch(`${app.url}/assets/app.js`)).headers.get("content-type")).toContain("javascript");
      expect(await (await fetch(`${app.url}/assets/app.css`)).text()).toContain("--gold");
      expect((await fetch(`${app.url}/api/board`)).status).toBe(401);
      const session = await fetch(`${app.url}/api/session`);
      expect(await session.json()).toEqual({ required: true, authenticated: false });
    });
  });

  test("login sets an httpOnly cookie, and https requests mark it Secure", async () => {
    await withApp(PASSWORD, async app => {
      const wrong = await login(app, "not-the-password");
      expect(wrong.status).toBe(401);
      expect(wrong.headers.get("set-cookie")).toBeNull();
      const secure = await login(app, PASSWORD, { "x-forwarded-proto": "https" });
      const secureCookie = secure.headers.get("set-cookie") ?? "";
      expect(secureCookie).toContain("HttpOnly");
      expect(secureCookie).toContain("SameSite=Lax");
      expect(secureCookie).toContain("Secure");
      expect(secureCookie).not.toContain(PASSWORD);
      const plain = await login(app);
      const plainCookie = plain.headers.get("set-cookie") ?? "";
      expect(plainCookie).toContain("HttpOnly");
      expect(plainCookie).not.toContain("Secure");
      const cookie = cookieFrom(plain);
      expect((await fetch(`${app.url}/api/board`, { headers: { cookie } })).status).toBe(200);
      expect((await fetch(`${app.url}/api/session`, { headers: { cookie } })).status).toBe(200);
      const rejected = await fetch(`${app.url}/api/login`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.example" },
        body: JSON.stringify({ password: PASSWORD }),
      });
      expect(rejected.status).toBe(403);
      const logout = await fetch(`${app.url}/api/logout`, { method: "POST", headers: { cookie } });
      expect(logout.status).toBe(204);
      expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
      expect((await fetch(`${app.url}/api/board`, { headers: { cookie } })).status).toBe(401);
    });
  });

  test("locks out repeated failed logins", async () => {
    await withApp(PASSWORD, async app => {
      expect((await login(app, "nope", { "x-forwarded-for": "203.0.113.9" })).status).toBe(401);
      expect((await login(app, "nope", { "x-forwarded-for": "203.0.113.9" })).status).toBe(401);
      const locked = await login(app, PASSWORD, { "x-forwarded-for": "203.0.113.9" });
      expect(locked.status).toBe(429);
      expect((await login(app, PASSWORD, { "x-forwarded-for": "203.0.113.10" })).status).toBe(200);
    }, { loginAttemptLimit: 2 });
  });

  test("creates, edits, filters, and deletes ideas", async () => {
    await withApp(PASSWORD, async app => {
      const cookie = await authed(app);
      const initial = await board(app, cookie);
      expect(initial.columns.map(column => column.name)).toEqual(["Ideas", "Planned", "In Progress", "Done"]);
      const ideas = columnNamed(initial, "Ideas");
      const created = await fetch(`${app.url}/api/cards`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          columnId: ideas.id,
          title: "  Wolf hunt follow-up  ",
          description: "Track **three** wolves\n- pelt\n- fang",
          tags: ["Combat", "combat", "quests"],
          priority: "high",
        }),
      });
      expect(created.status).toBe(201);
      const card = await created.json() as Card;
      expect(card.title).toBe("Wolf hunt follow-up");
      expect(card.tags).toEqual(["combat", "quests"]);
      expect(card.priority).toBe("high");
      expect(card.description).toContain("**three**");
      expect(card.createdAt).toBe(card.updatedAt);
      const renamed = await fetch(`${app.url}/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ title: "Wolf hunt notes", priority: "low", tags: ["world"] }),
      });
      expect(renamed.status).toBe(200);
      const edited = await renamed.json() as Card;
      expect(edited.title).toBe("Wolf hunt notes");
      expect(edited.priority).toBe("low");
      expect(edited.tags).toEqual(["world"]);
      expect(edited.createdAt).toBe(card.createdAt);
      expect(edited.updatedAt).toBeGreaterThan(card.updatedAt);
      const other = await fetch(`${app.url}/api/cards`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ columnId: ideas.id, title: "Cottage roofs", tags: ["art"], priority: "medium" }),
      });
      expect(other.status).toBe(201);
      const combat = await board(app, cookie, "?tag=world");
      expect(combat.cards.map(item => item.title)).toEqual(["Wolf hunt notes"]);
      expect(combat.columns).toHaveLength(4);
      const search = await board(app, cookie, "?q=cottage&tag=art");
      expect(search.cards.map(item => item.title)).toEqual(["Cottage roofs"]);
      expect((await board(app, cookie, "?q=missing")).cards).toHaveLength(0);
      const invalid = await fetch(`${app.url}/api/cards`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ columnId: ideas.id, title: "   ", priority: "urgent" }),
      });
      expect(invalid.status).toBe(400);
      const removed = await fetch(`${app.url}/api/cards/${card.id}`, { method: "DELETE", headers: { cookie } });
      expect(removed.status).toBe(204);
      expect((await fetch(`${app.url}/api/cards/${card.id}`, { method: "DELETE", headers: { cookie } })).status).toBe(404);
    });
  });

  test("reorders inside a column and moves across columns", async () => {
    await withApp(PASSWORD, async app => {
      const cookie = await authed(app);
      const initial = await board(app, cookie);
      const ideas = columnNamed(initial, "Ideas");
      const planned = columnNamed(initial, "Planned");
      for (const title of ["Alpha", "Bravo", "Charlie"]) {
        const response = await fetch(`${app.url}/api/cards`, {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ columnId: ideas.id, title }),
        });
        expect(response.status).toBe(201);
      }
      const created = await board(app, cookie);
      expect(titlesIn(created, ideas.id)).toEqual(["Alpha", "Bravo", "Charlie"]);
      const charlie = created.cards.find(card => card.title === "Charlie");
      const alpha = created.cards.find(card => card.title === "Alpha");
      const bravo = created.cards.find(card => card.title === "Bravo");
      if (!charlie || !alpha || !bravo) throw new Error("missing cards");
      expect((await fetch(`${app.url}/api/cards/${charlie.id}/move`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ columnId: ideas.id, index: 0 }),
      })).status).toBe(200);
      expect(titlesIn(await board(app, cookie), ideas.id)).toEqual(["Charlie", "Alpha", "Bravo"]);
      expect((await fetch(`${app.url}/api/cards/${alpha.id}/move`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ columnId: ideas.id, index: 2 }),
      })).status).toBe(200);
      expect(titlesIn(await board(app, cookie), ideas.id)).toEqual(["Charlie", "Bravo", "Alpha"]);
      expect((await fetch(`${app.url}/api/cards/${alpha.id}/move`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ columnId: planned.id, index: 0 }),
      })).status).toBe(200);
      expect((await fetch(`${app.url}/api/cards/${bravo.id}/move`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ columnId: planned.id, index: 1 }),
      })).status).toBe(200);
      const moved = await board(app, cookie);
      expect(titlesIn(moved, ideas.id)).toEqual(["Charlie"]);
      const plannedCards = moved.cards.filter(card => card.columnId === planned.id).sort((a, b) => a.position - b.position);
      expect(plannedCards.map(card => card.title)).toEqual(["Alpha", "Bravo"]);
      expect(plannedCards.map(card => card.position)).toEqual([0, 1]);
      expect((await fetch(`${app.url}/api/cards/${alpha.id}/move`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ columnId: "missing", index: 0 }),
      })).status).toBe(404);
      expect((await fetch(`${app.url}/api/cards/${alpha.id}/move`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ columnId: planned.id, index: -1 }),
      })).status).toBe(400);
    });
  });

  test("adds, renames, and deletes columns without losing ideas", async () => {
    await withApp(PASSWORD, async app => {
      const cookie = await authed(app);
      const added = await fetch(`${app.url}/api/columns`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "  Later  " }),
      });
      expect(added.status).toBe(201);
      const later = await added.json() as Column;
      expect(later.name).toBe("Later");
      const ideas = columnNamed(await board(app, cookie), "Ideas");
      const renamed = await fetch(`${app.url}/api/columns/${ideas.id}`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "Sparks" }),
      });
      expect(renamed.status).toBe(200);
      const card = await fetch(`${app.url}/api/cards`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ columnId: ideas.id, title: "Keep me" }),
      });
      expect(card.status).toBe(201);
      const blocked = await fetch(`${app.url}/api/columns/${ideas.id}`, { method: "DELETE", headers: { cookie } });
      expect(blocked.status).toBe(409);
      const planned = columnNamed(await board(app, cookie), "Planned");
      expect((await fetch(`${app.url}/api/columns/${planned.id}`, { method: "DELETE", headers: { cookie } })).status).toBe(204);
      const after = await board(app, cookie);
      expect(after.columns.map(column => column.name)).toEqual(["Sparks", "In Progress", "Done", "Later"]);
      expect(new Set(after.columns.map(column => column.position)).size).toBe(after.columns.length);
      expect(after.cards.map(item => item.title)).toEqual(["Keep me"]);
    });
  });

  test("open access skips the password and a restarted file database keeps cards", async () => {
    await withApp(null, async app => {
      expect((await fetch(`${app.url}/api/board`)).status).toBe(200);
      expect(await (await fetch(`${app.url}/api/session`)).json()).toEqual({ required: false, authenticated: true });
      expect((await login(app)).status).toBe(400);
    });
    const dir = mkdtempSync(join(tmpdir(), "kanban-file-"));
    const dbPath = join(dir, "nested", "kanban.sqlite");
    try {
      const first = await createKanbanApp({ dbPath, password: PASSWORD, port: 0 });
      const cookie = await authed(first);
      const ideas = columnNamed(await board(first, cookie), "Ideas");
      expect((await fetch(`${first.url}/api/cards`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ columnId: ideas.id, title: "Survives restart" }),
      })).status).toBe(201);
      first.stop();
      const second = await createKanbanApp({ dbPath, password: PASSWORD, port: 0 });
      const again = await authed(second);
      const restored = await board(second, again);
      expect(restored.cards.map(card => card.title)).toEqual(["Survives restart"]);
      second.stop();
      const db = new Database(dbPath, { readonly: true });
      const cards = JSON.stringify(db.query("SELECT title FROM cards").all());
      const sessions = JSON.stringify(db.query("SELECT token_hash FROM sessions").all());
      const schema = JSON.stringify(db.query("SELECT sql FROM sqlite_master").all());
      db.close();
      expect(cards).toContain("Survives restart");
      expect(sessions).not.toContain(PASSWORD);
      expect(schema).not.toContain("pass_hash");
      expect(schema).not.toContain(PASSWORD);
      expect(existsSync(dbPath)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("kanban markdown", () => {
  test("renders a small safe subset", () => {
    expect(renderMarkdown("**bold** and *italic*")).toContain("<strong>bold</strong>");
    expect(renderMarkdown("**bold** and *italic*")).toContain("<em>italic</em>");
    expect(renderMarkdown("- pelt\n- fang")).toContain("<li>pelt</li>");
    const link = renderMarkdown("[notes](https://example.com?a=1&b=2)");
    expect(link).toContain("https://example.com/?a=1&amp;b=2");
    expect(renderMarkdown("<script>alert(1)</script>")).not.toContain("<script>");
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain("javascript:");
    expect(renderMarkdown("`**<b>`")).toContain("&lt;b&gt;");
  });
});

describe("kanban process", () => {
  const repo = join(import.meta.dir, "..");

  function spawnEnv(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.KANBAN_PASSWORD;
    delete env.KANBAN_DB_PATH;
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    return env;
  }

  function collect(stream: ReadableStream<Uint8Array>, into: string[]): Promise<void> {
    return (async () => {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        into.push(decoder.decode(chunk.value));
      }
    })();
  }

  async function waitForHealth(port: number, proc: ReturnType<typeof Bun.spawn>, logs: string[]): Promise<void> {
    for (let n = 0; n < 120 && proc.exitCode === null; n++) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return;
      } catch { /* booting */ }
      await Bun.sleep(50);
    }
    throw new Error(`health timed out\n${logs.join("")}`);
  }

  test("refuses to start in production without a password", async () => {
    const logs: string[] = [];
    const proc = Bun.spawn(["bun", "src/index.ts"], {
      cwd: join(repo, "apps/kanban"),
      env: spawnEnv({ NODE_ENV: "production", PORT: "3999" }),
      stdout: "pipe",
      stderr: "pipe",
    });
    const drained = Promise.all([collect(proc.stdout, logs), collect(proc.stderr, logs)]);
    const code = await Promise.race([proc.exited, Bun.sleep(8000).then(() => null)]);
    if (code === null) proc.kill();
    await proc.exited;
    await drained;
    expect(code).toBe(1);
    expect(logs.join("")).toContain("KANBAN_PASSWORD");
  });

  test("local open access logs a warning and binds all interfaces", async () => {
    const port = 33000 + Math.floor(Math.random() * 20000);
    const logs: string[] = [];
    const proc = Bun.spawn(["bun", "src/index.ts"], {
      cwd: join(repo, "apps/kanban"),
      env: spawnEnv({ NODE_ENV: "development", PORT: String(port), KANBAN_DB_PATH: ":memory:" }),
      stdout: "pipe",
      stderr: "pipe",
    });
    collect(proc.stdout, logs);
    collect(proc.stderr, logs);
    try {
      await waitForHealth(port, proc, logs);
      expect((await fetch(`http://127.0.0.1:${port}/api/board`)).status).toBe(200);
      const text = logs.join("");
      expect(text).toContain("WARNING");
      expect(text).toContain("0.0.0.0");
    } finally {
      if (proc.exitCode === null) proc.kill();
      await proc.exited;
    }
  });

  test("checkpoints sqlite on SIGTERM", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kanban-shutdown-"));
    const dbPath = join(dir, "missing", "kanban.sqlite");
    const port = 34000 + Math.floor(Math.random() * 20000);
    const logs: string[] = [];
    const proc = Bun.spawn(["bun", "src/index.ts"], {
      cwd: join(repo, "apps/kanban"),
      env: spawnEnv({
        NODE_ENV: "production",
        PORT: String(port),
        KANBAN_PASSWORD: PASSWORD,
        KANBAN_DB_PATH: dbPath,
      }),
      stdout: "pipe",
      stderr: "pipe",
    });
    collect(proc.stdout, logs);
    collect(proc.stderr, logs);
    try {
      await waitForHealth(port, proc, logs);
      expect(existsSync(dbPath)).toBe(true);
      const signedIn = await fetch(`http://127.0.0.1:${port}/api/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: PASSWORD }),
      });
      const cookie = cookieFrom(signedIn);
      const snapshot = await (await fetch(`http://127.0.0.1:${port}/api/board`, { headers: { cookie } })).json() as Board;
      const ideas = columnNamed(snapshot, "Ideas");
      const created = await fetch(`http://127.0.0.1:${port}/api/cards`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ columnId: ideas.id, title: "Persisted idea" }),
      });
      expect(created.status).toBe(201);
      proc.kill("SIGTERM");
      expect(await proc.exited).toBe(0);
      for (const suffix of ["-wal", "-shm"]) if (existsSync(dbPath + suffix)) unlinkSync(dbPath + suffix);
      const db = new Database(dbPath, { readonly: true });
      const integrity = db.query<{ integrity_check: string }, []>("PRAGMA integrity_check").get();
      const row = db.query<{ title: string }, []>("SELECT title FROM cards").get();
      db.close();
      expect(integrity?.integrity_check).toBe("ok");
      expect(row?.title).toBe("Persisted idea");
    } catch (error) {
      console.error(logs.join(""));
      throw error;
    } finally {
      if (proc.exitCode === null) proc.kill();
      await proc.exited;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
