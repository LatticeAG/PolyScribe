import { createHash } from "node:crypto";

export type EvidenceAuthority =
  | "delivery"
  | "intent"
  | "context"
  | "historical-publication"
  | "human-attestation"
  | "derived";

export type EvidenceSensitivity =
  | "public"
  | "internal"
  | "restricted"
  | "embargoed";

export type EvidenceOperation = "upsert" | "tombstone";

export interface ExternalEvidenceRef {
  readonly pluginId: string;
  readonly connectionId?: string;
  readonly objectKind: string;
  readonly externalId: string;
}

export interface EvidenceActor {
  readonly externalId: string;
  readonly login?: string;
  readonly displayName?: string;
  readonly url?: string;
}

export interface EvidenceContent {
  readonly title?: string;
  readonly excerpt?: string;
  readonly fields?: Readonly<Record<string, unknown>>;
}

export interface EvidenceObservationInput {
  readonly operation?: EvidenceOperation;
  readonly source: ExternalEvidenceRef;
  /** Provider revision, ETag, update timestamp, or immutable commit SHA. */
  readonly externalRevision: string;
  readonly canonicalUrl?: string;
  readonly observedAt: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly deletedAt?: string;
  readonly author?: EvidenceActor;
  readonly participants?: readonly EvidenceActor[];
  readonly content?: EvidenceContent;
  readonly authority: EvidenceAuthority;
  readonly sensitivity: EvidenceSensitivity;
  readonly contentHash?: string;
  readonly redactionPolicyVersion: string;
  readonly connectorVersion: string;
  readonly completeness?: "complete" | "partial" | "unknown" | "not-applicable";
}

export interface EvidenceObservation extends Omit<EvidenceObservationInput, "operation" | "contentHash"> {
  readonly operation: EvidenceOperation;
  readonly id: string;
  readonly contentHash: string;
}

export const EVIDENCE_RELATION_TYPES = [
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

export type EvidenceRelationType = (typeof EVIDENCE_RELATION_TYPES)[number];

export interface DirectRelationObservationInput {
  readonly from: ExternalEvidenceRef;
  readonly to: ExternalEvidenceRef;
  readonly type: EvidenceRelationType;
  readonly authority: EvidenceAuthority;
  readonly sourceRevision: string;
  readonly observedAt: string;
  readonly explanation?: string;
}

export interface DirectRelationObservation extends DirectRelationObservationInput {
  readonly method: "provider-direct";
  readonly confidence: 1;
  readonly id: string;
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry)) as T;
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = cloneValue(entry);
    }
    return result as T;
  }

  return value;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const key of Object.getOwnPropertyNames(value)) {
    const nested = (value as Record<string, unknown>)[key];
    deepFreeze(nested);
  }

  return Object.freeze(value);
}

function required(value: string, name: string): string {
  if (!value.trim()) throw new Error(`${name} is required`);
  return value;
}

export function evidenceRefKey(reference: ExternalEvidenceRef): string {
  return [
    reference.pluginId,
    reference.connectionId ?? "global",
    reference.objectKind,
    reference.externalId,
  ].join(":");
}

export function evidenceObservationId(
  source: ExternalEvidenceRef,
  externalRevision: string,
): string {
  return `ev:${evidenceRefKey(source)}@${externalRevision}`;
}

function stableJson(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value ?? null);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

function defaultContentHash(input: EvidenceObservationInput): string {
  const material = {
    source: input.source,
    externalRevision: input.externalRevision,
    canonicalUrl: input.canonicalUrl,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    deletedAt: input.deletedAt,
    content: input.content,
  };
  return `sha256:${createHash("sha256").update(stableJson(material), "utf8").digest("hex")}`;
}

/**
 * Produces a detached, deeply frozen observation. The host can persist the
 * immutable observation as a provider revision before deriving any claims.
 */
export function createEvidenceObservation(
  input: EvidenceObservationInput,
): EvidenceObservation {
  required(input.source.pluginId, "source.pluginId");
  required(input.source.objectKind, "source.objectKind");
  required(input.source.externalId, "source.externalId");
  required(input.externalRevision, "externalRevision");
  required(input.observedAt, "observedAt");
  required(input.redactionPolicyVersion, "redactionPolicyVersion");
  required(input.connectorVersion, "connectorVersion");

  const operation = input.operation ?? "upsert";
  if (operation === "tombstone" && !input.deletedAt) {
    throw new Error("Tombstone observations require deletedAt");
  }

  const source = cloneValue(input.source);
  const observation: EvidenceObservation = {
    operation,
    source,
    externalRevision: input.externalRevision,
    canonicalUrl: input.canonicalUrl,
    observedAt: input.observedAt,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    deletedAt: input.deletedAt,
    author: input.author ? cloneValue(input.author) : undefined,
    participants: input.participants
      ? cloneValue([...input.participants])
      : undefined,
    content: input.content ? cloneValue(input.content) : undefined,
    authority: input.authority,
    sensitivity: input.sensitivity,
    contentHash: input.contentHash ?? defaultContentHash(input),
    redactionPolicyVersion: input.redactionPolicyVersion,
    connectorVersion: input.connectorVersion,
    completeness: input.completeness ?? "complete",
    id: evidenceObservationId(source, input.externalRevision),
  };

  return deepFreeze(observation);
}

export function createEvidenceTombstone(
  input: Omit<EvidenceObservationInput, "operation" | "deletedAt"> & {
    readonly deletedAt: string;
  },
): EvidenceObservation {
  return createEvidenceObservation({ ...input, operation: "tombstone" });
}

export function isEvidenceTombstone(
  observation: EvidenceObservation,
): boolean {
  return observation.operation === "tombstone";
}

export function createDirectRelationObservation(
  input: DirectRelationObservationInput,
): DirectRelationObservation {
  required(input.from.pluginId, "from.pluginId");
  required(input.from.objectKind, "from.objectKind");
  required(input.from.externalId, "from.externalId");
  required(input.to.pluginId, "to.pluginId");
  required(input.to.objectKind, "to.objectKind");
  required(input.to.externalId, "to.externalId");
  required(input.sourceRevision, "sourceRevision");
  required(input.observedAt, "observedAt");

  const from = cloneValue(input.from);
  const to = cloneValue(input.to);
  const relation: DirectRelationObservation = {
    ...input,
    from,
    to,
    method: "provider-direct",
    confidence: 1,
    id: [
      "rel",
      evidenceRefKey(from),
      input.type,
      evidenceRefKey(to),
      input.sourceRevision,
    ].join(":"),
  };

  return deepFreeze(relation);
}
