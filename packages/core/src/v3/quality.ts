import { getAudienceProfile } from "./audiences.js";
import {
  type AudienceEdition,
  type CanonicalClaim,
  type ChangeUnit,
  type SourceCompleteness,
  type Visibility,
} from "./domain.js";

export const QUALITY_RUBRIC_VERSION = "v3-quality@1" as const;

export const QUALITY_DIMENSION_WEIGHTS = {
  evidenceGrounding: 25,
  whatChangedClarity: 20,
  whyImpactCoverage: 15,
  migrationActionability: 15,
  audienceFit: 10,
  signalToNoise: 10,
  sourceMappingCompleteness: 5,
} as const;

export type QualityDimension = keyof typeof QUALITY_DIMENSION_WEIGHTS;

export interface QualityDimensionResult {
  dimension: QualityDimension;
  weight: number;
  score: number;
  applicable: boolean;
  passed: number;
  total: number;
  notes: string[];
}

export type QualityBlockerCode =
  | "unsupported-public-claim"
  | "visibility-violation"
  | "required-migration-missing"
  | "mapping-conflict"
  | "source-incomplete";

export interface QualityBlocker {
  code: QualityBlockerCode;
  severity: "hard" | "warning";
  message: string;
  changeId?: string;
  claimId?: string;
}

export interface QualityTask {
  code:
    | "missing-what"
    | "missing-impact"
    | "duplicate-copy"
    | "audience-coverage"
    | "unresolved-mapping"
    | "source-completeness";
  message: string;
  changeId?: string;
  claimId?: string;
}

export interface MappingConflict {
  id: string;
  severity: "low" | "medium" | "high";
  changeId?: string;
  message?: string;
}

export interface QualityEvaluationInput {
  edition: AudienceEdition;
  changes: ChangeUnit[];
  sourceCompleteness?: SourceCompleteness;
  unresolvedMappingConflicts?: MappingConflict[];
  availableEvidenceIds?: Iterable<string>;
}

export interface ChangelogQualityReport {
  id: string;
  editionId: string;
  editionRevision: number;
  rubricVersion: typeof QUALITY_RUBRIC_VERSION;
  score: number;
  dimensions: QualityDimensionResult[];
  blockers: QualityBlocker[];
  tasks: QualityTask[];
  evaluatedAt: string;
}

function createDimension(
  dimension: QualityDimension,
  passed: number,
  total: number,
  notes: string[] = [],
): QualityDimensionResult {
  return {
    dimension,
    weight: QUALITY_DIMENSION_WEIGHTS[dimension],
    score: total === 0 ? 100 : Math.max(0, Math.min(100, (passed / total) * 100)),
    applicable: total > 0,
    passed,
    total,
    notes,
  };
}

function normalizedScore(dimensions: QualityDimensionResult[]): number {
  const applicableWeight = dimensions
    .filter((dimension) => dimension.applicable)
    .reduce((total, dimension) => total + dimension.weight, 0);
  if (applicableWeight === 0) return 0;
  const weighted = dimensions
    .filter((dimension) => dimension.applicable)
    .reduce(
      (total, dimension) => total + (dimension.score / 100) * dimension.weight,
      0,
    );
  return Math.round((weighted / applicableWeight) * 100);
}

function isClearWhat(statement: string): boolean {
  const normalized = statement.trim();
  if (normalized.length < 16) return false;
  return !/^(improved|enhanced|various|miscellaneous|updates?)\b/i.test(normalized);
}

function expectedImpact(change: ChangeUnit): boolean {
  return change.inclusion === "announce" || change.inclusion === "must-announce";
}

function isVisibleToEdition(claim: CanonicalClaim, edition: AudienceEdition): boolean {
  const profile = getAudienceProfile(edition.audience);
  return profile.allowedVisibilities.includes(claim.visibility);
}

function allEditionClaims(
  edition: AudienceEdition,
  changes: ChangeUnit[],
): Array<{ claim: CanonicalClaim; change: ChangeUnit }> {
  const claimIds = new Set(edition.blocks.flatMap((block) => block.claimIds));
  return changes.flatMap((change) =>
    change.claims
      .filter((claim) => claimIds.has(claim.id))
      .map((claim) => ({ claim, change })),
  );
}

function allEditionChangeIds(edition: AudienceEdition): Set<string> {
  return new Set(edition.blocks.flatMap((block) => block.changeIds));
}

