import { describe, expect, it, vi } from "vitest";
import {
  createReviewEditorController,
  createReviewEditorState,
  reduceReviewEditorState,
} from "../src/index.js";
import { createReviewDocument } from "./fixtures.js";

describe("review editor state", () => {
  it("defaults to the developer edition and keeps edits immutable", () => {
    const document = createReviewDocument();
    const initial = createReviewEditorState(document);
    const state = reduceReviewEditorState(initial, {
      type: "replace-active-block",
      blockId: "block_added",
      markdown: "- Adds configurable retries with clearer diagnostics.",
    });

    expect(initial.activeAudience).toBe("developer");
    expect(initial.document.editions[0]?.blocks[0]?.markdown).toBe(
      "- Adds configurable webhook retries.",
    );
    expect(state.document.editions[0]?.blocks[0]?.markdown).toBe(
      "- Adds configurable retries with clearer diagnostics.",
    );
    expect(state.notice).toContain("Local wording changed");
  });

  it("does not select an audience that is absent from the document", () => {
    const initial = createReviewEditorState(createReviewDocument());
    const state = reduceReviewEditorState(initial, {
      type: "select-audience",
      audience: "partner",
    });

    expect(state).toBe(initial);
  });
});

describe("review editor controller", () => {
  it("saves the active edition against its current document revision", async () => {
    const document = createReviewDocument();
    const saveEdition = vi.fn(async () => ({
      kind: "saved" as const,
      document: {
        ...document,
        revisionId: "rev_02",
        editions: document.editions.map((edition) =>
          edition.id === "ed_developer"
            ? { ...edition, revisionId: "ed_rev_02" }
            : edition,
        ),
      },
    }));
    const controller = createReviewEditorController(document, {
      persistence: { saveEdition },
    });
    controller.dispatch({
      type: "replace-active-block",
      blockId: "block_added",
      markdown: "- Adds retry diagnostics.",
    });

    await expect(controller.saveActiveEdition()).resolves.toEqual({ kind: "saved" });
    expect(saveEdition).toHaveBeenCalledWith(expect.objectContaining({
      documentId: "rel_01",
      editionId: "ed_developer",
      baseRevisionId: "rev_01",
      operationId: "review-operation-1",
      edition: expect.objectContaining({
        blocks: [expect.objectContaining({ markdown: "- Adds retry diagnostics." })],
      }),
    }));
    expect(controller.getState().document.revisionId).toBe("rev_02");
    expect(controller.getState().status).toBe("idle");
  });

  it("preserves local wording when a server revision conflict occurs", async () => {
    const document = createReviewDocument();
    const serverDocument = {
      ...document,
      revisionId: "rev_02",
      editions: document.editions.map((edition) =>
        edition.id === "ed_developer"
          ? {
              ...edition,
              revisionId: "ed_rev_02",
              blocks: [{ ...edition.blocks[0]!, markdown: "- Server wording." }],
            }
          : edition,
      ),
    };
    const controller = createReviewEditorController(document, {
      persistence: {
        saveEdition: async () => ({
          kind: "conflict",
          document: serverDocument,
          conflict: {
            code: "revision-conflict",
            message: "The edition changed while you were reviewing it.",
            baseRevisionId: "rev_01",
            currentRevisionId: "rev_02",
            changedBlockIds: ["block_added"],
            changedClaimIds: ["clm_what_01"],
          },
        }),
      },
    });
    controller.dispatch({
      type: "replace-active-block",
      blockId: "block_added",
      markdown: "- Local reviewer wording.",
    });

    await expect(controller.saveActiveEdition()).resolves.toEqual({ kind: "conflict" });
    expect(controller.getState().status).toBe("conflict");
    expect(controller.getState().document.revisionId).toBe("rev_02");
    expect(
      controller.getState().localConflictDocument?.editions[0]?.blocks[0]?.markdown,
    ).toBe("- Local reviewer wording.");

    controller.restoreConflictDraft();

    expect(controller.getState().status).toBe("idle");
    expect(controller.getState().document.revisionId).toBe("rev_02");
    expect(controller.getState().document.editions[0]?.revisionId).toBe("ed_rev_02");
    expect(controller.getState().document.editions[0]?.blocks[0]?.markdown).toBe(
      "- Local reviewer wording.",
    );
  });
});
