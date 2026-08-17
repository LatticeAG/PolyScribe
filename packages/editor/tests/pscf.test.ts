import { describe, expect, it } from "vitest";
import {
  PSCF_SCHEMA_URL,
  PSCF_SPEC_VERSION,
  type PscfReleaseContentRevision,
} from "@polyscribe/schema";
import { reviewDocumentFromPscf } from "../src/pscf.js";

describe("PSCF editor adapter", () => {
  it("turns an immutable PSCF revision into a document-first review model", () => {
    const document: PscfReleaseContentRevision = {
      $schema: PSCF_SCHEMA_URL,
      specVersion: PSCF_SPEC_VERSION,
      documentId: "rel_1",
      revisionId: "rev_1",
      createdAt: "2026-07-21T00:00:00.000Z",
      updatedAt: "2026-07-21T00:00:00.000Z",
      release: { repositoryId: "repo_1", version: "1.0.0", status: "review" },
      snapshot: {
        snapshotId: "snap_1",
        completeness: "complete",
        evidence: [{ evidenceId: "ev_1", revision: "r1", visibility: "public" }],
      },
      changeSet: {
        snapshotId: "snap_1",
        changes: [{
          changeId: "chg_1",
          categories: ["added"],
          impact: "medium",
          inclusion: "announce",
          visibility: "public",
          deliveryEvidence: ["ev_1"],
          claims: [{
            claimId: "clm_1",
            kind: "what",
            statement: "Adds retry controls.",
            certainty: "supported",
            citations: [{ evidence: "ev_1", locator: { field: "body" }, supports: "direct" }],
          }],
        }],
      },
      editions: [{
        editionId: "ed_user_1",
        audience: "user",
        baseChangeSetRevision: "snap_1",
        revision: 1,
        status: "draft",
        blocks: [{ blockId: "blk_1", section: "What's new", claimIds: ["clm_1"], markdown: "- Adds retry controls." }],
      }],
    };

    const review = reviewDocumentFromPscf(document);
    expect(review.release.version).toBe("1.0.0");
    expect(review.editions[0]?.blocks[0]?.claimIds).toEqual(["clm_1"]);
    expect(review.claims[0]?.citations?.[0]?.evidenceId).toBe("ev_1");
  });
});
