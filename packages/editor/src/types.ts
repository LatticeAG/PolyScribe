/**
 * Lightweight review-domain types used by the standalone editor scaffold.
 *
 * These deliberately describe only the data the UI needs. They are kept
 * independent from the eventual PSCF/core types so the editor can be mounted
 * early and adapted at the package boundary later.
 */

export type BuiltInReviewAudience = "developer" | "user" | "executive";

export type ReviewAudience = BuiltInReviewAudience | (string & {});

export type ReviewEditionStatus =
  | "draft"
  | "in_review"
  | "needs_changes"
  | "approved"
  | "published"
  | "superseded";

export type ReviewVisibility =
  | "public"
  | "workspace"
  | "restricted"
  | "embargoed";

export type ReviewAuthority =
  | "delivery"
  | "intent"
  | "context"
  | "historical-publication"
  | "human-attestation"
  | "derived";

export type ReviewTaskSeverity = "blocker" | "high" | "medium" | "low";

export interface ReviewReleaseRange {
  from: string;
  to: string;
}

export interface ReviewRelease {
  id: string;
  version: string;
  component?: string;
  range: ReviewReleaseRange;
  status: string;
  sourceCompleteness: "complete" | "partial" | "unknown" | "not-applicable";
  updatedAt?: string;
}

export interface ReviewCitation {
  evidenceId: string;
  locator?: string;
  support?: "direct" | "rationale" | "impact" | "migration" | "context" | "contradicts";
}

export interface ReviewClaim {
  id: string;
  statement: string;
  kind?: string;
  certainty?: "supported" | "human-attested" | "unknown" | "needs-review";
  visibility?: ReviewVisibility;
  citations?: readonly ReviewCitation[];
}

export interface ReviewBlock {
  id: string;
  section: string;
  markdown: string;
  claimIds: readonly string[];
  changeIds?: readonly string[];
}

export interface ReviewQualityDimension {
  id: string;
  label: string;
  score: number;
  weight?: number;
}

export interface ReviewQualityTask {
  id: string;
  severity: ReviewTaskSeverity;
  title: string;
  detail?: string;
  changeId?: string;
  claimId?: string;
  evidenceId?: string;
}

export interface ReviewQualityReport {
  score: number;
  band?: "excellent" | "good" | "needs-review" | "blocked";
  rubricVersion?: string;
  dimensions: readonly ReviewQualityDimension[];
  blockers: readonly ReviewQualityTask[];
  tasks: readonly ReviewQualityTask[];
}

export interface ReviewEdition {
  id: string;
  audience: ReviewAudience;
  revisionId: string;
  status: ReviewEditionStatus;
  updatedAt?: string;
  blocks: readonly ReviewBlock[];
  quality?: ReviewQualityReport;
}

export interface ReviewEvidence {
  id: string;
  title: string;
  kind: string;
  authority: ReviewAuthority;
  visibility: ReviewVisibility;
  sourceUrl?: string;
  locator?: string;
  excerpt?: string;
  redacted?: boolean;
}

export interface ReviewMappingCandidate {
  id: string;
  title: string;
  status: "proposed" | "accepted" | "rejected" | "conflicted" | "needs-review";
  confidence?: number;
  method?: string;
  detail?: string;
  evidenceIds?: readonly string[];
}

export interface ReviewRevisionHistoryEntry {
  id: string;
  label?: string;
  actor: string;
  timestamp: string;
  summary: string;
  kind?: "editor" | "generation" | "approval" | "publication" | "mapping";
}

export interface ReviewPublishingTarget {
  id: string;
  label: string;
  audience: ReviewAudience;
  status: "ready" | "planned" | "scheduled" | "published" | "failed" | "blocked";
  detail?: string;
  targetUrl?: string;
}

export interface ReviewDocument {
  id: string;
  revisionId: string;
  release: ReviewRelease;
  editions: readonly ReviewEdition[];
  claims: readonly ReviewClaim[];
  evidence: readonly ReviewEvidence[];
  mappings: readonly ReviewMappingCandidate[];
  revisions: readonly ReviewRevisionHistoryEntry[];
  publishingTargets: readonly ReviewPublishingTarget[];
}

export interface ReviewRevisionConflict {
  code: "revision-conflict";
  message: string;
  baseRevisionId: string;
  currentRevisionId: string;
  changedBlockIds: readonly string[];
  changedClaimIds: readonly string[];
}
