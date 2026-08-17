import type {
  EvidenceRelationType,
  MappingCandidate,
  MappingConfidenceBand,
  MappingMethod,
  MappingStatus,
} from "./domain.js";

/** Reproducible initial policy from V3-SPEC §8.4.1. */
export const MAPPING_POLICY_VERSION = "v3-mapping@1" as const;

export type MappingSignalKind =
  | "provider-direct"
  | "exact-sha"
  | "git-trailer"
  | "issue-key"
  | "branch"
  | "heuristic"
  | "outside-scope"
  | "incompatible-component"
  | "known-duplicate"
  | "explicit-reject"
  | "revert-or-supersede";

export interface MappingSignal {
  kind: MappingSignalKind;
  /** Optional evidence label used in reviewer-facing explanations. */
  detail?: string;
}

export interface MappingScore {
  score: number;
  band: MappingConfidenceBand;
  eligible: boolean;
  requiresConflictReview: boolean;
  components: Record<MappingSignalKind, number>;
  explanation: string[];
}

export interface CreateMappingCandidateInput {
  id: string;
  fromEvidenceId: string;
  toEvidenceId: string;
  relationType: EvidenceRelationType;
  method: MappingMethod;
  signals: MappingSignal[];
  releaseScopeId?: string;
}

export interface AutoAcceptMappingOptions {
  componentScopeMatches: boolean;
  conflictingPrimaryOwner?: boolean;
  /** Difference from the next best eligible candidate for the same owner. */
  leadOverNextCandidate?: number;
}

export type MappingConflictClass =
  | "multiple-primary-owners"
  | "release-boundary"
  | "revert-or-supersede"
  | "component-ambiguity";

export interface MappingConflictGroup {
  id: string;
  type: MappingConflictClass;
  candidateIds: string[];
  message: string;
}

const BASE_SCORES: Record<Exclude<MappingSignalKind,
  "outside-scope" | "incompatible-component" | "known-duplicate" | "explicit-reject" | "revert-or-supersede">, number> = {
  "provider-direct": 100,
  "exact-sha": 98,
  "git-trailer": 90,
  "issue-key": 75,
  branch: 70,
  heuristic: 50,
};

const INELIGIBLE_SIGNALS = new Set<MappingSignalKind>([
  "outside-scope",
  "incompatible-component",
  "known-duplicate",
  "explicit-reject",
]);

type ScoredMappingSignalKind = keyof typeof BASE_SCORES;

function isScoredMappingSignal(kind: MappingSignalKind): kind is ScoredMappingSignalKind {
  return kind in BASE_SCORES;
}

/**
 * Scores only the strongest deterministic proof. Weak signals never combine
 * into a high-confidence mapping, keeping semantic similarity advisory.
 */
export function scoreMappingSignals(signals: MappingSignal[]): MappingScore {
  const components = {} as Record<MappingSignalKind, number>;
  const explanation: string[] = [];
  let eligible = true;
  let requiresConflictReview = false;
  let score = 0;

  for (const signal of signals) {
    if (INELIGIBLE_SIGNALS.has(signal.kind)) {
      eligible = false;
      components[signal.kind] = 0;
      explanation.push(signal.detail ?? `${signal.kind} makes this candidate ineligible`);
      continue;
    }
    if (signal.kind === "revert-or-supersede") {
      requiresConflictReview = true;
      components[signal.kind] = 0;
      explanation.push(signal.detail ?? "Revert or supersession needs an explicit inclusion decision");
      continue;
    }
    if (!isScoredMappingSignal(signal.kind)) {
      continue;
    }
    const baseScore = BASE_SCORES[signal.kind];
    components[signal.kind] = baseScore;
    if (baseScore > score) {
      score = baseScore;
    }
    explanation.push(signal.detail ?? `${signal.kind} provides ${baseScore} confidence`);
  }

  if (!eligible) score = 0;
  const band: MappingConfidenceBand = score >= 95 ? "high" : score >= 70 ? "medium" : "low";
  return { score, band, eligible, requiresConflictReview, components, explanation };
}

export function createMappingCandidate(
  input: CreateMappingCandidateInput,
): MappingCandidate {
  const score = scoreMappingSignals(input.signals);
  return {
    id: input.id,
    fromEvidenceId: input.fromEvidenceId,
    toEvidenceId: input.toEvidenceId,
    relationType: input.relationType,
    method: input.method,
    confidence: score.score,
    confidenceBand: score.band,
    status: score.eligible && !score.requiresConflictReview ? "proposed" : "conflicted",
    scoreComponents: score.components,
    releaseScopeId: input.releaseScopeId,
    explanation: score.explanation.join("; "),
  };
}

/** Exact/direct mappings auto-accept only when there is no ambiguity. */
export function canAutoAcceptMapping(
  candidate: MappingCandidate,
  options: AutoAcceptMappingOptions,
): boolean {
  return candidate.status === "proposed"
    && candidate.confidence >= 95
    && options.componentScopeMatches
    && !options.conflictingPrimaryOwner
    && (options.leadOverNextCandidate === undefined || options.leadOverNextCandidate >= 10);
}

export function resolveMappingCandidate(
  candidate: MappingCandidate,
  status: Extract<MappingStatus, "accepted" | "rejected" | "conflicted" | "superseded">,
  reason: string,
): MappingCandidate {
  if (!reason.trim()) {
    throw new Error("A mapping resolution requires an auditable reason");
  }
  return { ...candidate, status, explanation: reason };
}

/** Finds review groups without silently deduplicating potentially distinct work. */
export function detectMappingConflicts(
  candidates: MappingCandidate[],
): MappingConflictGroup[] {
  const groups: MappingConflictGroup[] = [];
  const byTarget = new Map<string, MappingCandidate[]>();
  for (const candidate of candidates) {
    const group = byTarget.get(candidate.toEvidenceId) ?? [];
    group.push(candidate);
    byTarget.set(candidate.toEvidenceId, group);
  }
  for (const [targetId, group] of byTarget) {
    const primary = group.filter((candidate) => candidate.confidence >= 70 && candidate.status !== "rejected");
    if (primary.length > 1) {
      groups.push({
        id: `conf_primary_${targetId}`,
        type: "multiple-primary-owners",
        candidateIds: primary.map((candidate) => candidate.id),
        message: "More than one plausible primary owner maps to the same evidence.",
      });
    }
  }
  for (const candidate of candidates) {
    if (candidate.status === "conflicted" && candidate.explanation?.toLowerCase().includes("revert")) {
      groups.push({
        id: `conf_revert_${candidate.id}`,
        type: "revert-or-supersede",
        candidateIds: [candidate.id],
        message: candidate.explanation,
      });
    }
  }
  return groups;
}
