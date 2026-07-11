import { describe, expect, it } from "vitest";
import {
  buildDraftPrompts,
  buildDraftSystemPrompt,
  buildDraftUserPrompt,
  formatSourceForPrompt,
} from "../src/draft/prompt.js";
import type { SourceItem } from "../src/types.js";

const sampleSources: SourceItem[] = [
  {
    id: "pr:128",
    type: "pr",
    prNumber: 128,
    title: "feat: add webhook retries",
    body: "Implements exponential backoff for failed webhook deliveries.",
    author: { login: "alice", id: "1" },
    labels: ["feat", "enhancement"],
    url: "https://github.com/acme/api/pull/128",
    linkedIssues: [{ number: 120, title: "Webhook failures" }],
  },
  {
    id: "commit:abc123def456",
    type: "commit",
    sha: "abc123def4567890",
    title: "fix: pagination off-by-one",
    author: { login: "bob", id: "2" },
    labels: ["fix"],
    url: "commit:abc123def4567890",
  },
];

describe("buildDraftSystemPrompt", () => {
  it("includes tone-specific guidance", () => {
    const technical = buildDraftSystemPrompt("technical");
    const community = buildDraftSystemPrompt("community");

    expect(technical).toContain("API-oriented");
    expect(community).toContain("credits-forward");
    expect(technical).toContain("sourceIds");
  });
});

describe("formatSourceForPrompt", () => {
  it("formats PR sources with metadata", () => {
    const formatted = formatSourceForPrompt(sampleSources[0]!);

    expect(formatted).toContain("id: pr:128");
    expect(formatted).toContain("pr: #128");
    expect(formatted).toContain("labels: feat, enhancement");
    expect(formatted).toContain("linked_issues: #120 Webhook failures");
  });
});

describe("buildDraftUserPrompt", () => {
  it("includes tone, heuristic semver, and all sources", () => {
    const prompt = buildDraftUserPrompt(
      sampleSources,
      "developer-friendly",
      "minor",
    );

    expect(prompt).toContain("Tone: developer-friendly");
    expect(prompt).toContain("Heuristic semver suggestion: minor");
    expect(prompt).toContain("Sources (2):");
    expect(prompt).toContain("id: pr:128");
    expect(prompt).toContain("id: commit:abc123def456");
  });

  it("handles empty sources", () => {
    const prompt = buildDraftUserPrompt([], "technical", "patch");
    expect(prompt).toContain("No sources in range.");
  });
});

describe("buildDraftPrompts", () => {
  it("returns paired system and user prompts", () => {
    const prompts = buildDraftPrompts(sampleSources, "executive", "minor");

    expect(prompts.system).toContain("outcome-focused");
    expect(prompts.user).toContain("Sources (2):");
  });
});
