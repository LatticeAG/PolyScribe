import { randomUUID } from "node:crypto";
import type {
  Draft,
  DraftSection,
  GenerateDraftConfig,
  GitHubUser,
  SourceItem,
} from "../types.js";
import { suggestSemverFromSources } from "../semver/heuristics.js";
import { buildDraftPrompts } from "./prompt.js";
import { llmDraftOutputSchema } from "./schema.js";
import { renderDraftMarkdown } from "./render.js";
import type { LLMClient } from "./llm/client.js";

export class CitationValidationError extends Error {
  constructor(
    message: string,
    readonly invalidSections: Array<{ type: string; reason: string }>,
  ) {
    super(message);
    this.name = "CitationValidationError";
  }
}

export function validateSectionCitations(
  sections: DraftSection[],
  sourceIds: Set<string>,
): Array<{ type: string; reason: string }> {
  const invalid: Array<{ type: string; reason: string }> = [];

  for (const section of sections) {
    if (section.type === "credits") continue;
    if (!section.content.trim()) continue;

    const bullets = section.content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("-") || line.startsWith("*"));

    if (bullets.length === 0) {
      if (section.sourceIds.length === 0) {
        invalid.push({
          type: section.type,
          reason: "non-empty section missing sourceIds",
        });
      }
      continue;
    }

    for (const [index, bullet] of bullets.entries()) {
      const hasInlineCitation = /\(.*?#?\d+.*?\)|\bsource:/i.test(bullet);
      const hasSectionSources = section.sourceIds.some((id) => sourceIds.has(id));

      if (!hasInlineCitation && !hasSectionSources) {
        invalid.push({
          type: section.type,
          reason: `bullet ${index + 1} lacks valid source citation`,
        });
      }
    }

    for (const id of section.sourceIds) {
      if (!sourceIds.has(id)) {
        invalid.push({
          type: section.type,
          reason: `unknown sourceId: ${id}`,
        });
      }
    }
  }

  return invalid;
}

function uniqueContributors(
  fromLlm: Array<{ login: string; id?: string }>,
  sources: SourceItem[],
): GitHubUser[] {
  const map = new Map<string, GitHubUser>();

  for (const source of sources) {
    map.set(source.author.login, source.author);
  }

  for (const contributor of fromLlm) {
    map.set(contributor.login, {
      login: contributor.login,
      id: contributor.id ?? contributor.login,
    });
  }

  return [...map.values()];
}

export async function generateDraft(
  sources: SourceItem[],
  config: GenerateDraftConfig,
  llmClient: LLMClient,
): Promise<Draft> {
  if (sources.length === 0) {
    throw new Error("Cannot generate draft: no sources in range");
  }

  const tone = config.tone ?? "developer-friendly";
  const semverSuggestion = suggestSemverFromSources(sources);
  const heuristicSemver = semverSuggestion.level;
  const prompts = buildDraftPrompts(sources, tone, heuristicSemver);
  const sourceIdSet = new Set(sources.map((s) => s.id));

  const output = await llmClient.completeStructured({
    system: prompts.system,
    user: prompts.user,
    schema: llmDraftOutputSchema,
    maxTokens: 4096,
  });

  const sections: DraftSection[] = output.sections.map((section) => ({
    type: section.type,
    title: section.title,
    content: section.content,
    sourceIds: section.sourceIds ?? [],
  }));

  const invalid = validateSectionCitations(sections, sourceIdSet);
  if (invalid.length > 0) {
    throw new CitationValidationError(
      `Draft failed citation validation (${invalid.length} issue(s))`,
      invalid,
    );
  }

  const now = new Date().toISOString();
  const contributors = uniqueContributors(output.contributors ?? [], sources);
  const markdown = renderDraftMarkdown(sections);

  return {
    id: randomUUID(),
    repositoryId: config.repositoryId ?? "local",
    range: config.range ?? { fromRef: "unknown", toRef: "unknown" },
    status: "pending",
    suggestedSemver: output.suggestedSemver,
    heuristicSemver,
    markdown,
    sections,
    contributors,
    model: {
      provider: llmClient.provider,
      name: llmClient.model,
    },
    createdAt: now,
    updatedAt: now,
  };
}
