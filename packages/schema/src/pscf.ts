import { createHash, sign, type KeyObject, verify } from "node:crypto";

/** The first portable PolyScribe Changelog Format revision. */
export const PSCF_SPEC_VERSION = "polyscribe/changelog@1" as const;

/**
 * The repository-hosted schema is the provisional canonical URL described by
 * the V3 specification. Consumers may pin this value when storing documents.
 */
export const PSCF_SCHEMA_URL =
  "https://github.com/LatticeAG/PolyScribe/blob/main/schemas/pscf/v1.json" as const;

export const PSCF_AUDIENCES = ["developer", "user", "executive"] as const;
export type PscfBuiltInAudience = (typeof PSCF_AUDIENCES)[number];
export type PscfAudience = PscfBuiltInAudience | (string & {});

export const PSCF_VISIBILITIES = [
  "public",
  "workspace",
  "restricted",
  "embargoed",
] as const;
export type PscfVisibility = (typeof PSCF_VISIBILITIES)[number];

export const PSCF_CHANGE_CATEGORIES = [
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
export type PscfChangeCategory = (typeof PSCF_CHANGE_CATEGORIES)[number];

export const PSCF_CLAIM_KINDS = [
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
export type PscfClaimKind = (typeof PSCF_CLAIM_KINDS)[number];

export const PSCF_CERTAINTIES = [
  "supported",
  "human-attested",
  "unknown",
  "needs-review",
] as const;
export type PscfClaimCertainty = (typeof PSCF_CERTAINTIES)[number];

export const PSCF_INCLUSIONS = [
  "must-announce",
  "announce",
  "developer-note",
  "internal-context",
  "exclude",
  "needs-review",
] as const;
export type PscfInclusion = (typeof PSCF_INCLUSIONS)[number];

export type PscfImpact =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "breaking"
  | "unknown";

export type PscfMigrationState =
  | "none"
  | "informational"
  | "optional"
  | "required"
  | "unknown";

export interface PscfReleaseRangeEndpoint {
  ref: string;
  sha: string;
}

export interface PscfReleaseRange {
  from: PscfReleaseRangeEndpoint;
  to: PscfReleaseRangeEndpoint;
}

export interface PscfRelease {
  repositoryId: string;
  componentId?: string;
  version?: string;
  tag?: string;
  range?: PscfReleaseRange;
  status: string;
  releasedAt?: string;
  lineage?: string[];
}

export interface PscfEvidenceReference {
  evidenceId: string;
  revision: string;
  hash?: string;
  sourceKey?: string;
  url?: string;
  visibility?: PscfVisibility;
}

export interface PscfSnapshot {
  snapshotId: string;
  evidence?: PscfEvidenceReference[];
  mappingPolicyVersion?: string;
  componentPolicyVersion?: string;
  configHash?: string;
  promptPolicyVersion?: string;
  completeness?: "complete" | "partial" | "unknown" | "not-applicable";
  diagnostics?: string[];
}

export interface PscfCitationLocator {
  field: string;
  fragmentHash?: string;
  start?: number;
  end?: number;
}

export type PscfCitationSupport =
  | "direct"
  | "rationale"
  | "impact"
  | "migration"
  | "context"
  | "contradicts";

export interface PscfCitation {
  evidence: string;
  revision?: string;
  locator: PscfCitationLocator;
  supports: PscfCitationSupport;
  visibility?: PscfVisibility;
  quoteHash?: string;
}

export interface PscfClaim {
  claimId: string;
  kind: PscfClaimKind;
  statement: string;
  certainty: PscfClaimCertainty;
  citations: PscfCitation[];
  visibility?: PscfVisibility;
  authoringMode?: "derived" | "editor-authored" | "imported-legacy";
}

export interface PscfMigration {
  state: PscfMigrationState;
  actionSteps?: string[];
  affectedVersions?: string[];
  deadline?: string;
  rollback?: string;
  citations?: PscfCitation[];
}

export interface PscfChangeUnit {
  changeId: string;
  componentScope?: string[];
  categories: PscfChangeCategory[];
  impact: PscfImpact;
  inclusion: PscfInclusion;
  visibility: PscfVisibility;
  deliveryEvidence: string[];
  claims: PscfClaim[];
  migration?: PscfMigration;
}

export interface PscfChangeSet {
  snapshotId: string;
  completeness?: "complete" | "partial" | "unknown" | "not-applicable";
  changes: PscfChangeUnit[];
}

export interface PscfEditionBlock {
  blockId: string;
  section: string;
  claimIds: string[];
  changeIds?: string[];
  markdown: string;
}

export interface PscfAudienceEdition {
  editionId: string;
  audience: PscfAudience;
  baseChangeSetRevision: string;
  revision: number;
  status: string;
  visibility?: PscfVisibility;
  blocks: PscfEditionBlock[];
  approvedAt?: string;
}

export interface PscfQualityReport {
  editionId: string;
  rubricVersion: string;
  score: number;
  dimensions: Record<string, number>;
  blockers?: Array<{ code: string; message: string }>;
  tasks?: Array<{ code: string; message: string }>;
}

export interface PscfIntegrity {
  canonicalHash?: string;
  canonicalization?: "RFC-8785";
  signedAt?: string;
  signature?: string;
  keyId?: string;
  algorithm?: "Ed25519";
}

/**
 * An immutable PSCF release content revision. Publication attempts deliberately
 * live outside this object in an append-only delivery ledger.
 */
export interface PscfReleaseContentRevision {
  $schema: string;
  specVersion: typeof PSCF_SPEC_VERSION;
  documentId: string;
  revisionId: string;
  createdAt: string;
  updatedAt: string;
  release: PscfRelease;
  snapshot: PscfSnapshot;
  changeSet: PscfChangeSet;
  editions: PscfAudienceEdition[];
  quality?: { reports: PscfQualityReport[] };
  publicationLedgerRefs?: string[];
  auditRefs?: string[];
  integrity?: PscfIntegrity;
  extensions?: Record<string, unknown>;
}

export type PscfDocument = PscfReleaseContentRevision;

/**
 * A portable JSON Schema export. Semantic rules such as claim references,
 * visibility propagation, and canonical hash verification are enforced by
 * `validatePscf`, not by JSON Schema alone.
 */
export const pscfV1JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: PSCF_SCHEMA_URL,
  title: "PolyScribe Changelog Format v1",
  type: "object",
  additionalProperties: false,
  required: [
    "$schema",
    "specVersion",
    "documentId",
    "revisionId",
    "createdAt",
    "updatedAt",
    "release",
    "snapshot",
    "changeSet",
    "editions",
  ],
  properties: {
    $schema: { const: PSCF_SCHEMA_URL },
    specVersion: { const: PSCF_SPEC_VERSION },
    documentId: { type: "string", minLength: 1 },
    revisionId: { type: "string", minLength: 1 },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    release: { $ref: "#/$defs/release" },
    snapshot: { $ref: "#/$defs/snapshot" },
    changeSet: { $ref: "#/$defs/changeSet" },
    editions: {
      type: "array",
      items: { $ref: "#/$defs/edition" },
    },
    quality: { type: "object" },
    publicationLedgerRefs: { type: "array", items: { type: "string" } },
    auditRefs: { type: "array", items: { type: "string" } },
    integrity: { type: "object" },
    extensions: { type: "object", additionalProperties: true },
  },
  $defs: {
    release: {
      type: "object",
      additionalProperties: false,
      required: ["repositoryId", "status"],
      properties: {
        repositoryId: { type: "string", minLength: 1 },
        componentId: { type: "string" },
        version: { type: "string" },
        tag: { type: "string" },
        range: { type: "object" },
        status: { type: "string", minLength: 1 },
        releasedAt: { type: "string", format: "date-time" },
        lineage: { type: "array", items: { type: "string" } },
      },
    },
    snapshot: {
      type: "object",
      additionalProperties: true,
      required: ["snapshotId"],
      properties: {
        snapshotId: { type: "string", minLength: 1 },
        evidence: { type: "array", items: { type: "object" } },
      },
    },
    changeSet: {
      type: "object",
      additionalProperties: false,
      required: ["snapshotId", "changes"],
      properties: {
        snapshotId: { type: "string", minLength: 1 },
        completeness: {
          enum: ["complete", "partial", "unknown", "not-applicable"],
        },
        changes: { type: "array", items: { $ref: "#/$defs/change" } },
      },
    },
    change: {
      type: "object",
      additionalProperties: false,
      required: [
        "changeId",
        "categories",
        "impact",
        "inclusion",
        "visibility",
        "deliveryEvidence",
        "claims",
      ],
      properties: {
        changeId: { type: "string", minLength: 1 },
        componentScope: { type: "array", items: { type: "string" } },
        categories: { type: "array", items: { enum: PSCF_CHANGE_CATEGORIES } },
        impact: { enum: ["none", "low", "medium", "high", "breaking", "unknown"] },
        inclusion: { enum: PSCF_INCLUSIONS },
        visibility: { enum: PSCF_VISIBILITIES },
        deliveryEvidence: { type: "array", items: { type: "string" } },
        claims: { type: "array", items: { $ref: "#/$defs/claim" } },
        migration: { type: "object" },
      },
    },
    claim: {
      type: "object",
      additionalProperties: false,
      required: ["claimId", "kind", "statement", "certainty", "citations"],
      properties: {
        claimId: { type: "string", minLength: 1 },
        kind: { enum: PSCF_CLAIM_KINDS },
        statement: { type: "string", minLength: 1 },
        certainty: { enum: PSCF_CERTAINTIES },
        citations: { type: "array", items: { type: "object" } },
        visibility: { enum: PSCF_VISIBILITIES },
        authoringMode: { enum: ["derived", "editor-authored", "imported-legacy"] },
      },
    },
    edition: {
      type: "object",
      additionalProperties: false,
      required: [
        "editionId",
        "audience",
        "baseChangeSetRevision",
        "revision",
        "status",
        "blocks",
      ],
      properties: {
        editionId: { type: "string", minLength: 1 },
        audience: { type: "string", minLength: 1 },
        baseChangeSetRevision: { type: "string", minLength: 1 },
        revision: { type: "integer", minimum: 1 },
        status: { type: "string", minLength: 1 },
        visibility: { enum: PSCF_VISIBILITIES },
        blocks: { type: "array", items: { type: "object" } },
      },
    },
  },
} as const;

export type PscfValidationIssueCode =
  | "invalid-type"
  | "missing-field"
  | "invalid-value"
  | "unknown-field"
  | "duplicate-id"
  | "unknown-reference"
  | "unsupported-claim"
  | "visibility-violation"
  | "missing-delivery-evidence"
  | "missing-migration-action"
  | "integrity-mismatch";

export interface PscfValidationIssue {
  path: string;
  code: PscfValidationIssueCode;
  message: string;
}

export interface PscfValidationResult {
  valid: boolean;
  structuralIssues: PscfValidationIssue[];
  semanticIssues: PscfValidationIssue[];
  issues: PscfValidationIssue[];
}

type JsonRecord = Record<string, unknown>;

const PSCF_TOP_LEVEL_FIELDS = new Set([
  "$schema",
  "specVersion",
  "documentId",
  "revisionId",
  "createdAt",
  "updatedAt",
  "release",
  "snapshot",
  "changeSet",
  "editions",
  "quality",
  "publicationLedgerRefs",
  "auditRefs",
  "integrity",
  "extensions",
]);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function addIssue(
  issues: PscfValidationIssue[],
  path: string,
  code: PscfValidationIssueCode,
  message: string,
): void {
  issues.push({ path, code, message });
}

function requireString(
  value: JsonRecord,
  key: string,
  path: string,
  issues: PscfValidationIssue[],
): void {
  if (!(key in value)) {
    addIssue(issues, `${path}.${key}`, "missing-field", "Field is required");
  } else if (!isNonEmptyString(value[key])) {
    addIssue(issues, `${path}.${key}`, "invalid-type", "Expected a non-empty string");
  }
}

function requireArray(
  value: JsonRecord,
  key: string,
  path: string,
  issues: PscfValidationIssue[],
): unknown[] | undefined {
  if (!(key in value)) {
    addIssue(issues, `${path}.${key}`, "missing-field", "Field is required");
    return undefined;
  }
  if (!Array.isArray(value[key])) {
    addIssue(issues, `${path}.${key}`, "invalid-type", "Expected an array");
    return undefined;
  }
  return value[key] as unknown[];
}

function requireRecord(
  value: JsonRecord,
  key: string,
  path: string,
  issues: PscfValidationIssue[],
): JsonRecord | undefined {
  if (!(key in value)) {
    addIssue(issues, `${path}.${key}`, "missing-field", "Field is required");
    return undefined;
  }
  if (!isRecord(value[key])) {
    addIssue(issues, `${path}.${key}`, "invalid-type", "Expected an object");
    return undefined;
  }
  return value[key] as JsonRecord;
}

function requireEnum(
  value: JsonRecord,
  key: string,
  allowed: readonly string[],
  path: string,
  issues: PscfValidationIssue[],
): void {
  if (!isNonEmptyString(value[key])) {
    addIssue(issues, `${path}.${key}`, "invalid-type", "Expected a non-empty string");
  } else if (!allowed.includes(value[key] as string)) {
    addIssue(
      issues,
      `${path}.${key}`,
      "invalid-value",
      `Expected one of: ${allowed.join(", ")}`,
    );
  }
}

function validateCitation(
  value: unknown,
  path: string,
  issues: PscfValidationIssue[],
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "invalid-type", "Expected a citation object");
    return;
  }
  requireString(value, "evidence", path, issues);
  requireRecord(value, "locator", path, issues);
  requireEnum(
    value,
    "supports",
    ["direct", "rationale", "impact", "migration", "context", "contradicts"],
    path,
    issues,
  );
  if ("visibility" in value) {
    requireEnum(value, "visibility", PSCF_VISIBILITIES, path, issues);
  }
}

