import { getReviewEdition, type ReviewEditorState } from "./state.js";
import type {
  ReviewEdition,
  ReviewEvidence,
  ReviewMappingCandidate,
  ReviewPublishingTarget,
  ReviewQualityReport,
  ReviewRevisionHistoryEntry,
} from "./types.js";

export const REVIEW_EDITOR_REGIONS = [
  "release-header",
  "audience-tabs",
  "editor-canvas",
  "evidence-rail",
  "quality-panel",
  "mapping-queue",
  "revision-history",
  "publish-drawer",
] as const;

export type ReviewEditorRegion = (typeof REVIEW_EDITOR_REGIONS)[number];

export interface ReviewEditorView {
  regions: readonly ReviewEditorRegion[];
  header: {
    title: string;
    range: string;
    status: string;
    sourceCompleteness: string;
    revisionId: string;
  };
  editions: readonly ReviewEdition[];
  activeEdition: ReviewEdition;
  evidence: readonly ReviewEvidence[];
  mappings: readonly ReviewMappingCandidate[];
  quality: ReviewQualityReport;
  revisions: readonly ReviewRevisionHistoryEntry[];
  publishingTargets: readonly ReviewPublishingTarget[];
}

const EMPTY_QUALITY: ReviewQualityReport = {
  score: 0,
  band: "needs-review",
  dimensions: [],
  blockers: [],
  tasks: [],
};

/**
 * A serializable, DOM-independent description of the review screen. Keeping
 * this layer pure makes the scaffold easy to test and lets a future React or
 * server-rendered shell use the exact same review hierarchy.
 */
export function createReviewEditorView(
  state: ReviewEditorState,
): ReviewEditorView {
  const activeEdition =
    getReviewEdition(state.document, state.activeAudience) ??
    state.document.editions[0];

  if (!activeEdition) {
    throw new Error("A review document needs at least one audience edition.");
  }

  const release = state.document.release;
  const title = release.component
    ? `${release.component} ${release.version}`
    : `Release ${release.version}`;

  return {
    regions: REVIEW_EDITOR_REGIONS,
    header: {
      title,
      range: `${release.range.from} → ${release.range.to}`,
      status: release.status,
      sourceCompleteness: release.sourceCompleteness,
      revisionId: state.document.revisionId,
    },
    editions: state.document.editions,
    activeEdition,
    evidence: state.document.evidence,
    mappings: state.document.mappings,
    quality: activeEdition.quality ?? EMPTY_QUALITY,
    revisions: state.document.revisions,
    publishingTargets: state.document.publishingTargets.filter(
      (target) => target.audience === activeEdition.audience,
    ),
  };
}
