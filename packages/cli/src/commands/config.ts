import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import { EXAMPLE_CONFIG_YAML } from "@polyscribe/core";

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command("config")
    .description("Manage PolyScribe configuration");

  configCmd
    .command("init")
    .description("Write example .polyscribe.yml in the current directory")
    .option("--path <file>", "config file path", ".polyscribe.yml")
    .action((options: { path: string }) => {
      const target = resolve(process.cwd(), options.path);
      writeFileSync(target, EXAMPLE_CONFIG_YAML, "utf8");
      console.log(pc.green(`Created ${options.path}`));
      console.log(pc.dim("Edit tone, ignoreGlobs, and llm settings as needed."));
    });
}
