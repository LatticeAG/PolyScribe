import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  canonicalizePolyMeshEnvelope,
  createPolyMeshEnvelope,
  createPolyMeshReleaseTransport,
  signPolyMeshEnvelope,
} from "../src/v3/mesh/index.js";

function envelopeInput() {
  return {
    eventId: "evt_123",
    type: "polyscribe.release.approved.v1" as const,
    envelopeVersion: "polyscribe/mesh@1" as const,
    occurredAt: "2026-07-21T00:00:00.000Z",
    idempotencyKey: "idem_123",
    release: {
      documentId: "rel_123",
      revisionId: "rev_123",
      version: "1.2.3",
      audience: "developer",
    },
    content: {
      claims: [{ claimId: "clm_123", statement: "Adds retry controls.", kind: "what", visibility: "public" as const }],
    },
    provenance: {
      pscfCanonicalHash: "sha256:pscf",
      editionRevisionId: "ed_123",
      qualityBand: "good" as const,
    },
    evidenceReferences: ["ev_io.polyscribe.github_pr_128_r4"],
    routing: { audience: "developer", visibility: "workspace" as const },
  };
}

describe("PolyMesh V3 transport", () => {
  it("creates a deterministic signed envelope without raw evidence payloads", () => {
    const envelope = createPolyMeshEnvelope(envelopeInput());
    const pair = generateKeyPairSync("ed25519");
    const signed = signPolyMeshEnvelope(envelope, pair.privateKey, "key_2026");
    const payload = canonicalizePolyMeshEnvelope({
      eventId: signed.eventId,
      type: signed.type,
      envelopeVersion: signed.envelopeVersion,
      occurredAt: signed.occurredAt,
      idempotencyKey: signed.idempotencyKey,
      release: signed.release,
      content: signed.content,
      provenance: signed.provenance,
      evidenceReferences: signed.evidenceReferences,
      routing: signed.routing,
    });

    expect(signed.integrity.canonicalHash).toMatch(/^sha256:/);
    expect(signed.integrity.signature).toBeDefined();
    expect(verify(null, Buffer.from(payload), pair.publicKey, Buffer.from(signed.integrity.signature!, "base64url"))).toBe(true);
  });

  it("dispatches through the installed PolyMesh client contract with the event idempotency key", async () => {
    const client = {
      call: vi.fn().mockResolvedValue({
        status: "accepted",
        acknowledgedAt: "2026-07-21T01:00:00.000Z",
        consumerReference: "consumer_1",
      }),
    };
    const transport = createPolyMeshReleaseTransport(client);
    const envelope = createPolyMeshEnvelope(envelopeInput());

    await expect(transport.dispatch(envelope, { targetAgentId: "release-bot" })).resolves.toEqual({
      eventId: "evt_123",
      targetAgentId: "release-bot",
      status: "accepted",
      acknowledgedAt: "2026-07-21T01:00:00.000Z",
      consumerReference: "consumer_1",
      message: undefined,
    });
    expect(client.call).toHaveBeenCalledWith(
      "release-bot",
      "polyscribe.release.publish.v1",
      expect.objectContaining({ eventId: "evt_123" }),
      expect.objectContaining({ taskId: "evt_123", idempotencyKey: "idem_123" }),
    );
  });

  it("rejects evidence references that look like copied source excerpts", () => {
    expect(() => createPolyMeshEnvelope({ ...envelopeInput(), evidenceReferences: ["a private source excerpt"] })).toThrow(/opaque identifiers/i);
  });
});