function validateClaim(
  value: unknown,
  path: string,
  issues: PscfValidationIssue[],
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "invalid-type", "Expected a claim object");
    return;
  }
  requireString(value, "claimId", path, issues);
  requireEnum(value, "kind", PSCF_CLAIM_KINDS, path, issues);
  requireString(value, "statement", path, issues);
  requireEnum(value, "certainty", PSCF_CERTAINTIES, path, issues);
  const citations = requireArray(value, "citations", path, issues);
  citations?.forEach((citation, index) =>
    validateCitation(citation, `${path}.citations[${index}]`, issues),
  );
  if ("visibility" in value) {
    requireEnum(value, "visibility", PSCF_VISIBILITIES, path, issues);
  }
}

function validateChange(
  value: unknown,
  path: string,
  issues: PscfValidationIssue[],
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "invalid-type", "Expected a change object");
    return;
  }
  requireString(value, "changeId", path, issues);
  const categories = requireArray(value, "categories", path, issues);
  categories?.forEach((category, index) => {
    if (typeof category !== "string" || !PSCF_CHANGE_CATEGORIES.includes(category as PscfChangeCategory)) {
      addIssue(
        issues,
        `${path}.categories[${index}]`,
        "invalid-value",
        "Unknown change category",
      );
    }
  });
  requireEnum(value, "impact", ["none", "low", "medium", "high", "breaking", "unknown"], path, issues);
  requireEnum(value, "inclusion", PSCF_INCLUSIONS, path, issues);
  requireEnum(value, "visibility", PSCF_VISIBILITIES, path, issues);
  const deliveryEvidence = requireArray(value, "deliveryEvidence", path, issues);
  if (deliveryEvidence && !isStringArray(deliveryEvidence)) {
    addIssue(issues, `${path}.deliveryEvidence`, "invalid-type", "Expected string evidence IDs");
  }
  const claims = requireArray(value, "claims", path, issues);
  claims?.forEach((claim, index) => validateClaim(claim, `${path}.claims[${index}]`, issues));
  if ("migration" in value && !isRecord(value.migration)) {
    addIssue(issues, `${path}.migration`, "invalid-type", "Expected a migration object");
  }
}

