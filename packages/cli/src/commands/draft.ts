import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import { createLLMClient, generateDraft, loadConfig } from "@polyscribe/core";
import { gatherSources } from "../lib/gather-sources.js";
import { handleCommandError } from "../lib/handle-error.js";
import { printSources } from "../lib/print-sources.js";
import { EXIT_CONFIG } from "../util/exit-codes.js";

export interface DraftCommandOptions {
  from?: string;
  to?: string;
  tone?: string;
  output?: string;
  json?: boolean;
  sourcesOnly?: boolean;
  noLlm?: boolean;
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
    .option(
      "--output <file>",
      "write markdown to file (e.g. RELEASE.md for polyscribe publish)",
    )
    .option("--json", "output draft as JSON")
    .option("--sources-only", "collect and print sources JSON, no LLM")
    .option("--no-llm", "alias for --sources-only")
    .action(async (options: DraftCommandOptions) => {
      const cwd = process.cwd();

      try {
        const { config } = loadConfig(cwd);
        const skipLlm = options.sourcesOnly || options.noLlm;

        console.error(pc.dim("Collecting sources..."));
        const { range, sources } = await gatherSources(cwd, {
          from: options.from,
          to: options.to,
        });

        if (skipLlm) {
          printSources(sources, {
            pretty: true,
            range,
          });
          return;
        }

        if (sources.length === 0) {
          console.error(
            pc.yellow(
              `No sources found for range ${range.fromRef}..${range.toRef}`,
            ),
          );
          process.exit(EXIT_CONFIG);
        }

        console.error(
          pc.dim(
            `Found ${sources.length} source(s) in ${range.fromRef}..${range.toRef}`,
          ),
        );

        const tone = (options.tone ?? config.tone) as typeof config.tone;
        const llm = createLLMClient({
          provider: config.llm?.provider,
          model: config.llm?.model,
        });

        console.error(
          pc.dim(`Generating draft with ${llm.provider}/${llm.model}...`),
        );

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
          console.log(
            pc.dim(
              "Tip: save for publish with polyscribe draft --output RELEASE.md",
            ),
          );
        }
      } catch (error) {
        handleCommandError(error);
      }
    });
}
