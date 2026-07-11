import { describe, expect, it } from "vitest";
import { applyIgnoreGlobs } from "../src/sources/index.js";

interface PathItem {
  path: string;
}

describe("applyIgnoreGlobs", () => {
  const items: PathItem[] = [
    { path: "src/index.ts" },
    { path: "dist/index.js" },
    { path: "packages/core/dist/bundle.js" },
    { path: "pnpm-lock.yaml" },
    { path: ".env.local" },
  ];

  const ignoreGlobs = [
    "**/dist/**",
    "**/pnpm-lock.yaml",
    "**/package-lock.json",
  ];

  it("filters paths matching minimatch globs", () => {
    const filtered = applyIgnoreGlobs(items, ignoreGlobs);

    expect(filtered).toEqual([
      { path: "src/index.ts" },
      { path: ".env.local" },
    ]);
  });

  it("returns all items when ignore list is empty", () => {
    expect(applyIgnoreGlobs(items, [])).toEqual(items);
  });

  it("matches nested dist directories", () => {
    const filtered = applyIgnoreGlobs(
      [{ path: "apps/web/dist/client/main.js" }],
      ["**/dist/**"],
    );

    expect(filtered).toEqual([]);
  });
});
