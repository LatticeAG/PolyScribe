import { describe, expect, it } from "vitest";
import { formatDateUtc } from "../src/util/format-date.js";
import { renderLineDiff } from "../src/util/line-diff.js";

describe("formatDateUtc", () => {
  it("returns today in UTC when no date is provided", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(formatDateUtc()).toBe(today);
  });

  it("accepts a valid YYYY-MM-DD override", () => {
    expect(formatDateUtc("2026-07-11")).toBe("2026-07-11");
  });

  it("rejects invalid date formats", () => {
    expect(() => formatDateUtc("07/11/2026")).toThrow(
      "Invalid date format: 07/11/2026. Expected YYYY-MM-DD",
    );
  });
});

describe("renderLineDiff", () => {
  it("marks added and removed lines", () => {
    const before = "## [Unreleased]\n";
    const after = "## [Unreleased]\n\n## [1.0.0] - 2026-07-11\n- Added feature\n";
    const diff = renderLineDiff(before, after);

    expect(diff).toContain("+## [1.0.0] - 2026-07-11");
    expect(diff).toContain("+- Added feature");
  });

  it("leaves unchanged lines unmarked", () => {
    const before = "# Changelog\n\n## [Unreleased]\n";
    const after = "# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-07-11\n";
    const diff = renderLineDiff(before, after);

    expect(diff).toContain("# Changelog");
    expect(diff).not.toContain("+# Changelog");
  });
});
