export interface ChangelogVersion {
  version: string;
  date?: string;
  content: string;
  startLine: number;
  endLine: number;
}

export interface ParsedChangelog {
  preamble: string;
  unreleased?: ChangelogVersion;
  versions: ChangelogVersion[];
}

const VERSION_HEADING =
  /^##\s+\[(?<version>[^\]]+)\](?:\s+-\s+(?<date>\d{4}-\d{2}-\d{2}))?\s*$/;

function parseVersionHeading(line: string): { version: string; date?: string } | null {
  const match = line.match(VERSION_HEADING);
  if (!match?.groups?.version) {
    return null;
  }

  return {
    version: match.groups.version.trim(),
    date: match.groups.date?.trim(),
  };
}

export function parseChangelog(markdown: string): ParsedChangelog {
  const lines = markdown.split(/\r?\n/);
  const preambleLines: string[] = [];
  const sections: ChangelogVersion[] = [];

  let index = 0;
  while (index < lines.length) {
    const parsed = parseVersionHeading(lines[index] ?? "");
    if (parsed) break;
    preambleLines.push(lines[index] ?? "");
    index += 1;
  }

  while (index < lines.length) {
    const headingLine = lines[index] ?? "";
    const parsed = parseVersionHeading(headingLine);
    if (!parsed) {
      index += 1;
      continue;
    }

    const startLine = index;
    index += 1;

    const contentLines: string[] = [];
    while (index < lines.length) {
      const next = lines[index] ?? "";
      if (parseVersionHeading(next)) break;
      contentLines.push(next);
      index += 1;
    }

    sections.push({
      version: parsed.version,
      date: parsed.date,
      content: contentLines.join("\n").trimEnd(),
      startLine,
      endLine: index - 1,
    });
  }

  const unreleased = sections.find((s) => s.version === "Unreleased");
  const versions = sections.filter((s) => s.version !== "Unreleased");

  return {
    preamble: preambleLines.join("\n").trimEnd(),
    unreleased,
    versions,
  };
}
