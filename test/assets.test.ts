import { describe, expect, test } from "bun:test";
import { assetCatalog, validateCatalog } from "../apps/client/src/assets/catalog";

describe("Android asset catalog", () => {
  test("has unique, valid stable IDs and device budgets", () => {
    expect(validateCatalog(assetCatalog)).toEqual([]);
  });
  test("rejects duplicate IDs and invalid budgets", () => {
    const first = assetCatalog[0];
    expect(validateCatalog([first, {...first, textureMaxPx: 4096}]).length).toBeGreaterThanOrEqual(2);
  });
  test("covers playable art priorities", () => {
    for (const category of ["character", "creature", "building", "environment", "ui"]) {
      expect(assetCatalog.some(asset => asset.category === category)).toBe(true);
    }
  });
});
