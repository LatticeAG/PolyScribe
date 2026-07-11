import type { Command } from "commander";
import pc from "picocolors";
import { EXIT_CONFIG } from "../util/exit-codes.js";

export interface PublishCommandOptions {
  version?: string;
  notes?: string;
  target?: string;
}

export function registerPublishCommand(program: Command): void {
  program
    .command("publish")
    .description("Create a GitHub Release from a version tag (Phase 1b)")
    .option("--version <version>", "release version tag")
    .option(
      "--notes <file>",
      "release notes markdown file (default: RELEASE.md)",
    )
    .option(
      "--target <target>",
      "publish target: github-release | changelog-pr",
    )
    .action((options: PublishCommandOptions) => {
      console.error(pc.yellow("polyscribe publish is not yet implemented."));
      console.error(
        pc.dim(
          "Prepare release notes with: polyscribe draft --output RELEASE.md",
        ),
      );
      if (options.notes) {
        console.error(pc.dim(`Notes file: ${options.notes}`));
      } else {
        console.error(pc.dim("Default notes file: RELEASE.md"));
      }
      process.exit(EXIT_CONFIG);
    });
}
