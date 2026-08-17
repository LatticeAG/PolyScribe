import type {
  ReviewAudience,
  ReviewDocument,
  ReviewEdition,
  ReviewRevisionConflict,
} from "./types.js";

export type ReviewEditorStatus = "idle" | "saving" | "conflict";

export interface ReviewPendingSave {
  operationId: string;
  editionId: string;
  baseRevisionId: string;
}

export interface ReviewEditorState {
  document: ReviewDocument;
  activeAudience: ReviewAudience;
  selectedEvidenceId?: string;
  selectedMappingId?: string;
  isPublishDrawerOpen: boolean;
  status: ReviewEditorStatus;
  pendingSave?: ReviewPendingSave;
  conflict?: ReviewRevisionConflict;
  localConflictDocument?: ReviewDocument;
  notice?: string;
}

export interface CreateReviewEditorStateOptions {
  activeAudience?: ReviewAudience;
}

export type ReviewEditorAction =
  | { type: "select-audience"; audience: ReviewAudience }
  | { type: "select-evidence"; evidenceId?: string }
  | { type: "select-mapping"; mappingId?: string }
  | { type: "set-publish-drawer"; open: boolean }
  | { type: "replace-active-block"; blockId: string; markdown: string }
  | { type: "clear-notice" };

export function getReviewEdition(
  document: ReviewDocument,
  audience: ReviewAudience,
): ReviewEdition | undefined {
  return document.editions.find((edition) => edition.audience === audience);
}

export function createReviewEditorState(
  document: ReviewDocument,
  options: CreateReviewEditorStateOptions = {},
): ReviewEditorState {
  if (document.editions.length === 0) {
    throw new Error("A review document needs at least one audience edition.");
  }

  const activeAudience = getReviewEdition(document, options.activeAudience ?? "developer")
    ? (options.activeAudience ?? "developer")
    : document.editions[0]!.audience;

  return {
    document,
    activeAudience,
    isPublishDrawerOpen: false,
    status: "idle",
  };
}

export function replaceReviewEdition(
  document: ReviewDocument,
  nextEdition: ReviewEdition,
): ReviewDocument {
  return {
    ...document,
    editions: document.editions.map((edition) =>
      edition.id === nextEdition.id ? nextEdition : edition,
    ),
  };
}

export function replaceReviewBlockMarkdown(
  document: ReviewDocument,
  audience: ReviewAudience,
  blockId: string,
  markdown: string,
): ReviewDocument {
  const edition = getReviewEdition(document, audience);
  if (!edition) {
    return document;
  }

  const hasBlock = edition.blocks.some((block) => block.id === blockId);
  if (!hasBlock) {
    return document;
  }

  const nextEdition: ReviewEdition = {
    ...edition,
    blocks: edition.blocks.map((block) =>
      block.id === blockId ? { ...block, markdown } : block,
    ),
  };

  return replaceReviewEdition(document, nextEdition);
}

export function reduceReviewEditorState(
  state: ReviewEditorState,
  action: ReviewEditorAction,
): ReviewEditorState {
  switch (action.type) {
    case "select-audience":
      if (!getReviewEdition(state.document, action.audience)) {
        return state;
      }

      return {
        ...state,
        activeAudience: action.audience,
        selectedEvidenceId: undefined,
        selectedMappingId: undefined,
      };
    case "select-evidence":
      return { ...state, selectedEvidenceId: action.evidenceId };
    case "select-mapping":
      return { ...state, selectedMappingId: action.mappingId };
    case "set-publish-drawer":
      return { ...state, isPublishDrawerOpen: action.open };
    case "replace-active-block": {
      const document = replaceReviewBlockMarkdown(
        state.document,
        state.activeAudience,
        action.blockId,
        action.markdown,
      );

      if (document === state.document) {
        return state;
      }

      return {
        ...state,
        document,
        notice: "Local wording changed. Save the review to create a new revision.",
      };
    }
    case "clear-notice":
      return { ...state, notice: undefined };
  }
}
