import type { SourceItem, Tone } from "../types.js";

const TONE_GUIDANCE: Record<Tone, string> = {
  technical:
    "Write precise, API-oriented release notes. Prefer concrete identifiers, endpoints, and behavioral changes.",
  "developer-friendly":
    "Write clear, friendly, concrete release notes suitable for most open-source and product API audiences.",
  executive:
    "Write short, outcome-focused release notes emphasizing user and business impact over implementation detail.",
  community:
    "Write warm, credits-forward release notes that celebrate contributors and community impact.",
};

const SECTION_GUIDANCE = `Produce structured release note sections. Omit empty sections except Summary and Contributors when sources exist.

Section types:
- summary: high-level overview of the release
- breaking: breaking changes requiring user action
- features: new capabilities
- fixes: bug fixes
- perf: performance improvements
- security: security fixes or hardening
- docs: documentation changes
- chore: maintenance and internal changes
- migration: migration steps for breaking or behavioral changes
- credits: contributor acknowledgements

Every bullet in content must cite at least one source id from the provided list in sourceIds.
Use markdown bullets in content. Reference PR numbers or authors when available.`;

export interface DraftPrompts {
  system: string;
  user: string;
}

export function buildDraftSystemPrompt(tone: Tone): string {
  return `You are PolyScribe, an expert release notes editor for GitHub repositories.

${TONE_GUIDANCE[tone]}

${SECTION_GUIDANCE}

Rules:
- Only describe changes supported by the provided sources.
- Every section bullet must map to one or more sourceIds.
- Do not invent features, APIs, or contributors.
- Suggested semver must be patch, minor, or major.
- Respond with valid JSON matching the required schema.`;
}

export function formatSourceForPrompt(source: SourceItem): string {
  const lines = [
    `id: ${source.id}`,
    `type: ${source.type}`,
    `title: ${source.title}`,
    `author: ${source.author.login}`,
    `url: ${source.url}`,
  ];

  if (source.sha) lines.push(`sha: ${source.sha}`);
  if (source.prNumber) lines.push(`pr: #${source.prNumber}`);
  if (source.labels.length) lines.push(`labels: ${source.labels.join(", ")}`);
  if (source.body) lines.push(`body:\n${source.body.trim()}`);
  if (source.linkedIssues?.length) {
    lines.push(
      `linked_issues: ${source.linkedIssues.map((i) => `#${i.number} ${i.title}`).join("; ")}`,
    );
  }
  if (source.files?.length) {
    lines.push(
      `files: ${source.files.map((f) => `${f.status} ${f.path} (+${f.additions}/-${f.deletions})`).join("; ")}`,
    );
  }

  return lines.join("\n");
}

export function buildDraftUserPrompt(
  sources: SourceItem[],
  tone: Tone,
  heuristicSemver: string,
): string {
  const sourceBlock =
    sources.length === 0
      ? "No sources in range."
      : sources.map(formatSourceForPrompt).join("\n\n---\n\n");

  return `Tone: ${tone}
Heuristic semver suggestion: ${heuristicSemver}

Sources (${sources.length}):
${sourceBlock}

Draft release notes for this range. Include Summary and Contributors when sources exist.`;
}

export function buildDraftPrompts(
  sources: SourceItem[],
  tone: Tone,
  heuristicSemver: string,
): DraftPrompts {
  return {
    system: buildDraftSystemPrompt(tone),
    user: buildDraftUserPrompt(sources, tone, heuristicSemver),
  };
}
