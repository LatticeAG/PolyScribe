import { resolve } from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import { findConfigPath, validateConfigFile } from "@polyscribe/core";

export function registerValidateConfigCommand(program: Command): void {
  program
    .command("validate-config")
    .description("Validate .polyscribe.yml syntax and schema")
    .argument("[path]", "config file path")
    .action((pathArg?: string) => {
      const cwd = process.cwd();
      const configPath = pathArg
        ? resolve(cwd, pathArg)
        : findConfigPath(cwd);

      if (!configPath) {
        console.error(
          pc.red("No config file found (.polyscribe.yml or .github/polyscribe.yml)"),
        );
        process.exit(1);
      }

      const result = validateConfigFile(configPath);
      if (!result.ok) {
        console.error(pc.red(`Invalid config: ${result.error}`));
        process.exit(1);
      }

      console.log(pc.green(`Valid config: ${configPath}`));
      console.log(
        pc.dim(`tone=${result.config.tone}, changelog=${result.config.changelogPath}`),
      );
    });
}
