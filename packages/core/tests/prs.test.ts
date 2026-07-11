import { describe, expect, it } from "vitest";
import { mapPrToSourceItem, parseLinkedIssues } from "../src/github/prs.js";

describe("parseLinkedIssues", () => {
  it("parses Fixes #123 from PR body", () => {
    const issues = parseLinkedIssues("This PR fixes a bug.\n\nFixes #123");

    expect(issues).toEqual([{ number: 123, title: "Issue #123" }]);
  });

  it("parses multiple closing keywords", () => {
    const issues = parseLinkedIssues("Fixes #10\nCloses #20\nResolves #30");

    expect(issues.map((issue) => issue.number)).toEqual([10, 20, 30]);
  });

  it("deduplicates repeated issue references", () => {
    const issues = parseLinkedIssues("Fixes #42\nAlso fixes #42");

    expect(issues).toEqual([{ number: 42, title: "Issue #42" }]);
  });
});

describe("mapPrToSourceItem", () => {
  it("includes linkedIssues parsed from body", () => {
    const item = mapPrToSourceItem({
      number: 55,
      title: "fix: handle retries",
      body: "Fixes #123 and closes #456",
      user: { login: "alice", id: 1 },
      merged_at: "2026-01-01T00:00:00Z",
      labels: [{ name: "fix" }],
    });

    expect(item.linkedIssues).toEqual([
      { number: 123, title: "Issue #123" },
      { number: 456, title: "Issue #456" },
    ]);
  });
});
