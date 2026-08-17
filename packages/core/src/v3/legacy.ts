import type { SourceItem } from "../types.js";
import type { EvidenceRecord } from "./domain.js";

export interface FlattenV3EvidenceOptions {
  /** Include non-delivery evidence when the caller explicitly requests context. */
  includeContext?: boolean;
}

function legacyTypeForEvidence(
  evidence: EvidenceRecord,
): SourceItem["type"] | undefined {
  const kind = evidence.source.objectKind.toLowerCase();
  if (kind === "pr" || kind === "pull-request" || kind === "pull_request") return "pr";
  if (kind === "commit" || kind === "git-commit") return "commit";
  if (kind === "diff" || kind === "file-diff") return "diff";
  return undefined;
}

function stringField(evidence: EvidenceRecord, key: string): string | undefined {
  const value = evidence.fields?.[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Adapts representable V3 evidence back into the legacy flattened SourceItem
 * view. Jira/Linear/context records are intentionally omitted because the
 * legacy union cannot represent them without laundering their authority.
 */
export function flattenV3EvidenceToLegacySourceItems(
  evidence: EvidenceRecord[],
  options: FlattenV3EvidenceOptions = {},
): SourceItem[] {
  return evidence.flatMap((record) => {
    if (record.authority !== "delivery" && !options.includeContext) return [];
    const type = legacyTypeForEvidence(record);
    if (!type) return [];

    const externalId = record.source.externalId;
    const prNumber = type === "pr" ? Number(externalId) : undefined;
    return [
      {
        id: `${type}:${externalId}`,
        type,
        sha: stringField(record, "sha"),
        prNumber: Number.isSafeInteger(prNumber) ? prNumber : undefined,
        title: record.title ?? `${record.source.objectKind} ${externalId}`,
        body: record.excerpt,
        author: {
          login: stringField(record, "authorLogin") ?? record.source.pluginId,
          id: stringField(record, "authorId") ?? record.source.pluginId,
        },
        mergedAt: stringField(record, "mergedAt"),
        labels: record.labels ?? [],
        url: record.canonicalUrl ?? `${record.source.pluginId}:${externalId}`,
      },
    ];
  });
}
