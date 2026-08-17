import { createHash, sign, type KeyObject } from "node:crypto";

export type PolyMeshReleaseEventType =
  | "polyscribe.release.approved.v1"
  | "polyscribe.release.published.v1"
  | "polyscribe.release.corrected.v1"
  | "polyscribe.release.revoked.v1";

export interface PolyMeshReleaseClaim {
  claimId: string;
  statement: string;
  kind: string;
  visibility: "public" | "workspace" | "restricted" | "embargoed";
}

export interface PolyMeshReleaseEnvelope {
  eventId: string;
  type: PolyMeshReleaseEventType;
  envelopeVersion: "polyscribe/mesh@1";
  occurredAt: string;
  idempotencyKey: string;
  release: {
    documentId: string;
    revisionId: string;
    version?: string;
    component?: string;
    audience: string;
    supersedes?: string;
  };
  content: {
    claims: PolyMeshReleaseClaim[];
    summary?: string;
    migrations?: Array<{ state: string; action?: string }>;
  };
  provenance: {
    pscfCanonicalHash: string;
    editionRevisionId: string;
    qualityBand: "excellent" | "good" | "needs-review";
  };
  /** Opaque identifiers only: raw source evidence is never placed in an envelope. */
  evidenceReferences: string[];
  routing: {
    audience: string;
    visibility: "public" | "workspace" | "restricted" | "embargoed";
    components?: string[];
    expiresAt?: string;
    originChain?: string[];
  };
  integrity: {
    canonicalHash: string;
    algorithm?: "Ed25519";
    keyId?: string;
    signature?: string;
  };
}

export interface CreatePolyMeshEnvelopeInput extends Omit<PolyMeshReleaseEnvelope, "integrity"> {
  integrity?: Partial<PolyMeshReleaseEnvelope["integrity"]>;
}

/** A small deterministic serializer suitable for envelope integrity checks. */
export function canonicalizePolyMeshEnvelope(
  envelope: Omit<PolyMeshReleaseEnvelope, "integrity">,
): string {
  return canonicalJson(envelope);
}

export function createPolyMeshEnvelope(input: CreatePolyMeshEnvelopeInput): PolyMeshReleaseEnvelope {
  assertEnvelopeDoesNotContainRawEvidence(input);
  const unsigned = stripIntegrity(input);
  const canonicalHash = sha256(canonicalizePolyMeshEnvelope(unsigned));
  return {
    ...unsigned,
    integrity: { ...input.integrity, canonicalHash },
  };
}

export function signPolyMeshEnvelope(
  envelope: PolyMeshReleaseEnvelope,
  privateKey: string | Buffer | KeyObject,
  keyId: string,
): PolyMeshReleaseEnvelope {
  const unsigned = stripIntegrity(envelope);
  const payload = canonicalizePolyMeshEnvelope(unsigned);
  const signature = sign(null, Buffer.from(payload), privateKey).toString("base64url");
  return {
    ...envelope,
    integrity: {
      canonicalHash: sha256(payload),
      algorithm: "Ed25519",
      keyId,
      signature,
    },
  };
}

export function assertEnvelopeDoesNotContainRawEvidence(
  envelope: Pick<PolyMeshReleaseEnvelope, "evidenceReferences">,
): void {
  for (const reference of envelope.evidenceReferences) {
    if (/\s/.test(reference) || reference.length > 512) {
      throw new Error("PolyMesh evidence references must be opaque identifiers or URLs without raw excerpts.");
    }
  }
}

function stripIntegrity(input: CreatePolyMeshEnvelopeInput | PolyMeshReleaseEnvelope): Omit<PolyMeshReleaseEnvelope, "integrity"> {
  const unsigned = { ...input } as Partial<PolyMeshReleaseEnvelope>;
  delete unsigned.integrity;
  return unsigned as Omit<PolyMeshReleaseEnvelope, "integrity">;
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
}