function sourceCompletenessScore(completeness: SourceCompleteness): number {
  switch (completeness) {
    case "complete":
    case "not-applicable":
      return 100;
    case "partial":
      return 50;
    case "unknown":
      return 25;
  }
}

/**
 * Computes the V3 evidence-first quality report. It uses no model output and
 * records blockers separately so a high prose score can never waive a gate.
 */
export function evaluateChangelogQuality(
  input: QualityEvaluationInput,
  now: () => Date = () => new Date(),
): ChangelogQualityReport {
  const profile = getAudienceProfile(input.edition.audience);
  const includedChangeIds = allEditionChangeIds(input.edition);
  const includedChanges = input.changes.filter((change) => includedChangeIds.has(change.id));
  const claims = allEditionClaims(input.edition, input.changes);
  const availableEvidenceIds = input.availableEvidenceIds
    ? new Set(input.availableEvidenceIds)
    : undefined;
  const blockers: QualityBlocker[] = [];
  const tasks: QualityTask[] = [];

  const factualClaims = claims.filter(
    ({ claim }) => claim.certainty === "supported" || claim.certainty === "human-attested",
  );
  let groundedClaims = 0;
  for (const { claim, change } of claims) {
    if (claim.certainty !== "supported" && claim.certainty !== "human-attested") {
      continue;
    }
    const citationIsAvailable = claim.citations.every(
      (citation) => !availableEvidenceIds || availableEvidenceIds.has(citation.evidenceId),
    );
    const grounded = claim.citations.length > 0 && citationIsAvailable;
    if (grounded) groundedClaims += 1;

    if (!grounded) {
      blockers.push({
        code: "unsupported-public-claim",
        severity: input.edition.visibility === "public" ? "hard" : "warning",
        message: "A factual claim in this edition has no valid evidence citation.",
        changeId: change.id,
        claimId: claim.id,
      });
    }
    if (!isVisibleToEdition(claim, input.edition)) {
      blockers.push({
        code: "visibility-violation",
        severity: "hard",
        message: `Claim visibility (${claim.visibility}) is not permitted for the ${input.edition.audience} edition.`,
        changeId: change.id,
        claimId: claim.id,
      });
    }
  }

  const evidenceGrounding = createDimension(
    "evidenceGrounding",
    groundedClaims,
    factualClaims.length,
    factualClaims.length === 0 ? ["No factual claims are present in this edition."] : [],
  );

  let clearChanges = 0;
  for (const change of includedChanges) {
    const what = change.claims.find(
      (claim) =>
        claim.kind === "what" &&
        input.edition.blocks.some((block) => block.claimIds.includes(claim.id)),
    );
    if (what && isClearWhat(what.statement)) {
      clearChanges += 1;
    } else {
      tasks.push({
        code: "missing-what",
        message: "This announced change needs a concrete description of the affected behavior or surface.",
        changeId: change.id,
      });
    }
  }
  const whatChangedClarity = createDimension(
    "whatChangedClarity",
    clearChanges,
    includedChanges.length,
  );

  const impactEligibleChanges = includedChanges.filter(expectedImpact);
  let impactCovered = 0;
  for (const change of impactEligibleChanges) {
    const coverage = change.claims.some(
      (claim) =>
        (claim.kind === "why" || claim.kind === "impact") &&
        input.edition.blocks.some((block) => block.claimIds.includes(claim.id)) &&
        (claim.certainty === "supported" || claim.certainty === "human-attested"),
    );
    if (coverage) {
      impactCovered += 1;
    } else {
      tasks.push({
        code: "missing-impact",
        message: "This announced change lacks a supported rationale or impact statement for this audience.",
        changeId: change.id,
      });
    }
  }
  const whyImpactCoverage = createDimension(
    "whyImpactCoverage",
    impactCovered,
    impactEligibleChanges.length,
  );

  const migrationChanges = includedChanges.filter(
    (change) => change.migration.state === "required" || change.migration.state === "optional",
  );
  let actionableMigrations = 0;
  for (const change of migrationChanges) {
    const actionSteps = change.migration.actionSteps?.filter((step) => step.trim().length > 0) ?? [];
    if (actionSteps.length > 0) {
      actionableMigrations += 1;
    } else if (change.migration.state === "required") {
      blockers.push({
        code: "required-migration-missing",
        severity: "hard",
        message: "A required migration has no reviewed action steps.",
        changeId: change.id,
      });
    }
  }
  const migrationActionability = createDimension(
    "migrationActionability",
    actionableMigrations,
    migrationChanges.length,
  );

  let audienceFitPassed = 0;
  for (const change of includedChanges) {
    const eligible = change.claims.some(
      (claim) =>
        input.edition.blocks.some((block) => block.claimIds.includes(claim.id)) &&
        profile.allowedVisibilities.includes(claim.visibility),
    );
    if (eligible) audienceFitPassed += 1;
  }
  for (const change of input.changes) {
    if (
      change.inclusion === "must-announce" &&
      profile.includedDispositions.includes(change.inclusion) &&
      !includedChangeIds.has(change.id)
    ) {
      tasks.push({
        code: "audience-coverage",
        message: "A required announcement is missing from this audience edition.",
        changeId: change.id,
      });
    }
  }
  const audienceFit = createDimension("audienceFit", audienceFitPassed, includedChanges.length);

  const normalizedStatements = new Set<string>();
  let signalPassed = 0;
  for (const { claim, change } of claims) {
    const normalized = claim.statement.trim().toLocaleLowerCase();
    const duplicate = normalizedStatements.has(normalized);
    normalizedStatements.add(normalized);
    const noisy = change.inclusion === "internal-context" || change.inclusion === "exclude";
    if (!duplicate && !noisy) {
      signalPassed += 1;
    } else {
      tasks.push({
        code: "duplicate-copy",
        message: duplicate
          ? "Duplicate claim wording reduces signal-to-noise."
          : "Internal or excluded work should not appear in this audience edition.",
        changeId: change.id,
        claimId: claim.id,
      });
    }
  }
  const signalToNoise = createDimension("signalToNoise", signalPassed, claims.length);

  const completeness = input.sourceCompleteness ?? "unknown";
  const conflicts = input.unresolvedMappingConflicts ?? [];
  const highConflicts = conflicts.filter((conflict) => conflict.severity === "high");
  for (const conflict of highConflicts) {
    blockers.push({
      code: "mapping-conflict",
      severity: "hard",
      message: conflict.message ?? "An unresolved high-severity mapping conflict affects this release.",
      changeId: conflict.changeId,
    });
  }
  for (const conflict of conflicts) {
    tasks.push({
      code: "unresolved-mapping",
      message: conflict.message ?? "Resolve this mapping conflict before publication.",
      changeId: conflict.changeId,
    });
  }
  if (completeness !== "complete" && completeness !== "not-applicable") {
    tasks.push({
      code: "source-completeness",
      message: `Release source completeness is ${completeness}.`,
    });
    if (completeness === "partial") {
      blockers.push({
        code: "source-incomplete",
        severity: "warning",
        message: "Source scope is partial; publication policy may require an override.",
      });
    }
  }
  const completenessScore = Math.max(
    0,
    sourceCompletenessScore(completeness) - conflicts.length * 20,
  );
  const sourceMappingCompleteness: QualityDimensionResult = {
    dimension: "sourceMappingCompleteness",
    weight: QUALITY_DIMENSION_WEIGHTS.sourceMappingCompleteness,
    score: completenessScore,
    applicable: true,
    passed: completenessScore,
    total: 100,
    notes: [],
  };

  const dimensions = [
    evidenceGrounding,
    whatChangedClarity,
    whyImpactCoverage,
    migrationActionability,
    audienceFit,
    signalToNoise,
    sourceMappingCompleteness,
  ];
  const timestamp = now().toISOString();

  return {
    id: `quality_${input.edition.id}_${input.edition.revision}_${timestamp}`,
    editionId: input.edition.id,
    editionRevision: input.edition.revision,
    rubricVersion: QUALITY_RUBRIC_VERSION,
    score: normalizedScore(dimensions),
    dimensions,
    blockers,
    tasks,
    evaluatedAt: timestamp,
  };
}

/** A concise public name for deterministic V3 quality evaluation. */
export const scoreChangelogQuality = evaluateChangelogQuality;

export function hasHardQualityBlockers(report: ChangelogQualityReport): boolean {
  return report.blockers.some((blocker) => blocker.severity === "hard");
}

export function qualityPassesMinimum(
  report: ChangelogQualityReport,
  minimumScore: number,
): boolean {
  return report.score >= minimumScore && !hasHardQualityBlockers(report);
}

export function visibilityForEdition(edition: AudienceEdition): Visibility {
  return edition.visibility;
}
