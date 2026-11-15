export const OPEN_ACCESS_WARNING = [
  "================================================================",
  "[kanban] WARNING: KANBAN_PASSWORD is not set.",
  "[kanban] The ideas board is OPEN to anyone who can reach this process.",
  "[kanban] Open access is only for local development.",
  "[kanban] Set KANBAN_PASSWORD before sharing the server.",
  "================================================================",
].join("\n");

export type KanbanConfig =
  | { ok: false; message: string }
  | {
      ok: true;
      warning: string | null;
      dbPath: string;
      password: string | null;
      port: number;
    };

export function resolveConfig(env: NodeJS.ProcessEnv): KanbanConfig {
  const password = env.KANBAN_PASSWORD && env.KANBAN_PASSWORD.length > 0 ? env.KANBAN_PASSWORD : null;
  if (env.NODE_ENV === "production" && !password) {
    return {
      ok: false,
      message: "[kanban] Refusing to start: KANBAN_PASSWORD must be set when NODE_ENV=production.",
    };
  }
  const rawPort = env.PORT;
  const port = rawPort === undefined || rawPort === "" ? 3002 : Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, message: "[kanban] PORT must be an integer from 1 to 65535." };
  }
  const dbPath = env.KANBAN_DB_PATH && env.KANBAN_DB_PATH.trim().length > 0
    ? env.KANBAN_DB_PATH.trim()
    : "./data/kanban.sqlite";
  return {
    ok: true,
    warning: password ? null : OPEN_ACCESS_WARNING,
    dbPath,
    password,
    port,
  };
}
