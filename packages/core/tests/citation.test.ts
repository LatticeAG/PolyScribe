import { describe, expect, it } from "vitest";
import {
  CitationValidationError,
  validateSectionCitations,
} from "../src/draft/generate.js";
import type { DraftSection } from "../src/types.js";

function makeSection(
  overrides: Partial<DraftSection> & Pick<DraftSection, "type">,
): DraftSection {
  return {
    title: overrides.type,
    content: "",
    sourceIds: [],
    ...overrides,
  };
}

describe("validateSectionCitations", () => {
  const sourceIds = new Set(["pr:1", "commit:abc"]);

  it("passes for valid sections with known sourceIds", () => {
    const sections: DraftSection[] = [
      makeSection({
        type: "features",
        content: "- Added webhook retries",
        sourceIds: ["pr:1"],
      }),
      makeSection({
        type: "fixes",
        content: "- Fixed pagination (#42)",
        sourceIds: ["commit:abc"],
      }),
    ];

    expect(validateSectionCitations(sections, sourceIds)).toEqual([]);
  });

  it("fails for unknown sourceId", () => {
    const sections: DraftSection[] = [
      makeSection({
        type: "features",
        content: "- Added webhook retries",
        sourceIds: ["pr:1", "pr:999"],
      }),
    ];

    const invalid = validateSectionCitations(sections, sourceIds);

    expect(invalid).toEqual([
      {
        type: "features",
        reason: "unknown sourceId: pr:999",
      },
    ]);
  });

  it("allows empty credits section without sourceIds", () => {
    const sections: DraftSection[] = [
      makeSection({
        type: "credits",
        content: "",
        sourceIds: [],
      }),
    ];

    expect(validateSectionCitations(sections, sourceIds)).toEqual([]);
  });
});

describe("CitationValidationError", () => {
  it("exposes invalid section details", () => {
    const invalid = [{ type: "features", reason: "unknown sourceId: pr:999" }];
    const error = new CitationValidationError(
      "Draft failed citation validation (1 issue(s))",
      invalid,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("CitationValidationError");
    expect(error.message).toContain("citation validation");
    expect(error.invalidSections).toEqual(invalid);
  });
});
