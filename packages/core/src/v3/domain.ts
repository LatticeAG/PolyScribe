/**
 * Provider-neutral domain primitives for the V3 evidence-native pipeline.
 * These models intentionally live beside the legacy SourceItem/Draft models
 * instead of changing their compatibility surface.
 */

export const V3_AUDIENCES = ["developer", "user", "executive"] as const;
export type BuiltInAudience = (typeof V3_AUDIENCES)[number];
export type Audience = BuiltInAudience | (string & {});

export const V3_VISIBILITIES = [
  "public",
  "workspace",
  "restricted",
  "embargoed",
] as const;
export type Visibility = (typeof V3_VISIBILITIES)[number];

export const V3_AUTHORITY_CLASSES = [
  "delivery",
  "intent",
  "context",
  "historical-publication",
  "human-attestation",
  "derived",
] as const;
export type EvidenceAuthority = (typeof V3_AUTHORITY_CLASSES)[number];

export const V3_EVIDENCE_STATES = [
  "available",
  "restricted",
  "redacted",
  "tombstoned",
  "unavailable",
] as const;
export type EvidenceState = (typeof V3_EVIDENCE_STATES)[number];

export const V3_RELATION_TYPES = [
  "contains",
  "implements",
  "references",
  "fixes",
  "closes",
  "tracks",
  "merged-as",
  "squash-of",
  "cherry-picks",
  "reverts",
  "supersedes",
  "duplicates",
  "explains",
  "decides",
  "announces",
  "released-as",
  "belongs-to-component",
] as const;
export type EvidenceRelationType = (typeof V3_RELATION_TYPES)[number];

export const V3_MAPPING_METHODS = [
  "provider-direct",
  "exact-sha",
  "git-trailer",
  "merge-message",
  "issue-key",
  "branch",
  "path-overlap",
  "semantic-assist",
  "human",
] as const;
export type MappingMethod = (typeof V3_MAPPING_METHODS)[number];

export type MappingStatus =
  | "proposed"
  | "accepted"
  | "rejected"
  | "conflicted"
  | "superseded"
  | "invalidated";

export type MappingConfidenceBand = "high" | "medium" | "low";

export interface EvidenceSourceKey {
  pluginId: string;
  connectionId: string;
  objectKind: string;
  externalId: string;
  revision: string;
}

export interface EvidenceLocator {
  field: string;
  fragmentHash?: string;
  start?: number;
  end?: number;
}

/** A redacted, immutable observation of a provider object revision. */
export interface EvidenceRecord {
  id: string;
  source: EvidenceSourceKey;
  observedAt: string;
  sourceCreatedAt?: string;
  sourceUpdatedAt?: string;
  canonicalUrl?: string;
  contentHash?: string;
  authority: EvidenceAuthority;
  visibility: Visibility;
  state: EvidenceState;
  title?: string;
  excerpt?: string;
  fields?: Record<string, string | number | boolean | null>;
  labels?: string[];
  componentHints?: string[];
  redactionPolicyVersion?: string;
}

export interface EvidenceRelation {
  id: string;
  fromEvidenceId: string;
  toEvidenceId: string;
  type: EvidenceRelationType;
  authority: EvidenceAuthority;
  method: MappingMethod;
  confidence: number;
  sourceRevision?: string;
  citation?: {
    evidenceId: string;
    locator?: EvidenceLocator;
  };
}

export interface MappingCandidate {
  id: string;
  fromEvidenceId: string;
  toEvidenceId: string;
  relationType: EvidenceRelationType;
  method: MappingMethod;
  confidence: number;
  confidenceBand: MappingConfidenceBand;
  status: MappingStatus;
  scoreComponents?: Record<string, number>;
  releaseScopeId?: string;
  explanation?: string;
}

export const V3_CHANGE_CATEGORIES = [
  "added",
  "changed",
  "fixed",
  "deprecated",
  "removed",
  "security",
  "performance",
  "documentation",
  "operations",
  "maintenance",
] as const;
export type ChangeCategory = (typeof V3_CHANGE_CATEGORIES)[number];

export type ImpactLevel =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "breaking"
  | "unknown";

export const V3_INCLUSION_DISPOSITIONS = [
  "must-announce",
  "announce",
  "developer-note",
  "internal-context",
  "exclude",
  "needs-review",
] as const;
export type InclusionDisposition = (typeof V3_INCLUSION_DISPOSITIONS)[number];

