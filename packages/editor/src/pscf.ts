import type {
  PscfClaim,
  PscfQualityReport,
  PscfReleaseContentRevision,
} from "@polyscribe/schema";
import type {
  ReviewClaim,
  ReviewDocument,
  ReviewEdition,
  ReviewQualityReport,
} from "./types.js";

/**
 * Adapts portable PSCF content into the small document-first view model used
 * by the editor. It is intentionally one-way: saving remains a structured
 * editor/API operation, never an untracked Markdown overwrite of PSCF.
 */
export function reviewDocumentFromPscf(document: PscfReleaseContentRevision): ReviewDocument {
  const claims = document.changeSet.changes.flatMap((change) =>
    change.claims.map((claim) => reviewClaimFromPscf(claim, change.visibility)),
  );
  const reports = new Map((document.quality?.reports ?? []).map((report) => [report.editionId, report]));
  const sourceCompleteness = document.snapshot.completeness ?? document.changeSet.completeness ?? "unknown";

  return {
    id: document.documentId,
    revisionId: document.revisionId,
    release: {
      id: document.documentId,
      version: document.release.version ?? document.release.tag ?? "Unversioned release",
      component: document.release.componentId,
      range: {
        from: document.release.range?.from.ref ?? "unscoped",
        to: document.release.range?.to.ref ?? "unscoped",
      },
      status: document.release.status,
      sourceCompleteness,
      updatedAt: document.updatedAt,
    },
    editions: document.editions.map((edition) => reviewEditionFromPscf(edition, reports.get(edition.editionId))),
    claims,
    evidence: (document.snapshot.evidence ?? []).map((evidence) => ({
      id: evidence.evidenceId,
      title: evidence.sourceKey ?? `Evidence ${evidence.evidenceId}`,
      kind: "evidence",
      authority: "derived",
      visibility: evidence.visibility ?? "workspace",
      sourceUrl: evidence.url,
      redacted: !evidence.url,
    })),
    mappings: [],
    revisions: (document.auditRefs ?? []).map((reference) => ({
      id: reference,
      actor: "audit",
      timestamp: document.updatedAt,
      summary: reference,
      kind: "editor" as const,
    })),
    publishingTargets: [],
  };
}

function reviewClaimFromPscf(claim: PscfClaim, fallbackVisibility: ReviewClaim["visibility"]): ReviewClaim {
  return {
    id: claim.claimId,
    statement: claim.statement,
    kind: claim.kind,
    certainty: claim.certainty,
    visibility: claim.visibility ?? fallbackVisibility,
    citations: claim.citations.map((citation) => ({
      evidenceId: citation.evidence,
      locator: citation.locator.field,
      support: citation.supports,
    })),
  };
}

function reviewEditionFromPscf(
  edition: PscfReleaseContentRevision["editions"][number],
  report: PscfQualityReport | undefined,
): ReviewEdition {
  return {
    id: edition.editionId,
    audience: edition.audience,
    revisionId: `${edition.editionId}@${edition.revision}`,
    status: edition.status as ReviewEdition["status"],
    updatedAt: edition.approvedAt,
    blocks: edition.blocks.map((block) => ({
      id: block.blockId,
      section: block.section,
      markdown: block.markdown,
      claimIds: block.claimIds,
      changeIds: block.changeIds,
    })),
    quality: report ? reviewQualityFromPscf(report) : undefined,
  };
}

function reviewQualityFromPscf(report: PscfQualityReport): ReviewQualityReport {
  return {
    score: report.score,
    band: report.blockers?.length ? "blocked" : report.score >= 85 ? "excellent" : report.score >= 70 ? "good" : "needs-review",
    rubricVersion: report.rubricVersion,
    dimensions: Object.entries(report.dimensions).map(([id, score]) => ({
      id,
      label: id,
      score,
    })),
    blockers: (report.blockers ?? []).map((blocker, index) => ({
      id: `blocker-${index}`,
      severity: "blocker" as const,
      title: blocker.code,
      detail: blocker.message,
    })),
    tasks: (report.tasks ?? []).map((task, index) => ({
      id: `task-${index}`,
      severity: "medium" as const,
      title: task.code,
      detail: task.message,
    })),
  };
}