function validateEdition(
  value: unknown,
  path: string,
  issues: PscfValidationIssue[],
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "invalid-type", "Expected an audience edition object");
    return;
  }
  requireString(value, "editionId", path, issues);
  requireString(value, "audience", path, issues);
  requireString(value, "baseChangeSetRevision", path, issues);
  if (!Number.isInteger(value.revision) || (value.revision as number) < 1) {
    addIssue(issues, `${path}.revision`, "invalid-value", "Expected an integer revision >= 1");
  }
  requireString(value, "status", path, issues);
  const blocks = requireArray(value, "blocks", path, issues);
  blocks?.forEach((block, index) => {
    const blockPath = `${path}.blocks[${index}]`;
    if (!isRecord(block)) {
      addIssue(issues, blockPath, "invalid-type", "Expected an edition block object");
      return;
    }
    requireString(block, "blockId", blockPath, issues);
    requireString(block, "section", blockPath, issues);
    if (!isStringArray(block.claimIds)) {
      addIssue(issues, `${blockPath}.claimIds`, "invalid-type", "Expected string claim IDs");
    }
    requireString(block, "markdown", blockPath, issues);
  });
  if ("visibility" in value) {
    requireEnum(value, "visibility", PSCF_VISIBILITIES, path, issues);
  }
}

