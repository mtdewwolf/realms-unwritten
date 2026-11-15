# Realms Unwritten ideas board

Private kanban for organizing game ideas. This is a separate Bun service from the realm server (`@realms/server`). It is not part of the game client.

Columns start as **Ideas**, **Planned**, **In Progress**, and **Done**. Names can be changed and new columns can be added. Cards have a title, markdown notes, tags, priority, and created/updated times. Drag cards on a wide screen, or use **Move** on a phone.

## Local

From the repository root:

```bash
bun install
bun run dev:kanban
```

Open http://localhost:3002.

Set a shared password before anyone else can reach the process:

```bash
KANBAN_PASSWORD='a long shared password' bun run dev:kanban
```

The database defaults to `./data/kanban.sqlite` relative to `apps/kanban` (the working directory of `bun src/index.ts`). Override it with `KANBAN_DB_PATH`.

If `KANBAN_PASSWORD` is unset and `NODE_ENV` is not `production`, the process starts with the board open and prints a warning. If `NODE_ENV=production` and the password is unset, the process exits.

## Railway

Add a **new service in the same project** as the realm server, from this repository. Do not replace `@realms/server`.

1. Root directory: `apps/kanban`.
2. Builder: Railpack. `apps/kanban/railway.json` selects it.
3. Install step (Railpack default, no compile step): `bun install --frozen-lockfile`. The package has no npm dependencies. There is no `build` script; the browser bundle is produced when the process starts.
4. Start command: `bun src/index.ts` (also the `start` script). `railway.json` sets this explicitly.
5. Health check: `GET /health` → `{"ok":true}`.
6. One replica. The config sets `numReplicas` to 1, no overlap with the previous deploy, and a 15 second SIGTERM drain. SQLite is a single file.
7. Mount a volume at `/data`. `railway.json` requires that path. Use a different volume from the realm server's world database.
8. Variables:
   - `KANBAN_DB_PATH=/data/kanban.sqlite`
   - `KANBAN_PASSWORD` — the shared board password
   - Leave `NODE_ENV=production` (Railpack sets this). Do not set `PORT`.

A redeploy sends SIGTERM. The process checkpoints the SQLite WAL into the main database file and closes it before exiting.

The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` when the request arrives over HTTPS (`X-Forwarded-Proto: https` behind Railway).
