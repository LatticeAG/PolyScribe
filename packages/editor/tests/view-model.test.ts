import { describe, expect, it } from "vitest";
import {
  REVIEW_EDITOR_REGIONS,
  createReviewEditorState,
  createReviewEditorView,
  reviewEditorStyles,
} from "../src/index.js";
import { createReviewDocument } from "./fixtures.js";

describe("review editor view model", () => {
  it("contains every document-first review region", () => {
    const state = createReviewEditorState(createReviewDocument());
    const view = createReviewEditorView(state);

    expect(view.regions).toEqual(REVIEW_EDITOR_REGIONS);
    expect(view.header.title).toBe("api 2.4.0");
    expect(view.header.range).toBe("v2.3.0 → v2.4.0");
    expect(view.activeEdition.audience).toBe("developer");
    expect(view.publishingTargets.map((target) => target.id)).toEqual([
      "github-release",
    ]);
  });

  it("exposes accessible default styles without motion-heavy transitions", () => {
    expect(reviewEditorStyles).toContain(":focus-visible");
    expect(reviewEditorStyles).toContain("prefers-reduced-motion: reduce");
    expect(reviewEditorStyles).not.toContain("transition: all");
  });
});
