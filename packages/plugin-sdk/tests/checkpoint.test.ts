import { describe, expect, it } from "vitest";
import { commitCheckpoint } from "../src/checkpoint.js";

describe("connector checkpoint commits", () => {
  const base = {
    connectorId: "io.polyscribe.github",
    connectionId: "conn_github",
    nextCursor: "cursor-2",
    watermark: "2026-07-21T00:00:00Z",
    expectedOperationIds: ["upsert:pr:1", "tombstone:issue:2"],
    committedAt: "2026-07-21T00:01:00Z",
  };

  it("does not advance a cursor until every operation, including tombstones, is durable", () => {
    const result = commitCheckpoint({
      ...base,
      durableOperationIds: ["upsert:pr:1"],
      partial: false,
    });

    expect(result.committed).toBe(false);
    expect(result.checkpoint).toBeUndefined();
    expect(result.diagnostics[0]?.retryable).toBe(true);
  });

  it("allows a durable partial sync only when the incomplete scope is explicit", () => {
    const result = commitCheckpoint({
      ...base,
      durableOperationIds: base.expectedOperationIds,
      partial: true,
      incompleteScopes: ["repository:acme/demo"],
    });

    expect(result).toMatchObject({
      committed: true,
      checkpoint: { cursor: "cursor-2", connectionId: "conn_github" },
    });
  });

  it("rejects a partial sync that hides its incomplete scope", () => {
    const result = commitCheckpoint({
      ...base,
      durableOperationIds: base.expectedOperationIds,
      partial: true,
    });

    expect(result.committed).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("scope_incomplete");
  });
});
