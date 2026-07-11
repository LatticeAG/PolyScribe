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

    const result = suggestSemverFromSources(sources);
    expect(result.level).toBe("patch");
    expect(result.reasons.some((reason) => reason.includes("fix:"))).toBe(true);
  });

  it("suggests patch for chore and docs conventional commits", () => {
    const chore = suggestSemverFromSources([
      makeSource({ id: "commit:1", title: "chore: update dependencies" }),
    ]);
    const docs = suggestSemverFromSources([
      makeSource({ id: "commit:2", title: "docs: clarify setup steps" }),
    ]);

    expect(chore.level).toBe("patch");
    expect(chore.reasons.some((reason) => reason.includes("chore:"))).toBe(true);
    expect(docs.level).toBe("patch");
    expect(docs.reasons.some((reason) => reason.includes("docs:"))).toBe(true);
  });

  it("suggests minor for feature labels", () => {
    const sources = [
      makeSource({
        title: "Add webhook retries",
        labels: ["feat"],
      }),
    ];

    const result = suggestSemverFromSources(sources);
    expect(result.level).toBe("minor");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("suggests minor for conventional feat commits", () => {
    const sources = [
      makeSource({
        title: "feat(api): expose rate limit headers",
        labels: [],
      }),
    ];

    const result = suggestSemverFromSources(sources);
    expect(result.level).toBe("minor");
    expect(result.reasons.some((reason) => reason.includes("feat"))).toBe(true);
  });

  it("suggests major for breaking labels", () => {
    const sources = [
      makeSource({
        title: "Remove legacy auth endpoint",
        labels: ["breaking-change"],
      }),
    ];

    const result = suggestSemverFromSources(sources);
    expect(result.level).toBe("major");
    expect(result.reasons.some((reason) => reason.includes("breaking"))).toBe(true);
  });

  it("suggests major when BREAKING CHANGE appears in body", () => {
    const sources = [
      makeSource({
        title: "Refactor token validation",
        body: "BREAKING CHANGE: dropped support for v1 tokens",
        labels: ["enhancement"],
      }),
    ];

    const result = suggestSemverFromSources(sources);
    expect(result.level).toBe("major");
    expect(result.reasons.some((reason) => reason.includes("BREAKING CHANGE"))).toBe(true);
  });

  it("suggests major for feat! conventional commits", () => {
    const sources = [
      makeSource({
        title: "feat!: remove deprecated client",
        labels: ["feat"],
        body: "Adds new client while removing the old one.",
      }),
    ];

    const result = suggestSemverFromSources(sources);
    expect(result.level).toBe("major");
    expect(result.reasons.some((reason) => reason.includes("breaking commit"))).toBe(true);
  });

  it("prioritizes major over minor when both signals exist", () => {
    const sources = [
      makeSource({
        title: "feat!: remove deprecated client",
        labels: ["feat", "breaking"],
        body: "Adds new client while removing the old one.",
      }),
    ];

    const result = suggestSemverFromSources(sources);
    expect(result.level).toBe("major");
  });
});
