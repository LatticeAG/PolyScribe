import type { ReviewDocument } from "../src/types.js";

export function createReviewDocument(): ReviewDocument {
  return {
    id: "rel_01",
    revisionId: "rev_01",
    release: {
      id: "rel_01",
      version: "2.4.0",
      component: "api",
      range: { from: "v2.3.0", to: "v2.4.0" },
      status: "in_review",
      sourceCompleteness: "partial",
    },
    editions: [
      {
        id: "ed_developer",
        audience: "developer",
        revisionId: "ed_rev_01",
        status: "in_review",
        blocks: [
          {
            id: "block_added",
            section: "Added",
            markdown: "- Adds configurable webhook retries.",
            claimIds: ["clm_what_01", "clm_why_01"],
          },
        ],
        quality: {
          score: 82,
          band: "good",
          rubricVersion: "quality@1",
          dimensions: [
            { id: "grounding", label: "Evidence grounding", score: 100 },
            { id: "clarity", label: "What changed clarity", score: 75 },
          ],
          blockers: [],
          tasks: [
            {
              id: "task_why",
              severity: "medium",
              title: "Confirm the user impact",
              detail: "The impact claim needs a cited source.",
              claimId: "clm_why_01",
            },
          ],
        },
      },
      {
        id: "ed_user",
        audience: "user",
        revisionId: "ed_rev_01_user",
        status: "draft",
        blocks: [
          {
            id: "block_user_added",
            section: "New",
            markdown: "- Webhook delivery now retries failed requests.",
            claimIds: ["clm_what_01"],
          },
        ],
      },
      {
        id: "ed_executive",
        audience: "executive",
        revisionId: "ed_rev_01_exec",
        status: "draft",
        blocks: [],
      },
    ],
    claims: [
      {
        id: "clm_what_01",
        statement: "Adds configurable retry handling for failed webhook deliveries.",
        kind: "what",
        certainty: "supported",
        citations: [{ evidenceId: "ev_pr_128", support: "direct" }],
      },
      {
        id: "clm_why_01",
        statement: "Addresses repeated delivery failures for webhook consumers.",
        kind: "why",
        certainty: "needs-review",
      },
    ],
    evidence: [
      {
        id: "ev_pr_128",
        title: "GitHub pull request #128",
        kind: "pull-request",
        authority: "delivery",
        visibility: "workspace",
        locator: "body",
        excerpt: "Adds configurable retries for webhook delivery failures.",
      },
    ],
    mappings: [
      {
        id: "map_128",
        title: "PR #128 → WEB-184",
        status: "needs-review",
        confidence: 75,
        method: "issue-key",
        detail: "The tracker key is explicit but branch scope still needs review.",
        evidenceIds: ["ev_pr_128"],
      },
    ],
    revisions: [
      {
        id: "history_01",
        actor: "Avery",
        timestamp: "2026-07-21T12:00:00Z",
        summary: "Created the developer edition from the accepted change set.",
        kind: "generation",
      },
    ],
    publishingTargets: [
      {
        id: "github-release",
        label: "GitHub Release",
        audience: "developer",
        status: "ready",
        detail: "Release body preview is valid for v2.4.0.",
      },
      {
        id: "public-rss",
        label: "Public RSS",
        audience: "user",
        status: "blocked",
        detail: "User edition approval is required.",
      },
    ],
  };
}
