import type { SourceItem } from "../types.js";

const BREAKING_LABELS = new Set(["breaking", "breaking-change"]);
const FEAT_LABELS = new Set(["feat", "feature", "enhancement"]);

export function suggestSemverFromSources(
  sources: SourceItem[],
): "patch" | "minor" | "major" {
  for (const source of sources) {
    const labels = source.labels.map((l) => l.toLowerCase());
    const titleBody = `${source.title}\n${source.body ?? ""}`;

    if (
      labels.some((l) => BREAKING_LABELS.has(l)) ||
      /BREAKING CHANGE/i.test(titleBody)
    ) {
      return "major";
    }
  }

  for (const source of sources) {
    const labels = source.labels.map((l) => l.toLowerCase());
    if (
      labels.some((l) => FEAT_LABELS.has(l)) ||
      /^feat(\(|:)/i.test(source.title)
    ) {
      return "minor";
    }
  }

  return "patch";
}
