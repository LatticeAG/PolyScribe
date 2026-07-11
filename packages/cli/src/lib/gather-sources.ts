import {
  collectSources,
  loadConfig,
  resolveRange,
  type PolyScribeConfigFile,
  type ResolvedRange,
  type SourceItem,
} from "@polyscribe/core";

export interface GatherSourcesOptions {
  from?: string;
  to?: string;
}

export interface GatherSourcesResult {
  config: PolyScribeConfigFile;
  range: ResolvedRange;
  sources: SourceItem[];
}

export async function gatherSources(
  cwd: string,
  options: GatherSourcesOptions,
): Promise<GatherSourcesResult> {
  const { config } = loadConfig(cwd);
  const range = await resolveRange(
    cwd,
    options.from,
    options.to ?? "HEAD",
  );

  const sources = await collectSources(
    cwd,
    {
      fromRef: range.fromRef,
      toRef: range.toRef,
    },
    {
      ignoreGlobs: config.ignoreGlobs,
      maxDiffBytesPerFile: config.maxDiffBytesPerFile,
      maxTotalDiffBytes: config.maxTotalDiffBytes,
      githubToken: process.env.GITHUB_TOKEN,
    },
  );

  return { config, range, sources };
}