/** Validate required PSCF v1 structure without making policy decisions. */
export function validatePscfStructural(document: unknown): PscfValidationIssue[] {
  const issues: PscfValidationIssue[] = [];
  if (!isRecord(document)) {
    addIssue(issues, "$", "invalid-type", "PSCF document must be an object");
    return issues;
  }

  for (const key of Object.keys(document)) {
    if (!PSCF_TOP_LEVEL_FIELDS.has(key)) {
      addIssue(
        issues,
        `$.${key}`,
        "unknown-field",
        "Unknown PSCF core field; use the namespaced extensions map for plugin data",
      );
    }
  }

  requireString(document, "$schema", "$", issues);
  if (document.$schema !== PSCF_SCHEMA_URL) {
    addIssue(issues, "$.\u0024schema", "invalid-value", `Expected ${PSCF_SCHEMA_URL}`);
  }
  if (document.specVersion !== PSCF_SPEC_VERSION) {
    addIssue(issues, "$.specVersion", "invalid-value", `Expected ${PSCF_SPEC_VERSION}`);
  }
  requireString(document, "documentId", "$", issues);
  requireString(document, "revisionId", "$", issues);
  requireString(document, "createdAt", "$", issues);
  requireString(document, "updatedAt", "$", issues);

  const release = requireRecord(document, "release", "$", issues);
  if (release) {
    requireString(release, "repositoryId", "$.release", issues);
    requireString(release, "status", "$.release", issues);
  }

  const snapshot = requireRecord(document, "snapshot", "$", issues);
  if (snapshot) {
    requireString(snapshot, "snapshotId", "$.snapshot", issues);
    if ("evidence" in snapshot && !Array.isArray(snapshot.evidence)) {
      addIssue(issues, "$.snapshot.evidence", "invalid-type", "Expected an evidence array");
    }
  }

  const changeSet = requireRecord(document, "changeSet", "$", issues);
  if (changeSet) {
    requireString(changeSet, "snapshotId", "$.changeSet", issues);
    const changes = requireArray(changeSet, "changes", "$.changeSet", issues);
    changes?.forEach((change, index) => validateChange(change, `$.changeSet.changes[${index}]`, issues));
  }

  const editions = requireArray(document, "editions", "$", issues);
  editions?.forEach((edition, index) => validateEdition(edition, `$.editions[${index}]`, issues));

  if ("integrity" in document && !isRecord(document.integrity)) {
    addIssue(issues, "$.integrity", "invalid-type", "Expected an integrity object");
  }

  return issues;
}

