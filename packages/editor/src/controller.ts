import {
  createReviewEditorState,
  getReviewEdition,
  reduceReviewEditorState,
  replaceReviewEdition,
  type ReviewEditorAction,
  type ReviewEditorState,
} from "./state.js";
import type {
  ReviewDocument,
  ReviewEdition,
  ReviewRevisionConflict,
} from "./types.js";

export interface SaveReviewEditionRequest {
  documentId: string;
  editionId: string;
  baseRevisionId: string;
  operationId: string;
  edition: ReviewEdition;
}

export type SaveReviewEditionResult =
  | { kind: "saved"; document: ReviewDocument }
  | {
      kind: "conflict";
      document: ReviewDocument;
      conflict: ReviewRevisionConflict;
    };

export interface ReviewEditorPersistence {
  saveEdition(
    request: SaveReviewEditionRequest,
  ): Promise<SaveReviewEditionResult>;
}

export type ReviewSaveOutcome =
  | { kind: "saved" }
  | { kind: "conflict" }
  | { kind: "busy" }
  | { kind: "unconfigured" }
  | { kind: "failed"; message: string };

export type ReviewEditorListener = (state: ReviewEditorState) => void;

export interface ReviewEditorController {
  getState(): ReviewEditorState;
  subscribe(listener: ReviewEditorListener): () => void;
  dispatch(action: ReviewEditorAction): void;
  saveActiveEdition(): Promise<ReviewSaveOutcome>;
  restoreConflictDraft(): void;
  discardConflictDraft(): void;
}

export interface CreateReviewEditorControllerOptions {
  persistence?: ReviewEditorPersistence;
  onStateChange?: ReviewEditorListener;
}

/**
 * Owns view state and turns a stale If-Match/base-revision response into a
 * recoverable conflict. The server document remains the visible baseline on a
 * conflict; callers can reapply the local wording onto it and save again.
 */
export function createReviewEditorController(
  document: ReviewDocument,
  options: CreateReviewEditorControllerOptions = {},
): ReviewEditorController {
  let state = createReviewEditorState(document);
  let nextOperation = 1;
  const listeners = new Set<ReviewEditorListener>();

  if (options.onStateChange) {
    listeners.add(options.onStateChange);
  }

  function publish(nextState: ReviewEditorState): void {
    state = nextState;
    for (const listener of listeners) {
      listener(state);
    }
  }

  function dispatch(action: ReviewEditorAction): void {
    if (
      state.status === "saving" &&
      action.type === "replace-active-block"
    ) {
      return;
    }

    publish(reduceReviewEditorState(state, action));
  }

  async function saveActiveEdition(): Promise<ReviewSaveOutcome> {
    if (!options.persistence) {
      publish({
        ...state,
        notice: "Connect a persistence adapter before saving this review.",
      });
      return { kind: "unconfigured" };
    }

    if (state.status === "saving") {
      return { kind: "busy" };
    }

    const edition = getReviewEdition(state.document, state.activeAudience);
    if (!edition) {
      const message = "The selected audience edition is unavailable.";
      publish({ ...state, notice: message });
      return { kind: "failed", message };
    }

    const localDocument = state.document;
    const operationId = `review-operation-${nextOperation++}`;
    const pendingSave = {
      operationId,
      editionId: edition.id,
      baseRevisionId: localDocument.revisionId,
    };

    publish({
      ...state,
      status: "saving",
      pendingSave,
      conflict: undefined,
      localConflictDocument: undefined,
      notice: "Saving review changes…",
    });

    try {
      const result = await options.persistence.saveEdition({
        documentId: localDocument.id,
        editionId: edition.id,
        baseRevisionId: localDocument.revisionId,
        operationId,
        edition,
      });

      if (state.pendingSave?.operationId !== operationId) {
        return { kind: "busy" };
      }

      if (result.kind === "saved") {
        publish({
          ...state,
          document: result.document,
          status: "idle",
          pendingSave: undefined,
          notice: "Review revision saved.",
        });
        return { kind: "saved" };
      }

      publish({
        ...state,
        document: result.document,
        status: "conflict",
        pendingSave: undefined,
        conflict: result.conflict,
        localConflictDocument: localDocument,
        notice: undefined,
      });
      return { kind: "conflict" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      publish({
        ...state,
        status: "idle",
        pendingSave: undefined,
        notice: `Could not save review changes: ${message}`,
      });
      return { kind: "failed", message };
    }
  }

  function restoreConflictDraft(): void {
    if (!state.localConflictDocument || state.status !== "conflict") {
      return;
    }

    const localEdition = getReviewEdition(
      state.localConflictDocument,
      state.activeAudience,
    );
    const currentEdition = getReviewEdition(state.document, state.activeAudience);

    const document = localEdition && currentEdition
      ? replaceReviewEdition(state.document, {
          ...localEdition,
          revisionId: currentEdition.revisionId,
        })
      : state.localConflictDocument;

    publish({
      ...state,
      document,
      status: "idle",
      conflict: undefined,
      localConflictDocument: undefined,
      notice: "Your local wording was reapplied to the latest review revision.",
    });
  }

  function discardConflictDraft(): void {
    if (state.status !== "conflict") {
      return;
    }

    publish({
      ...state,
      status: "idle",
      conflict: undefined,
      localConflictDocument: undefined,
      notice: "Using the latest review revision.",
    });
  }

  return {
    getState: () => state,
    subscribe(listener: ReviewEditorListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch,
    saveActiveEdition,
    restoreConflictDraft,
    discardConflictDraft,
  };
}
