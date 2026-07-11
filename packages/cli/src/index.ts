#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import pc from "picocolors";
import { registerChangelogCommand } from "./commands/changelog.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerDraftCommand } from "./commands/draft.js";
import { registerValidateConfigCommand } from "./commands/validate-config.js";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(join(packageRoot, "../package.json"), "utf8"),
) as { version: string };

export function createProgram(): Command {
  const program = new Command();

  program
    .name("polyscribe")
    .description("PolyScribe — evidence-linked release notes for GitHub")
    .version(version);

  registerDraftCommand(program);
  registerChangelogCommand(program);
  registerConfigCommand(program);
  registerValidateConfigCommand(program);
  registerDoctorCommand(program);

  return program;
}

export async function run(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(pc.red(`Error: ${message}`));
    process.exit(1);
  }
}

void run();
