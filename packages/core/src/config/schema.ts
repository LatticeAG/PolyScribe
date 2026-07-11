import { z } from "zod";

export const DEFAULT_IGNORE_GLOBS = [
  "**/package-lock.json",
  "**/pnpm-lock.yaml",
  "**/yarn.lock",
  "**/bun.lockb",
  "**/dist/**",
  "**/generated/**",
] as const;

export const DEFAULT_SECTION_ORDER = [
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
] as const;

export const draftSectionTypeSchema = z.enum([
  "summary",
  "breaking",
  "features",
  "fixes",
  "perf",
  "docs",
  "chore",
  "security",
  "migration",
  "credits",
]);

const toneSchema = z.enum([
  "technical",
  "developer-friendly",
  "executive",
  "community",
]);

const publishTargetSchema = z.enum(["github-release", "changelog-pr"]);

const llmSchema = z
  .object({
    provider: z.enum(["openai", "anthropic", "openai-compatible"]),
    model: z.string().min(1),
  })
  .optional();

const sectionsSchema = z
  .object({
    order: z.array(draftSectionTypeSchema).optional(),
  })
  .optional();

export const polyScribeConfigSchema = z.object({
  changelogPath: z.string().default("CHANGELOG.md"),
  tone: toneSchema.default("developer-friendly"),
  ignoreGlobs: z.array(z.string()).default([...DEFAULT_IGNORE_GLOBS]),
  monorepoRoots: z.array(z.string()).default([]),
  requireApprover: z.boolean().default(true),
  autoPublish: z.boolean().default(false),
  includeUnreleased: z.boolean().default(false),
  publishTargets: z
    .array(publishTargetSchema)
    .default(["github-release", "changelog-pr"]),
  sections: sectionsSchema,
  includeCommittersWithoutPr: z.boolean().default(true),
  maxDiffBytesPerFile: z.number().int().positive().default(20_000),
  maxTotalDiffBytes: z.number().int().positive().default(400_000),
  llm: llmSchema,
});

export type PolyScribeConfigInput = z.input<typeof polyScribeConfigSchema>;
export type PolyScribeConfigFile = z.infer<typeof polyScribeConfigSchema>;

export function defaultConfig(): PolyScribeConfigFile {
  return polyScribeConfigSchema.parse({});
}

export function parseConfig(input: unknown): PolyScribeConfigFile {
  return polyScribeConfigSchema.parse(input);
}

export const EXAMPLE_CONFIG_YAML = `# PolyScribe configuration
changelogPath: CHANGELOG.md
tone: developer-friendly
requireApprover: true
autoPublish: false
includeUnreleased: false
publishTargets:
  - github-release
  - changelog-pr
ignoreGlobs:
  - "**/package-lock.json"
  - "**/pnpm-lock.yaml"
  - "**/dist/**"
maxDiffBytesPerFile: 20000
maxTotalDiffBytes: 400000
llm:
  provider: openai
  model: gpt-4.1
`;
