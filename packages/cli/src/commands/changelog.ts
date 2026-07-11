import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import {
  createEmptyChangelog,
  createLLMClient,
  generateDraft,
  insertVersion,
  loadConfig,
  renderKeepAChangelogBody,
  resolveRange,
  type ResolvedRange,
} from "@polyscribe/core";
import { gatherSources } from "../lib/gather-sources.js";
import { handleCommandError } from "../lib/handle-error.js";
import { formatDateUtc } from "../util/format-date.js";
import { renderLineDiff } from "../util/line-diff.js";
import { EXIT_CONFIG } from "../util/exit-codes.js";

export interface ChangelogCommandOptions {
  from?: string;
  to?: string;
  version?: string;
  write?: boolean;
  dryRun?: boolean;
  date?: string;
  notes?: string;
}

export function registerChangelogCommand(program: Command): void {
  program
    .command("changelog")
    .description("Generate and optionally write Keep a Changelog entry")
    .option("--from <ref>", "start ref")
    .option("--to <ref>", "end ref (default: HEAD)")
    .option("--version <version>", "version for changelog heading")
    .option("--write", "update changelog file in working tree")
    .option("--dry-run", "show full changelog file diff without writing")
    .option("--date <YYYY-MM-DD>", "override release date (default: today UTC)")
    .option(
      "--notes <file>",
      "use existing markdown file as changelog body (skips LLM)",
    )
    .action(async (options: ChangelogCommandOptions) => {
      const cwd = process.cwd();

      try {
        const { config } = loadConfig(cwd);
        let range: ResolvedRange;
        let body: string;

        if (options.notes) {
          const notesPath = resolve(cwd, options.notes);
          if (!existsSync(notesPath)) {
            console.error(pc.red(`Notes file not found: ${options.notes}`));
            process.exit(EXIT_CONFIG);
          }

          range = await resolveRange(
            cwd,
            options.from,
            options.to ?? "HEAD",
          );
          body = readFileSync(notesPath, "utf8").trimEnd();
        } else {
          console.error(pc.dim("Collecting sources..."));
          const gathered = await gatherSources(cwd, {
            from: options.from,
            to: options.to,
          });
          range = gathered.range;

          if (gathered.sources.length === 0) {
            console.error(
              pc.yellow(
                `No sources found for range ${range.fromRef}..${range.toRef}`,
              ),
            );
            process.exit(EXIT_CONFIG);
          }

          const llm = createLLMClient({
            provider: config.llm?.provider,
            model: config.llm?.model,
          });

          console.error(
            pc.dim(
              `Generating changelog body with ${llm.provider}/${llm.model}...`,
            ),
          );

          const draft = await generateDraft(
            gathered.sources,
            {
              tone: config.tone,
              repositoryId: "local",
              range: { fromRef: range.fromRef, toRef: range.toRef },
            },
            llm,
          );

          body = renderKeepAChangelogBody(
            draft.sections,
            config.sections?.order,
          );
        }

        const changelogPath = resolve(cwd, config.changelogPath);
        const needsFileUpdate = options.write || options.dryRun;

        if (!needsFileUpdate) {
          console.log("");
          console.log(body);
          console.log("");
          console.log(pc.dim(`Range: ${range.fromRef}..${range.toRef}`));
          return;
        }

        if (!options.version) {
          console.error(
            pc.red("--version is required when using --write or --dry-run"),
          );
          process.exit(EXIT_CONFIG);
        }

        const existing = existsSync(changelogPath)
          ? readFileSync(changelogPath, "utf8")
          : createEmptyChangelog();

        const date = formatDateUtc(options.date);
        const updated = insertVersion(existing, options.version, date, body);

        if (options.dryRun) {
          console.log(renderLineDiff(existing, updated));
          return;
        }

        writeFileSync(changelogPath, updated, "utf8");
        console.log(
          pc.green(`Updated ${config.changelogPath} for v${options.version}`),
        );
      } catch (error) {
        handleCommandError(error);
      }
    });
}