const VISIBILITY_RANK: Record<PscfVisibility, number> = {
  public: 0,
  workspace: 1,
  restricted: 2,
  embargoed: 3,
};

function visibilityBroaderThan(
  candidate: PscfVisibility,
  constraint: PscfVisibility,
): boolean {
  return VISIBILITY_RANK[candidate] < VISIBILITY_RANK[constraint];
}

function collectDuplicateIds(
  entries: Array<{ id: string; path: string }>,
  issues: PscfValidationIssue[],
): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      addIssue(issues, entry.path, "duplicate-id", `Duplicate ID: ${entry.id}`);
    }
    seen.add(entry.id);
  }
}

/**
 * Validate PSCF invariants JSON Schema cannot express: citation provenance,
 * edition references, visibility taint, migration requirements, and integrity.
 */
export function validatePscfSemantics(document: unknown): PscfValidationIssue[] {
  const issues: PscfValidationIssue[] = [];
  if (!isRecord(document) || !isRecord(document.changeSet) || !Array.isArray(document.changeSet.changes)) {
    return issues;
  }

  const changes = document.changeSet.changes.filter(isRecord);
  const claims: Array<{ claim: JsonRecord; change: JsonRecord; path: string }> = [];
  const knownClaimIds = new Set<string>();
  const knownEvidenceIds = new Set<string>();

  if (isRecord(document.snapshot) && Array.isArray(document.snapshot.evidence)) {
    document.snapshot.evidence.filter(isRecord).forEach((evidence) => {
      if (isNonEmptyString(evidence.evidenceId)) knownEvidenceIds.add(evidence.evidenceId);
    });
  }

  collectDuplicateIds(
    changes
      .filter((change) => isNonEmptyString(change.changeId))
      .map((change, index) => ({ id: change.changeId as string, path: `$.changeSet.changes[${index}].changeId` })),
    issues,
  );

  changes.forEach((change, changeIndex) => {
    const path = `$.changeSet.changes[${changeIndex}]`;
    const inclusion = change.inclusion;
    if (
      (inclusion === "announce" || inclusion === "must-announce") &&
      (!Array.isArray(change.deliveryEvidence) || change.deliveryEvidence.length === 0)
    ) {
      addIssue(
        issues,
        `${path}.deliveryEvidence`,
        "missing-delivery-evidence",
        "Announced changes require accepted delivery evidence",
      );
    }

    if (Array.isArray(change.claims)) {
      change.claims.filter(isRecord).forEach((claim, claimIndex) => {
        const claimPath = `${path}.claims[${claimIndex}]`;
        if (isNonEmptyString(claim.claimId)) {
          if (knownClaimIds.has(claim.claimId)) {
            addIssue(issues, `${claimPath}.claimId`, "duplicate-id", `Duplicate claim ID: ${claim.claimId}`);
          }
          knownClaimIds.add(claim.claimId);
        }
        claims.push({ claim, change, path: claimPath });
        if (claim.certainty === "supported" && (!Array.isArray(claim.citations) || claim.citations.length === 0)) {
          addIssue(
            issues,
            `${claimPath}.citations`,
            "unsupported-claim",
            "Supported claims require at least one citation",
          );
        }
        if (Array.isArray(claim.citations)) {
          claim.citations.filter(isRecord).forEach((citation, citationIndex) => {
            const citationPath = `${claimPath}.citations[${citationIndex}]`;
            if (
              knownEvidenceIds.size > 0 &&
              isNonEmptyString(citation.evidence) &&
              !knownEvidenceIds.has(citation.evidence)
            ) {
              addIssue(
                issues,
                `${citationPath}.evidence`,
                "unknown-reference",
                `Citation references evidence outside the snapshot: ${citation.evidence}`,
              );
            }
            const claimVisibility = (claim.visibility ?? change.visibility) as PscfVisibility | undefined;
            if (
              claimVisibility &&
              typeof citation.visibility === "string" &&
              PSCF_VISIBILITIES.includes(citation.visibility as PscfVisibility) &&
              visibilityBroaderThan(claimVisibility, citation.visibility as PscfVisibility)
            ) {
              addIssue(
                issues,
                citationPath,
                "visibility-violation",
                "A claim cannot be more visible than its citation",
              );
            }
          });
        }
      });
    }

    if (isRecord(change.migration) && change.migration.state === "required") {
      if (!isStringArray(change.migration.actionSteps) || change.migration.actionSteps.length === 0) {
        addIssue(
          issues,
          `${path}.migration.actionSteps`,
          "missing-migration-action",
          "Required migrations need reviewed action steps",
        );
      }
    }
  });

  if (Array.isArray(document.editions)) {
    const editionIds: Array<{ id: string; path: string }> = [];
    document.editions.filter(isRecord).forEach((edition, editionIndex) => {
      const editionPath = `$.editions[${editionIndex}]`;
      if (isNonEmptyString(edition.editionId)) {
        editionIds.push({ id: edition.editionId, path: `${editionPath}.editionId` });
      }
      const editionVisibility = edition.visibility as PscfVisibility | undefined;
      if (!Array.isArray(edition.blocks)) return;
      const blockIds: Array<{ id: string; path: string }> = [];
      edition.blocks.filter(isRecord).forEach((block, blockIndex) => {
        const blockPath = `${editionPath}.blocks[${blockIndex}]`;
        if (isNonEmptyString(block.blockId)) {
          blockIds.push({ id: block.blockId, path: `${blockPath}.blockId` });
        }
        if (!Array.isArray(block.claimIds)) return;
        block.claimIds.forEach((claimId, claimIndex) => {
          if (typeof claimId !== "string" || !knownClaimIds.has(claimId)) {
            addIssue(
              issues,
              `${blockPath}.claimIds[${claimIndex}]`,
              "unknown-reference",
              `Edition block references an unknown claim: ${String(claimId)}`,
            );
            return;
          }
          const claimEntry = claims.find((entry) => entry.claim.claimId === claimId);
          const claimVisibility = (claimEntry?.claim.visibility ?? claimEntry?.change.visibility) as
            | PscfVisibility
            | undefined;
          if (
            editionVisibility &&
            claimVisibility &&
            visibilityBroaderThan(editionVisibility, claimVisibility)
          ) {
            addIssue(
              issues,
              `${blockPath}.claimIds[${claimIndex}]`,
              "visibility-violation",
              "An edition cannot broaden a claim's visibility",
            );
          }
        });
      });
      collectDuplicateIds(blockIds, issues);
    });
    collectDuplicateIds(editionIds, issues);
  }

  if (isRecord(document.integrity) && isNonEmptyString(document.integrity.canonicalHash)) {
    try {
      const actualHash = calculatePscfCanonicalHash(document);
      if (document.integrity.canonicalHash !== actualHash) {
        addIssue(
          issues,
          "$.integrity.canonicalHash",
          "integrity-mismatch",
          "Canonical hash does not match the PSCF content revision",
        );
      }
    } catch (error) {
      addIssue(
        issues,
        "$.integrity.canonicalHash",
        "integrity-mismatch",
        error instanceof Error ? error.message : "Unable to canonicalize PSCF document",
      );
    }
  }

  if (
    isRecord(document.release) &&
    (document.release.status === "approved" || document.release.status === "published") &&
    (!isRecord(document.integrity) || !isNonEmptyString(document.integrity.canonicalHash))
  ) {
    addIssue(
      issues,
      "$.integrity.canonicalHash",
      "integrity-mismatch",
      "Approved and published revisions require a canonical hash",
    );
  }

  return issues;
}

