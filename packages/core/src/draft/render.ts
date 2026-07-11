import type { DraftSection, DraftSectionType } from "../types.js";

const SECTION_TITLES: Record<DraftSectionType, string> = {
  summary: "Summary",
  breaking: "Breaking Changes",
  features: "Features",
  fixes: "Fixes",
  perf: "Performance",
  security: "Security",
  docs: "Documentation",
  chore: "Maintenance",
  migration: "Migration Guide",
  credits: "Contributors",
};

const DEFAULT_SECTION_ORDER: DraftSectionType[] = [
  "summary",
  "breaking",
  "features",
  "fixes",
  "perf",
  "security",
  "docs",
  "chore",
  "migration",
  "credits",
];

export function getSectionTitle(type: DraftSectionType): string {
  return SECTION_TITLES[type];
}

export function sortSections(
  sections: DraftSection[],
  order: DraftSectionType[] = DEFAULT_SECTION_ORDER,
): DraftSection[] {
  const rank = new Map(order.map((type, index) => [type, index]));
  return [...sections].sort(
    (a, b) => (rank.get(a.type) ?? 999) - (rank.get(b.type) ?? 999),
  );
}

export function renderDraftMarkdown(
  sections: DraftSection[],
  order?: DraftSectionType[],
): string {
  const sorted = sortSections(sections, order);
  const rendered = sorted
    .filter((section) => section.content.trim().length > 0)
    .map((section) => `## ${section.title}\n${section.content.trim()}`)
    .join("\n\n");

  return rendered.trim();
}

export function renderKeepAChangelogBody(
  sections: DraftSection[],
  order?: DraftSectionType[],
): string {
  const changelogTypes: DraftSectionType[] = [
    "breaking",
    "features",
    "fixes",
    "perf",
    "security",
    "docs",
    "chore",
    "migration",
  ];

  const sorted = sortSections(sections, order);
  const parts: string[] = [];

  for (const type of changelogTypes) {
    const section = sorted.find((s) => s.type === type);
    if (!section?.content.trim()) continue;

    const keepTitle = mapToKeepAChangelogHeading(type);
    parts.push(`### ${keepTitle}\n\n${section.content.trim()}`);
  }

  const summary = sorted.find((s) => s.type === "summary");
  if (summary?.content.trim()) {
    parts.unshift(summary.content.trim());
  }

  return parts.join("\n\n").trim();
}

function mapToKeepAChangelogHeading(type: DraftSectionType): string {
  switch (type) {
    case "breaking":
      return "Breaking Changes";
    case "features":
      return "Added";
    case "fixes":
      return "Fixed";
    case "perf":
      return "Performance";
    case "security":
      return "Security";
    case "docs":
      return "Documentation";
    case "chore":
      return "Changed";
    case "migration":
      return "Migration";
    default:
      return getSectionTitle(type);
  }
}
