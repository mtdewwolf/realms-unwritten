import { createHash } from "node:crypto";
import { join } from "node:path";

export type WebAssets = {
  html: string;
  css: string;
  js: string;
};

let pending: Promise<WebAssets> | null = null;

export function loadAssets(): Promise<WebAssets> {
  pending ??= buildAssets();
  return pending;
}

async function buildAssets(): Promise<WebAssets> {
  const dir = join(import.meta.dir, "web");
  const built = await Bun.build({
    entrypoints: [join(dir, "main.ts")],
    target: "browser",
    format: "esm",
    minify: process.env.NODE_ENV === "production",
  });
  if (!built.success) {
    throw new Error(`Kanban frontend failed to bundle.\n${built.logs.map(log => String(log.message ?? log)).join("\n")}`);
  }
  const output = built.outputs.find(file => file.path.endsWith(".js")) ?? built.outputs[0];
  if (!output) throw new Error("Kanban frontend bundle produced no JavaScript.");
  const js = await output.text();
  const css = await Bun.file(join(dir, "styles.css")).text();
  const version = createHash("sha256").update(js).update(css).digest("hex").slice(0, 16);
  const html = (await Bun.file(join(dir, "index.html")).text()).replaceAll("__ASSET_VERSION__", version);
  return { html, css, js };
}