export function validatePscf(document: unknown): PscfValidationResult {
  const structuralIssues = validatePscfStructural(document);
  const semanticIssues = structuralIssues.length === 0 ? validatePscfSemantics(document) : [];
  const issues = [...structuralIssues, ...semanticIssues];
  return {
    valid: issues.length === 0,
    structuralIssues,
    semanticIssues,
    issues,
  };
}

/** Discoverable alias for consumers that treat PSCF as a document format. */
export const validatePscfDocument = validatePscf;

export function assertValidPscf(document: unknown): asserts document is PscfReleaseContentRevision {
  const result = validatePscf(document);
  if (!result.valid) {
    const summary = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new Error(`Invalid PSCF document: ${summary}`);
  }
}

/** Deterministic JSON serialization suitable for content-addressed documents. */
export function canonicalizeJson(value: unknown): string {
  const ancestors = new WeakSet<object>();

  const visit = (current: unknown): string => {
    if (current === null) return "null";
    switch (typeof current) {
      case "string":
        return JSON.stringify(current);
      case "boolean":
        return current ? "true" : "false";
      case "number":
        if (!Number.isFinite(current)) {
          throw new TypeError("Canonical JSON does not support non-finite numbers");
        }
        return Object.is(current, -0) ? "0" : JSON.stringify(current);
      case "object": {
        if (ancestors.has(current)) {
          throw new TypeError("Canonical JSON does not support cyclic objects");
        }
        ancestors.add(current);
        try {
          if (Array.isArray(current)) {
            return `[${current.map(visit).join(",")}]`;
          }
          const prototype = Object.getPrototypeOf(current);
          if (prototype !== Object.prototype && prototype !== null) {
            throw new TypeError("Canonical JSON only supports plain objects");
          }
          const record = current as JsonRecord;
          const properties = Object.keys(record)
            .sort()
            .map((key) => {
              if (record[key] === undefined) {
                throw new TypeError(`Canonical JSON does not support undefined values (${key})`);
              }
              return `${JSON.stringify(key)}:${visit(record[key])}`;
            });
          return `{${properties.join(",")}}`;
        } finally {
          ancestors.delete(current);
        }
      }
      default:
        throw new TypeError(`Canonical JSON does not support ${typeof current}`);
    }
  };

  return visit(value);
}

