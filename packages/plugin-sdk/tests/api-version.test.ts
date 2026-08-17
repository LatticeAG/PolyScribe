import { describe, expect, it } from "vitest";
import {
  compareApiVersions,
  negotiateApiVersion,
  parseApiVersion,
} from "../src/api-version.js";

describe("plugin API version negotiation", () => {
  it("selects the highest host version in the plugin range", () => {
    expect(
      negotiateApiVersion(["1.0", "1.1", "2.0"], {
        minimum: "1.0",
        maximum: "1.1",
      }),
    ).toEqual({ compatible: true, selected: "1.1" });
  });

  it("fails closed when no version overlaps", () => {
    const result = negotiateApiVersion(["1.0"], { minimum: "2.0" });
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain("No host API version");
  });

  it("parses and compares numeric protocol versions", () => {
    expect(parseApiVersion("01.0")).toBeUndefined();
    expect(compareApiVersions("1.10", "1.2")).toBeGreaterThan(0);
  });
});
