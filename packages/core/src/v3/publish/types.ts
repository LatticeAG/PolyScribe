/**
 * Additive V3 publication contracts.
 *
 * These types intentionally model delivery separately from a release document:
 * a PSCF revision remains immutable while plans and receipts live in a ledger.
 */
import { createHash } from "node:crypto";

export type PublicationAudience = "developer" | "user" | "executive" | (string & {});

export type PublicationVisibility =
  | "public"
  | "workspace"
  | "restricted"
  | "embargoed";

export type PublicationAttemptStatus =
  | "planned"
  | "scheduled"
  | "publishing"
  | "succeeded"
  | "unknown"
  | "retryable_failed"
  | "failed"
  | "superseded";

export interface RenderedEditionArtifact {
  /** Immutable PSCF content-revision identifier. */
  contentRevisionId: string;
  /** Audience edition revision identifier. */
  editionRevisionId: string;
  audience: PublicationAudience;
  visibility: PublicationVisibility;
  /** Deterministic target projection, never raw evidence. */
  content: string;
  /** SHA-256 digest of the exact rendered content. */
  contentHash: string;
  templateVersion: string;
}

export interface PublicationPlan<TConfig = Record<string, unknown>> {
  planId: string;
  targetId: string;
  targetKind: string;
  artifact: RenderedEditionArtifact;
  configuration: TConfig;
  idempotencyKey: string;
  createdAt: string;
  scheduledFor?: string;
  /** Publishing is permitted only after the calling workflow records approval. */
  approved: boolean;
}

export interface PublicationValidation {
  ok: boolean;
  warnings: string[];
  blockers: string[];
}

export interface PublicationReceipt {
  status: Extract<PublicationAttemptStatus, "succeeded" | "unknown" | "retryable_failed" | "failed">;
  targetId: string;
  idempotencyKey: string;
  contentHash: string;
  publishedAt?: string;
  remoteId?: string;
  remoteUrl?: string;
  /** A target-safe diagnostic. Never place remote response bodies here. */
  message?: string;
  retryable?: boolean;
}

export interface PublicationTarget<TConfig = Record<string, unknown>> {
  readonly id: string;
  readonly kind: string;
  validate(plan: PublicationPlan<TConfig>): Promise<PublicationValidation> | PublicationValidation;
  preview(plan: PublicationPlan<TConfig>): Promise<RenderedEditionArtifact> | RenderedEditionArtifact;
  publish(plan: PublicationPlan<TConfig>): Promise<PublicationReceipt>;
  reconcile?(plan: PublicationPlan<TConfig>): Promise<PublicationReceipt | undefined>;
}

export function hasValidArtifactHash(artifact: RenderedEditionArtifact): boolean {
  const expected = `sha256:${createHash("sha256").update(artifact.content).digest("hex")}`;
  return artifact.contentHash === expected;
}

export interface PublicationLedgerEntry<TConfig = unknown> {
  plan: PublicationPlan<TConfig>;
  attempts: PublicationReceipt[];
}

export class InMemoryPublicationLedger {
  private readonly entries = new Map<string, PublicationLedgerEntry<unknown>>();

  recordPlan<TConfig>(plan: PublicationPlan<TConfig>): void {
    if (!this.entries.has(plan.planId)) {
      this.entries.set(plan.planId, { plan, attempts: [] });
    }
  }

  recordReceipt(planId: string, receipt: PublicationReceipt): void {
    const entry = this.entries.get(planId);
    if (!entry) {
      throw new Error(`Cannot record a receipt for unknown publication plan ${planId}`);
    }
    entry.attempts.push(receipt);
  }

  get(planId: string): PublicationLedgerEntry<unknown> | undefined {
    const entry = this.entries.get(planId);
    return entry
      ? { plan: entry.plan, attempts: [...entry.attempts] }
      : undefined;
  }
}
