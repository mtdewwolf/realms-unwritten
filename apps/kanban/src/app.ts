import { createHash, timingSafeEqual } from "node:crypto";
import type { Server } from "bun";
import { BoardError, BoardStore } from "./board";
import { checkpointDatabase, openDatabase } from "./db";
import {
  InputError,
  isRecord,
  parseColumnName,
  parseDescription,
  parseIndex,
  parsePriority,
  parseTags,
  parseTitle,
} from "./domain";
import type { WebAssets } from "./assets";
import { loadAssets } from "./assets";
import { SessionStore } from "./sessions";

const SESSION_COOKIE = "kanban_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 10;

export type KanbanOptions = {
  dbPath: string;
  password: string | null;
  port: number;
  hostname?: string;
  loginAttemptLimit?: number;
};

export type KanbanApp = {
  port: number;
  url: string;
  stop: () => void;
};

type Attempt = { count: number; resetAt: number };

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

function passwordMatches(provided: string, expected: string): boolean {
  const left = createHash("sha256").update(provided).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

function httpsRequest(req: Request): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]?.trim().toLowerCase() === "https";
  return new URL(req.url).protocol === "https:";
}

function cookieHeader(token: string, secure: boolean, maxAge: number): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...extra,
    },
  });
}

function text(body: string, contentType: string, cacheControl: string): Response {
  return new Response(body, {
    headers: {
      "content-type": contentType,
      "cache-control": cacheControl,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const hosts = new Set<string>();
  const host = req.headers.get("host");
  if (host) hosts.add(host);
  const forwarded = req.headers.get("x-forwarded-host");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) hosts.add(first);
  }
  hosts.add(new URL(req.url).host);
  return hosts.has(originHost);
}

async function readJson(req: Request): Promise<unknown> {
  const body = await req.text();
  if (body.length > 100_000) throw new InputError("Request is too large.");
  if (!body.trim()) throw new InputError("Expected a JSON body.");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new InputError("Expected a JSON body.");
  }
}

function clientIp(req: Request, server: Server<undefined>): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return server.requestIP(req)?.address ?? "local";
}

function routeId(pathname: string, pattern: RegExp): string | null {
  const match = pattern.exec(pathname);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export async function createKanbanApp(options: KanbanOptions): Promise<KanbanApp> {
  const db = openDatabase(options.dbPath);
  try {
    const board = new BoardStore(db);
    const sessions = new SessionStore(db, SESSION_TTL_MS);
    const assets = await loadAssets();
    const attempts = new Map<string, Attempt>();
    const limit = options.loginAttemptLimit ?? LOGIN_ATTEMPT_LIMIT;
    const server = Bun.serve({
      hostname: options.hostname ?? "0.0.0.0",
      port: options.port,
      fetch(req, bunServer) {
        return handle(req, bunServer, {
          board,
          sessions,
          assets,
          password: options.password,
          attempts,
          limit,
        });
      },
    });
    if (server.port === undefined) {
      void server.stop(true);
      throw new Error("Kanban server did not bind a port.");
    }
    const port = server.port;
    let stopped = false;
    return {
      port,
      url: `http://127.0.0.1:${port}`,
      stop() {
        if (stopped) return;
        stopped = true;
        void server.stop(true);
        checkpointDatabase(db, options.dbPath);
        db.close();
      },
    };
  } catch (error) {
    db.close();
    throw error;
  }
}

type Handler = {
  board: BoardStore;
  sessions: SessionStore;
  assets: WebAssets;
  password: string | null;
  attempts: Map<string, Attempt>;
  limit: number;
};

async function handle(req: Request, server: Server<undefined>, handler: Handler): Promise<Response> {
  const url = new URL(req.url);
  try {
    if (req.method === "GET" && url.pathname === "/health") return json({ ok: true });
    if (req.method === "GET" && url.pathname === "/") {
      return text(handler.assets.html, "text/html; charset=utf-8", "no-store");
    }
    if (req.method === "GET" && url.pathname === "/assets/app.css") {
      return text(handler.assets.css, "text/css; charset=utf-8", "public, max-age=31536000, immutable");
    }
    if (req.method === "GET" && url.pathname === "/assets/app.js") {
      return text(handler.assets.js, "text/javascript; charset=utf-8", "public, max-age=31536000, immutable");
    }
    if (!url.pathname.startsWith("/api/")) return json({ error: "Not found." }, 404);
    if (req.method !== "GET" && req.method !== "HEAD" && !originAllowed(req)) {
      return json({ error: "This request was rejected." }, 403);
    }
    if (req.method === "GET" && url.pathname === "/api/session") return sessionResponse(req, handler);
    if (req.method === "POST" && url.pathname === "/api/login") return await login(req, server, handler);
    if (req.method === "POST" && url.pathname === "/api/logout") return logout(req, handler);
    if (!authorized(req, handler)) return json({ error: "Sign in required." }, 401);
    return await api(req, url, handler);
  } catch (error) {
    if (error instanceof InputError) return json({ error: error.message }, 400);
    if (error instanceof BoardError) return json({ error: error.message }, error.status);
    console.error("[kanban] request failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Internal error." }, 500);
  }
}

