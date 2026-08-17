import { describe, expect, it } from "vitest";
import {
  createEvidenceObservation,
  createEvidenceTombstone,
  isEvidenceTombstone,
} from "../src/evidence.js";

const base = {
  source: {
    pluginId: "io.polyscribe.github",
    connectionId: "conn_1",
    objectKind: "pull_request",
    externalId: "128",
  },
  externalRevision: "2026-07-21T10:00:00Z",
  observedAt: "2026-07-21T10:01:00Z",
  authority: "delivery" as const,
  sensitivity: "public" as const,
  redactionPolicyVersion: "redaction@1",
  connectorVersion: "1.0.0",
};

describe("immutable evidence observations", () => {
  it("detaches and deeply freezes an upsert", () => {
    const fields = { labels: ["feature"] };
    const observation = createEvidenceObservation({
      ...base,
      content: { title: "Add widgets", fields },
    });
    fields.labels.push("later-change");

    expect(observation.id).toContain("io.polyscribe.github:conn_1:pull_request:128@");
    expect(observation.content?.fields).toEqual({ labels: ["feature"] });
    expect(observation.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(Object.isFrozen(observation)).toBe(true);
    expect(Object.isFrozen(observation.content?.fields)).toBe(true);
  });

  it("models deletion as an immutable tombstone", () => {
    const tombstone = createEvidenceTombstone({
      ...base,
      deletedAt: "2026-07-21T11:00:00Z",
    });

    expect(isEvidenceTombstone(tombstone)).toBe(true);
    expect(tombstone.deletedAt).toBe("2026-07-21T11:00:00Z");
  });
});