export const V3_CLAIM_KINDS = [
  "what",
  "why",
  "impact",
  "availability",
  "action",
  "migration",
  "deprecation",
  "security-note",
  "limitation",
  "metric",
] as const;
export type ClaimKind = (typeof V3_CLAIM_KINDS)[number];

export type ClaimCertainty =
  | "supported"
  | "human-attested"
  | "unknown"
  | "needs-review";

export type ClaimAuthoringMode = "derived" | "editor-authored" | "imported-legacy";

export type CitationSupport =
  | "direct"
  | "rationale"
  | "impact"
  | "migration"
  | "context"
  | "contradicts";

export interface ClaimCitation {
  evidenceId: string;
  evidenceRevision?: string;
  locator?: EvidenceLocator;
  support: CitationSupport;
  visibility?: Visibility;
}

/** A factual statement that is shared by every audience edition. */
export interface CanonicalClaim {
  id: string;
  kind: ClaimKind;
  statement: string;
  certainty: ClaimCertainty;
  citations: ClaimCitation[];
  visibility: Visibility;
  authoringMode: ClaimAuthoringMode;
}

export type MigrationState =
  | "none"
  | "informational"
  | "optional"
  | "required"
  | "unknown";

export interface MigrationGuidance {
  state: MigrationState;
  actionSteps?: string[];
  affectedVersions?: string[];
  deadline?: string;
  rollback?: string;
  citations?: ClaimCitation[];
}

/** A reader-meaningful release change, not merely a PR or ticket. */
export interface ChangeUnit {
  id: string;
  componentIds?: string[];
  evidenceIds: string[];
  deliveryEvidenceIds: string[];
  categories: ChangeCategory[];
  impact: ImpactLevel;
  inclusion: InclusionDisposition;
  visibility: Visibility;
  claims: CanonicalClaim[];
  migration: MigrationGuidance;
}

export type SourceCompleteness =
  | "complete"
  | "partial"
  | "unknown"
  | "not-applicable";

export interface ReleaseSnapshot {
  id: string;
  releaseId: string;
  evidence: EvidenceRecord[];
  relations: EvidenceRelation[];
  mappingCandidates?: MappingCandidate[];
  sourceCompleteness: SourceCompleteness;
  mappingPolicyVersion: string;
  createdAt: string;
}

export type EditionStatus =
  | "draft"
  | "in_review"
  | "needs_changes"
  | "approved"
  | "published"
  | "superseded";

export interface AudienceProfile {
  id: Audience;
  defaultVisibility: Visibility;
  allowedVisibilities: Visibility[];
  includedDispositions: InclusionDisposition[];
  preferredClaimKinds: ClaimKind[];
  maximumDetail: "compact" | "standard" | "detailed";
}

export interface AudienceEditionBlock {
  id: string;
  section: string;
  changeIds: string[];
  claimIds: string[];
  markdown: string;
}

export interface EditionApproval {
  actorId: string;
  approvedAt: string;
  policyVersion: string;
  qualityReportId?: string;
}

/** An audience-specific projection linked to shared canonical claim IDs. */
export interface AudienceEdition {
  id: string;
  releaseId: string;
  audience: Audience;
  baseChangeSetRevision: string;
  revision: number;
  status: EditionStatus;
  visibility: Visibility;
  blocks: AudienceEditionBlock[];
  approval?: EditionApproval;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationRun {
  id: string;
  taskType: "classification" | "fact-extraction" | "audience-composition" | "verification";
  sourceSnapshotId: string;
  provider: string;
  model: string;
  promptVersion: string;
  generatedAt: string;
}

export const VISIBILITY_RANK: Record<Visibility, number> = {
  public: 0,
  workspace: 1,
  restricted: 2,
  embargoed: 3,
};

/** True if a value with `valueVisibility` can be rendered in `targetVisibility`. */
export function canRenderVisibility(
  valueVisibility: Visibility,
  targetVisibility: Visibility,
): boolean {
  return VISIBILITY_RANK[targetVisibility] >= VISIBILITY_RANK[valueVisibility];
}

export function mostRestrictiveVisibility(values: Visibility[]): Visibility {
  return values.reduce<Visibility>(
    (current, candidate) =>
      VISIBILITY_RANK[candidate] > VISIBILITY_RANK[current] ? candidate : current,
    "public",
  );
}
