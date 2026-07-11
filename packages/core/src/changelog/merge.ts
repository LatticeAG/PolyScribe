import { parseChangelog } from "./parse.js";

function formatVersionHeading(version: string, date?: string): string {
  return date ? `## [${version}] - ${date}` : `## [${version}]`;
}

function normalizeContent(content: string): string {
  const trimmed = content.trim();
  return trimmed.length > 0 ? `\n${trimmed}\n` : "\n";
}

export function insertVersion(
  changelog: string,
  version: string,
  date: string,
  content: string,
): string {
  const parsed = parseChangelog(changelog);
  const blocks: string[] = [];

  if (parsed.preamble.length > 0) {
    blocks.push(parsed.preamble);
  }

  if (parsed.unreleased) {
    blocks.push(`## [Unreleased]\n${parsed.unreleased.content.trimEnd()}`);
  }

  blocks.push(`${formatVersionHeading(version, date)}${normalizeContent(content)}`);

  for (const existing of parsed.versions) {
    blocks.push(
      `${formatVersionHeading(existing.version, existing.date)}${normalizeContent(existing.content)}`,
    );
  }

  return `${blocks.join("\n\n").replace(/\n{3,}/g, "\n\n")}\n`;
}