function pscfContentForHash(document: unknown): JsonRecord {
  if (!isRecord(document)) {
    throw new TypeError("PSCF document must be an object to compute its canonical hash");
  }
  const content = { ...document };
  delete content.integrity;
  return content;
}

/** Canonical PSCF content excludes the self-referential integrity object. */
export function canonicalizePscf(document: PscfReleaseContentRevision | JsonRecord): string {
  return canonicalizeJson(pscfContentForHash(document));
}

export function calculatePscfCanonicalHash(
  document: PscfReleaseContentRevision | JsonRecord,
): string {
  return `sha256:${createHash("sha256").update(canonicalizePscf(document), "utf8").digest("hex")}`;
}

/** Discoverable alias for PSCF's content-address hash operation. */
export const hashPscfDocument = calculatePscfCanonicalHash;

export function withPscfCanonicalHash(
  document: PscfReleaseContentRevision,
): PscfReleaseContentRevision {
  return {
    ...document,
    integrity: {
      ...document.integrity,
      canonicalization: "RFC-8785",
      canonicalHash: calculatePscfCanonicalHash(document),
    },
  };
}

export function verifyPscfCanonicalHash(document: PscfReleaseContentRevision): boolean {
  return Boolean(
    document.integrity?.canonicalHash &&
      document.integrity.canonicalHash === calculatePscfCanonicalHash(document),
  );
}

