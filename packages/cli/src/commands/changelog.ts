import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import {
  collectSources,
  createEmptyChangelog,
  createLLMClient,
  generateDraft,
  insertVersion,
  loadConfig,
  renderKeepAChangelogBody,
  resolveRange,
} from "@polyscribe/core";

export interface ChangelogCommandOptions {
  from?: string;
  to?: string;
  version?: string;
  write?: boolean;
}

export function registerChangelogCommand(program: Command): void {
  program
    .command("changelog")
    .description("Generate and optionally write Keep a Changelog entry")
    .option("--from <ref>", "start ref")
    .option("--to <ref>", "end ref (default: HEAD)")
    .option("--version <version>", "version for changelog heading (required with --write)")
    .option("--write", "update changelog file in working tree")
    .action(async (options: ChangelogCommandOptions) => {
      const cwd = process.cwd();
      const { config } = loadConfig(cwd);
      const changelogPath = resolve(cwd, config.changelogPath);

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

      const llm = createLLMClient({
        provider: config.llm?.provider,
        model: config.llm?.model,
      });

      console.log(pc.dim(`Generating changelog body with ${llm.provider}/${llm.model}...`));

      const draft = await generateDraft(
        sources,
        {
          tone: config.tone,
          repositoryId: "local",
          range: { fromRef: range.fromRef, toRef: range.toRef },
        },
        llm,
      );

      const body = renderKeepAChangelogBody(
        draft.sections,
        config.sections?.order,
      );

      if (!options.write) {
        console.log("");
        console.log(body);
        console.log("");
        console.log(pc.dim(`Range: ${range.fromRef}..${range.toRef}`));
        return;
      }

      if (!options.version) {
        console.error(pc.red("--version is required when using --write"));
        process.exit(1);
      }

      const existing = existsSync(changelogPath)
        ? readFileSync(changelogPath, "utf8")
        : createEmptyChangelog();

      const date = new Date().toISOString().slice(0, 10);
      const updated = insertVersion(existing, options.version, date, body);

      writeFileSync(changelogPath, updated, "utf8");
      console.log(
        pc.green(`Updated ${config.changelogPath} for v${options.version}`),
      );
    });
}
