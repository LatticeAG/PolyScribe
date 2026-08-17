import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  PSCF_SCHEMA_URL,
  PSCF_SPEC_VERSION,
  calculatePscfCanonicalHash,
  canonicalizeJson,
  signPscfDocument,
  validatePscf,
  verifyPscfCanonicalHash,
  verifyPscfSignature,
  withPscfCanonicalHash,
  type PscfReleaseContentRevision,
} from "../src/index.js";

function createDocument(): PscfReleaseContentRevision {
  return {
    $schema: PSCF_SCHEMA_URL,
    specVersion: PSCF_SPEC_VERSION,
    documentId: "rel_01",
    revisionId: "rev_01",
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
    release: {
      repositoryId: "repo_01",
      version: "1.0.0",
      status: "draft",
    },
    snapshot: {
      snapshotId: "snapshot_01",
      completeness: "complete",
      evidence: [{ evidenceId: "ev_01", revision: "r1", visibility: "public" }],
    },
    changeSet: {
      snapshotId: "snapshot_01",
      completeness: "complete",
      changes: [
        {
          changeId: "chg_01",
          categories: ["added"],
          impact: "medium",
          inclusion: "announce",
          visibility: "public",
          deliveryEvidence: ["ev_01"],
          claims: [
            {
              claimId: "clm_01",
              kind: "what",
              statement: "Adds configurable retry handling for webhook deliveries.",
              certainty: "supported",
              citations: [
                {
                  evidence: "ev_01",
                  locator: { field: "body", fragmentHash: "sha256:example" },
                  supports: "direct",
                  visibility: "public",
                },
              ],
              visibility: "public",
            },
          ],
          migration: { state: "none" },
        },
      ],
    },
    editions: [
      {
        editionId: "ed_dev_01",
        audience: "developer",
        baseChangeSetRevision: "snapshot_01",
        revision: 1,
        status: "draft",
        visibility: "public",
        blocks: [
          {
            blockId: "blk_01",
            section: "Added",
            claimIds: ["clm_01"],
            changeIds: ["chg_01"],
            markdown: "- Adds configurable retry handling for webhook deliveries.",
          },
        ],
      },
    ],
  };
}

describe("PSCF v1", () => {
  it("validates a canonical, evidence-linked release revision", () => {
    const document = withPscfCanonicalHash(createDocument());

    expect(validatePscf(document)).toMatchObject({ valid: true, issues: [] });
    expect(verifyPscfCanonicalHash(document)).toBe(true);
  });

  it("uses stable canonical JSON independent of object insertion order", () => {
    expect(canonicalizeJson({ z: 1, a: { y: true, b: "value" } })).toBe(
      canonicalizeJson({ a: { b: "value", y: true }, z: 1 }),
    );

    const document = createDocument();
    const hash = calculatePscfCanonicalHash(document);
    expect(calculatePscfCanonicalHash({ ...document, integrity: { canonicalHash: "sha256:old" } })).toBe(hash);
  });

  it("reports semantic reference and migration violations", () => {
    const document = createDocument();
    document.changeSet.changes[0]!.migration = { state: "required" };
    document.editions[0]!.blocks[0]!.claimIds = ["missing_claim"];

    const result = validatePscf(document);
    expect(result.valid).toBe(false);
    expect(result.semanticIssues.map((issue) => issue.code)).toContain("missing-migration-action");
    expect(result.semanticIssues.map((issue) => issue.code)).toContain("unknown-reference");
  });

  it("rejects unknown core fields while preserving the namespaced extensions map", () => {
    const document = createDocument() as PscfReleaseContentRevision & { unexpected?: string };
    document.unexpected = "must not be silently accepted";

    const result = validatePscf(document);
    expect(result.valid).toBe(false);
    expect(result.structuralIssues).toContainEqual(
      expect.objectContaining({ code: "unknown-field", path: "$.unexpected" }),
    );
  });

  it("signs and verifies the immutable PSCF content payload", () => {
    const pair = generateKeyPairSync("ed25519");
    const signed = signPscfDocument(
      createDocument(),
      pair.privateKey,
      "workspace-key-2026",
      "2026-07-21T00:00:00.000Z",
    );

    expect(verifyPscfSignature(signed, pair.publicKey)).toBe(true);
    expect(verifyPscfSignature({
      ...signed,
      changeSet: { ...signed.changeSet, snapshotId: "tampered" },
    }, pair.publicKey)).toBe(false);
  });
});