/**
 * Signs the immutable RFC-8785-style PSCF content payload. Delivery receipts
 * remain outside this payload, so later publishing activity cannot alter a
 * reviewed revision's signature.
 */
export function signPscfDocument(
  document: PscfReleaseContentRevision,
  privateKey: string | Buffer | KeyObject,
  keyId: string,
  signedAt = new Date().toISOString(),
): PscfReleaseContentRevision {
  const canonical = canonicalizePscf(document);
  const canonicalHash = `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
  return {
    ...document,
    integrity: {
      ...document.integrity,
      canonicalization: "RFC-8785",
      canonicalHash,
      algorithm: "Ed25519",
      keyId,
      signedAt,
      signature: sign(null, Buffer.from(canonical), privateKey).toString("base64url"),
    },
  };
}

export function verifyPscfSignature(
  document: PscfReleaseContentRevision,
  publicKey: string | Buffer | KeyObject,
): boolean {
  const integrity = document.integrity;
  if (
    !integrity?.signature ||
    integrity.algorithm !== "Ed25519" ||
    !integrity.keyId ||
    !verifyPscfCanonicalHash(document)
  ) {
    return false;
  }
  return verify(
    null,
    Buffer.from(canonicalizePscf(document)),
    publicKey,
    Buffer.from(integrity.signature, "base64url"),
  );
}
