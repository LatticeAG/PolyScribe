import type { Command } from "commander";
import pc from "picocolors";
import { gatherSources } from "../lib/gather-sources.js";
import { handleCommandError } from "../lib/handle-error.js";
import { printSources } from "../lib/print-sources.js";

export interface SourcesCommandOptions {
  from?: string;
  to?: string;
  json?: boolean;
  pretty?: boolean;
  count?: boolean;
}

export function registerSourcesCommand(program: Command): void {
  program
    .command("sources")
    .description("Collect and print ingestion sources as JSON (no LLM)")
    .option("--from <ref>", "start ref (default: latest tag or root commit)")
    .option("--to <ref>", "end ref (default: HEAD)")
    .option("--json", "output SourceItem[] as JSON (default)")
    .option("--pretty", "pretty-print JSON")
    .option("--count", "only print source count summary")
    .action(async (options: SourcesCommandOptions) => {
      const cwd = process.cwd();

      try {
        console.error(pc.dim("Collecting sources..."));
        const { range, sources } = await gatherSources(cwd, {
          from: options.from,
          to: options.to,
        });

        printSources(sources, {
          pretty: options.pretty,
          count: options.count,
          range,
        });
      } catch (error) {
        handleCommandError(error);
      }
    });
}
