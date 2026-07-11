import { describe, expect, it } from "vitest";
import {
  getSectionTitle,
  renderDraftMarkdown,
  renderKeepAChangelogBody,
  sortSections,
} from "../src/draft/render.js";
import type { DraftSection } from "../src/types.js";

const sections: DraftSection[] = [
  {
    type: "fixes",
    title: "Fixes",
    content: "- Installations list no longer drops page 2 results (#131)",
    sourceIds: ["pr:131"],
  },
  {
    type: "summary",
    title: "Summary",
    content:
      "This release adds webhook retries and fixes a pagination bug in the installations API.",
    sourceIds: ["pr:128", "pr:131"],
  },
  {
    type: "features",
    title: "Features",
    content:
      "- **Webhook retries** — failed deliveries retry with exponential backoff (@alice, #128)",
    sourceIds: ["pr:128"],
  },
  {
    type: "credits",
    title: "Contributors",
    content: "Thanks to @alice, @bob, and @carol.",
    sourceIds: [],
  },
];

describe("renderDraftMarkdown", () => {
  it("renders non-empty sections in default order", () => {
    const markdown = renderDraftMarkdown(sections);

    expect(markdown).toMatch(/^## Summary/);
    expect(markdown.indexOf("## Summary")).toBeLessThan(
      markdown.indexOf("## Features"),
    );
    expect(markdown.indexOf("## Features")).toBeLessThan(
      markdown.indexOf("## Fixes"),
    );
    expect(markdown).toContain("## Contributors");
    expect(markdown).toContain("webhook retries");
  });

  it("omits empty sections", () => {
    const withEmpty: DraftSection[] = [
      ...sections,
      { type: "security", title: "Security", content: "  ", sourceIds: [] },
    ];

    expect(renderDraftMarkdown(withEmpty)).not.toContain("## Security");
  });
});

describe("renderKeepAChangelogBody", () => {
  it("maps sections to Keep a Changelog headings", () => {
    const body = renderKeepAChangelogBody(sections);

    expect(body).toContain("webhook retries");
    expect(body).toContain("### Added");
    expect(body).toContain("### Fixed");
    expect(body).not.toContain("## Contributors");
  });
});

describe("sortSections", () => {
  it("orders sections by configured priority", () => {
    const sorted = sortSections(sections);
    expect(sorted.map((s) => s.type)).toEqual([
      "summary",
      "features",
      "fixes",
      "credits",
    ]);
  });
});

describe("getSectionTitle", () => {
  it("returns human-readable titles", () => {
    expect(getSectionTitle("breaking")).toBe("Breaking Changes");
    expect(getSectionTitle("migration")).toBe("Migration Guide");
  });
});