function authorized(req: Request, handler: Handler): boolean {
  if (!handler.password) return true;
  const token = readCookie(req.headers.get("cookie"), SESSION_COOKIE);
  return token !== null && handler.sessions.valid(token);
}

function sessionResponse(req: Request, handler: Handler): Response {
  const required = handler.password !== null;
  const token = readCookie(req.headers.get("cookie"), SESSION_COOKIE);
  const authenticated = !required || (token !== null && handler.sessions.valid(token));
  return json({ required, authenticated });
}

function limited(attempts: Map<string, Attempt>, ip: string, limit: number, now: number): boolean {
  const row = attempts.get(ip);
  if (!row || row.resetAt <= now) return false;
  return row.count >= limit;
}

function recordFailure(attempts: Map<string, Attempt>, ip: string, now: number): void {
  const row = attempts.get(ip);
  if (!row || row.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  row.count += 1;
}

async function login(req: Request, server: Server<undefined>, handler: Handler): Promise<Response> {
  if (!handler.password) return json({ error: "Password login is disabled in this process." }, 400);
  const ip = clientIp(req, server);
  if (limited(handler.attempts, ip, handler.limit, Date.now())) {
    return json({ error: "Too many login attempts. Wait a few minutes and try again." }, 429);
  }
  const expected = handler.password;
  const body = await readJson(req);
  const password = isRecord(body) ? body.password : undefined;
  const matches = typeof password === "string"
    && password.length > 0
    && password.length <= 200
    && passwordMatches(password, expected);
  if (!matches) {
    recordFailure(handler.attempts, ip, Date.now());
    return json({ error: "Wrong password." }, 401);
  }
  handler.attempts.delete(ip);
  const token = handler.sessions.issue();
  return json({ ok: true }, 200, {
    "set-cookie": cookieHeader(token, httpsRequest(req), SESSION_TTL_MS / 1000),
  });
}

function logout(req: Request, handler: Handler): Response {
  const token = readCookie(req.headers.get("cookie"), SESSION_COOKIE);
  if (token) handler.sessions.revoke(token);
  return new Response(null, {
    status: 204,
    headers: {
      "set-cookie": cookieHeader("", httpsRequest(req), 0),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function api(req: Request, url: URL, handler: Handler): Promise<Response> {
  const { board } = handler;
  if (req.method === "GET" && url.pathname === "/api/board") {
    const query = url.searchParams.get("q") ?? "";
    const tag = url.searchParams.get("tag") ?? "";
    if (query.length > 200) throw new InputError("Search is too long.");
    const parsedTag = tag ? parseTags([tag])[0] ?? "" : "";
    return json(board.board(query, parsedTag));
  }

  if (req.method === "POST" && url.pathname === "/api/columns") {
    const body = await readJson(req);
    if (!isRecord(body)) throw new InputError("Expected a JSON object.");
    return json(board.addColumn(parseColumnName(body.name)), 201);
  }

  const columnId = routeId(url.pathname, /^\/api\/columns\/([^/]+)$/);
  if (columnId && req.method === "PATCH") {
    const body = await readJson(req);
    if (!isRecord(body)) throw new InputError("Expected a JSON object.");
    return json(board.renameColumn(columnId, parseColumnName(body.name)));
  }
  if (columnId && req.method === "DELETE") {
    board.deleteColumn(columnId);
    return new Response(null, { status: 204 });
  }

  if (req.method === "POST" && url.pathname === "/api/cards") {
    const body = await readJson(req);
    if (!isRecord(body) || typeof body.columnId !== "string") throw new InputError("Column is required.");
    return json(board.addCard({
      columnId: body.columnId,
      title: parseTitle(body.title),
      description: parseDescription(body.description),
      tags: parseTags(body.tags),
      priority: parsePriority(body.priority),
    }), 201);
  }

  const moveId = routeId(url.pathname, /^\/api\/cards\/([^/]+)\/move$/);
  if (moveId && req.method === "POST") {
    const body = await readJson(req);
    if (!isRecord(body) || typeof body.columnId !== "string") throw new InputError("Column is required.");
    return json(board.moveCard(moveId, body.columnId, parseIndex(body.index)));
  }

  const cardId = routeId(url.pathname, /^\/api\/cards\/([^/]+)$/);
  if (cardId && req.method === "PATCH") {
    const body = await readJson(req);
    if (!isRecord(body)) throw new InputError("Expected a JSON object.");
    return json(board.updateCard(cardId, {
      ...(body.title !== undefined ? { title: parseTitle(body.title) } : {}),
      ...(body.description !== undefined ? { description: parseDescription(body.description) } : {}),
      ...(body.tags !== undefined ? { tags: parseTags(body.tags) } : {}),
      ...(body.priority !== undefined ? { priority: parsePriority(body.priority) } : {}),
    }));
  }
  if (cardId && req.method === "DELETE") {
    board.deleteCard(cardId);
    return new Response(null, { status: 204 });
  }

  return json({ error: "Not found." }, 404);
}
