/**
 * Target art budgets are per asset LOD0, not a promise of runtime performance.
 * Asset IDs are durable game-data identifiers; keep them stable between releases.
 */
export type AssetCategory = "environment" | "building" | "character" | "creature" | "prop" | "vfx" | "ui";
export type AssetStage = "procedural" | "blockout" | "planned";
export interface AssetDefinition {
  id: string;
  category: AssetCategory;
  stage: AssetStage;
  lod0Triangles: number;
  textureMaxPx: number;
  variants: number;
  gameplayCollision: boolean;
}
export const assetCatalog: readonly AssetDefinition[] = [
  { id: "env/tree-pine-01", category: "environment", stage: "procedural", lod0Triangles: 500, textureMaxPx: 512, variants: 3, gameplayCollision: true },
  { id: "env/rock-cluster-01", category: "environment", stage: "procedural", lod0Triangles: 400, textureMaxPx: 512, variants: 3, gameplayCollision: true },
  { id: "prop/market-stall-01", category: "prop", stage: "procedural", lod0Triangles: 1000, textureMaxPx: 512, variants: 3, gameplayCollision: true },
  { id: "prop/campfire-01", category: "prop", stage: "procedural", lod0Triangles: 450, textureMaxPx: 256, variants: 1, gameplayCollision: true },
  { id: "prop/signpost-01", category: "prop", stage: "procedural", lod0Triangles: 250, textureMaxPx: 256, variants: 1, gameplayCollision: true },
  { id: "prop/flower-patch-01", category: "prop", stage: "procedural", lod0Triangles: 100, textureMaxPx: 256, variants: 4, gameplayCollision: false },
  { id: "building/cottage-01", category: "building", stage: "blockout", lod0Triangles: 3000, textureMaxPx: 1024, variants: 3, gameplayCollision: true },
  { id: "character/adventurer-01", category: "character", stage: "blockout", lod0Triangles: 7500, textureMaxPx: 1024, variants: 4, gameplayCollision: true },
  { id: "creature/wolf-01", category: "creature", stage: "blockout", lod0Triangles: 4500, textureMaxPx: 1024, variants: 2, gameplayCollision: true },
  { id: "vfx/sword-swipe-01", category: "vfx", stage: "planned", lod0Triangles: 120, textureMaxPx: 256, variants: 2, gameplayCollision: false },
  { id: "ui/ability-icons-01", category: "ui", stage: "planned", lod0Triangles: 0, textureMaxPx: 256, variants: 8, gameplayCollision: false },
] as const;
export function validateCatalog(items: readonly AssetDefinition[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const asset of items) {
    if (!/^[a-z]+\/[a-z0-9-]+$/.test(asset.id)) errors.push(`Invalid ID: ${asset.id}`);
    if (seen.has(asset.id)) errors.push(`Duplicate ID: ${asset.id}`);
    seen.add(asset.id);
    if (!Number.isInteger(asset.lod0Triangles) || asset.lod0Triangles < 0) errors.push(`Invalid triangle budget: ${asset.id}`);
    if (!Number.isInteger(asset.textureMaxPx) || asset.textureMaxPx < 1 || asset.textureMaxPx > 2048) errors.push(`Invalid texture budget: ${asset.id}`);
    if (!Number.isInteger(asset.variants) || asset.variants < 1) errors.push(`Invalid variant count: ${asset.id}`);
  }
  return errors;
}
