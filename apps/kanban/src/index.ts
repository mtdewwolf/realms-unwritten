import { createKanbanApp, type KanbanApp } from "./app";
import { resolveConfig } from "./config";

const config = resolveConfig(process.env);
if (!config.ok) {
  console.error(config.message);
  process.exit(1);
}
if (config.warning) console.warn(config.warning);

const app: KanbanApp = await createKanbanApp({
  dbPath: config.dbPath,
  password: config.password,
  port: config.port,
});
console.log(`[kanban] listening on ${app.url} (bound 0.0.0.0:${app.port})`);

let stopping = false;
const shutdown = () => {
  if (stopping) return;
  stopping = true;
  console.log("[kanban] shutting down");
  try {
    app.stop();
  } finally {
    process.exit(0);
  }
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
