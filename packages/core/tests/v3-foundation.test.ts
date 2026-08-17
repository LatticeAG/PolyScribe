import { describe, expect, it } from "vitest";
import type { LLMClient, LLMCompleteInput } from "../src/draft/llm/client.js";
import {
  SummaryValidationError,
  applyChangelogSummary,
  summarizeChangelog,
} from "../src/v3/ai/summarize.js";
import { createAudienceEdition, reviseAudienceEdition } from "../src/v3/audiences.js";
import type { ChangeUnit, EvidenceRecord } from "../src/v3/domain.js";
import { evaluateChangelogQuality } from "../src/v3/quality.js";

const evidence: EvidenceRecord = {
  id: "ev_github_pr_42",
  source: {
    pluginId: "io.polyscribe.github",
    connectionId: "github-main",
    objectKind: "pull-request",
    externalId: "42",
    revision: "r1",
  },
  observedAt: "2026-07-21T00:00:00.000Z",
  authority: "delivery",
  visibility: "public",
  state: "available",
  title: "Add retry controls",
  excerpt: "Adds configurable retry handling for webhook delivery failures.",
};

function change(migrationState: ChangeUnit["migration"]["state"] = "none"): ChangeUnit {
  return {
    id: "chg_retry_controls",
    evidenceIds: [evidence.id],
    deliveryEvidenceIds: [evidence.id],
    categories: ["added"],
    impact: "medium",
    inclusion: "announce",
    visibility: "public",
    claims: [],
    migration: { state: migrationState },
  };
}

function mockClient(citationEvidenceId = evidence.id): LLMClient {
  return {
    provider: "test",
    model: "test-model",
    async completeStructured<T>(input: LLMCompleteInput<T>): Promise<T> {
      return input.schema.parse({
        changes: [
          {
            changeId: "chg_retry_controls",
            claims: [
              {
                kind: "what",
                statement: "Adds configurable retry controls for webhook deliveries.",
                certainty: "supported",
                citationEvidenceIds: [citationEvidenceId],
              },
              {
                kind: "impact",
                statement: "Makes failed webhook delivery recovery configurable for operators.",
                certainty: "supported",
                citationEvidenceIds: [citationEvidenceId],
              },
            ],
          },
        ],
      });
    },
  };
}

describe("V3 foundation", () => {
  it("extracts evidence-linked canonical claims through the existing LLM adapter", async () => {
    const summary = await summarizeChangelog(
      {
        releaseId: "rel_1",
        snapshotId: "snapshot_1",
        changes: [change()],
        evidence: [evidence],
        now: () => new Date("2026-07-21T00:00:00.000Z"),
      },
      mockClient(),
    );

    expect(summary.generation.taskType).toBe("fact-extraction");
    expect(summary.changes[0]?.claims[0]?.citations[0]).toMatchObject({
      evidenceId: evidence.id,
      evidenceRevision: "r1",
    });
    expect(applyChangelogSummary([change()], summary)[0]?.claims).toHaveLength(2);
  });

  it("rejects a model citation that is not mapped to the change", async () => {
    await expect(
      summarizeChangelog(
        {
          releaseId: "rel_1",
          snapshotId: "snapshot_1",
          changes: [change()],
          evidence: [evidence],
        },
        mockClient("ev_not_mapped"),
      ),
    ).rejects.toBeInstanceOf(SummaryValidationError);
  });

  it("does not let context-only evidence establish a shipped what-changed claim", async () => {
    const contextualEvidence: EvidenceRecord = {
      ...evidence,
      id: "ev_context_thread_1",
      authority: "context",
      source: {
        ...evidence.source,
        pluginId: "io.polyscribe.slack",
        objectKind: "thread",
        externalId: "thread_1",
      },
    };
    const contextualChange: ChangeUnit = {
      ...change(),
      evidenceIds: [contextualEvidence.id],
      deliveryEvidenceIds: [contextualEvidence.id],
    };

    await expect(
      summarizeChangelog(
        {
          releaseId: "rel_1",
          snapshotId: "snapshot_1",
          changes: [contextualChange],
          evidence: [contextualEvidence],
        },
        mockClient(contextualEvidence.id),
      ),
    ).rejects.toBeInstanceOf(SummaryValidationError);
  });

  it("creates linked audience editions and invalidates approval on revision", async () => {
    const summary = await summarizeChangelog(
      {
        releaseId: "rel_1",
        snapshotId: "snapshot_1",
        changes: [change()],
        evidence: [evidence],
      },
      mockClient(),
    );
    const changes = applyChangelogSummary([change()], summary);
    const edition = createAudienceEdition({
      releaseId: "rel_1",
      baseChangeSetRevision: "snapshot_1",
      audience: "user",
      changes,
      now: () => new Date("2026-07-21T00:00:00.000Z"),
    });
    const revised = reviseAudienceEdition(
      { ...edition, status: "approved", approval: { actorId: "a", approvedAt: "now", policyVersion: "v1" } },
      {},
      () => new Date("2026-07-22T00:00:00.000Z"),
    );

    expect(edition.blocks[0]?.claimIds).toHaveLength(2);
    expect(revised.revision).toBe(2);
    expect(revised.status).toBe("draft");
    expect(revised.approval).toBeUndefined();
  });

  it("makes missing required migrations a hard quality blocker", async () => {
    const summary = await summarizeChangelog(
      {
        releaseId: "rel_1",
        snapshotId: "snapshot_1",
        changes: [change("required")],
        evidence: [evidence],
      },
      mockClient(),
    );
    const changes = applyChangelogSummary([change("required")], summary);
    const edition = createAudienceEdition({
      releaseId: "rel_1",
      baseChangeSetRevision: "snapshot_1",
      audience: "developer",
      changes,
    });
    const report = evaluateChangelogQuality({
      edition,
      changes,
      sourceCompleteness: "complete",
      availableEvidenceIds: [evidence.id],
    });

    expect(report.blockers).toContainEqual(
      expect.objectContaining({ code: "required-migration-missing", severity: "hard" }),
    );
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });
});
