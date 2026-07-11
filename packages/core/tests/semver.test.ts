import { describe, expect, it } from "vitest";
import { suggestSemverFromSources } from "../src/semver/index.js";
import type { SourceItem } from "../src/types.js";

function makeSource(overrides: Partial<SourceItem> & Pick<SourceItem, "title">): SourceItem {
  return {
    id: "pr:1",
    type: "pr",
    author: { login: "alice", id: "1" },
    labels: [],
    url: "https://example.com/pr/1",
    ...overrides,
  };
}

describe("suggestSemverFromSources", () => {
  it("suggests patch for routine fixes", () => {
    const sources = [
      makeSource({
        title: "fix: handle null pagination cursor",
        labels: ["fix", "bug"],
      }),
    ];

    expect(suggestSemverFromSources(sources)).toBe("patch");
  });

  it("suggests minor for feature labels", () => {
    const sources = [
      makeSource({
        title: "Add webhook retries",
        labels: ["feat"],
      }),
    ];

    expect(suggestSemverFromSources(sources)).toBe("minor");
  });

  it("suggests minor for conventional feat commits", () => {
    const sources = [
      makeSource({
        title: "feat(api): expose rate limit headers",
        labels: [],
      }),
    ];

    expect(suggestSemverFromSources(sources)).toBe("minor");
  });

  it("suggests major for breaking labels", () => {
    const sources = [
      makeSource({
        title: "Remove legacy auth endpoint",
        labels: ["breaking-change"],
      }),
    ];

    expect(suggestSemverFromSources(sources)).toBe("major");
  });

  it("suggests major when BREAKING CHANGE appears in body", () => {
    const sources = [
      makeSource({
        title: "Refactor token validation",
        body: "BREAKING CHANGE: dropped support for v1 tokens",
        labels: ["enhancement"],
      }),
    ];

    expect(suggestSemverFromSources(sources)).toBe("major");
  });

  it("prioritizes major over minor when both signals exist", () => {
    const sources = [
      makeSource({
        title: "feat!: remove deprecated client",
        labels: ["feat", "breaking"],
        body: "Adds new client while removing the old one.",
      }),
    ];

    expect(suggestSemverFromSources(sources)).toBe("major");
  });
});
