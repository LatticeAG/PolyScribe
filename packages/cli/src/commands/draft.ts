import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import {
  collectSources,
  createLLMClient,
  generateDraft,
  loadConfig,
  resolveRange,
} from "@polyscribe/core";

export interface DraftCommandOptions {
  from?: string;
  to?: string;
  tone?: string;
  output?: string;
  json?: boolean;
}

export function registerDraftCommand(program: Command): void {
  program
    .command("draft")
    .description("Generate AI release notes draft from git history")
    .option("--from <ref>", "start ref (default: latest tag or root commit)")
    .option("--to <ref>", "end ref (default: HEAD)")
    .option(
      "--tone <tone>",
      "editorial tone: technical | developer-friendly | executive | community",
    )
    .option("--output <file>", "write markdown to file")
    .option("--json", "output draft as JSON")
    .action(async (options: DraftCommandOptions) => {
      const cwd = process.cwd();
      const { config } = loadConfig(cwd);
      const tone = (options.tone ?? config.tone) as typeof config.tone;

      const range = await resolveRange(
        cwd,
        options.from,
        options.to ?? "HEAD",
      );

      console.log(pc.dim("Collecting sources..."));
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

      if (sources.length === 0) {
        console.error(
          pc.yellow(
            `No sources found for range ${range.fromRef}..${range.toRef}`,
          ),
        );
        process.exit(1);
      }

      console.log(
        pc.dim(
          `Found ${sources.length} source(s) in ${range.fromRef}..${range.toRef}`,
        ),
      );

      const llm = createLLMClient({
        provider: config.llm?.provider,
        model: config.llm?.model,
      });

      console.log(pc.dim(`Generating draft with ${llm.provider}/${llm.model}...`));

      const draft = await generateDraft(
        sources,
        {
          tone,
          repositoryId: "local",
          range: { fromRef: range.fromRef, toRef: range.toRef },
        },
        llm,
      );

      if (options.json) {
        const payload = JSON.stringify(draft, null, 2);
        if (options.output) {
          writeFileSync(resolve(cwd, options.output), payload, "utf8");
          console.log(pc.green(`Wrote JSON draft to ${options.output}`));
        } else {
          console.log(payload);
        }
        return;
      }

      if (options.output) {
        writeFileSync(resolve(cwd, options.output), draft.markdown, "utf8");
        console.log(pc.green(`Wrote draft to ${options.output}`));
      } else {
        console.log("");
        console.log(draft.markdown);
        console.log("");
        console.log(
          pc.dim(
            `Suggested semver: ${draft.suggestedSemver} (heuristic: ${draft.heuristicSemver})`,
          ),
        );
      }
    });
}
