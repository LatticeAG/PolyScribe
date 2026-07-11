import { accessSync, constants, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import {
  findConfigPath,
  getLatestTag,
  hasLLMCredentials,
  loadConfig,
  resolveRange,
} from "@polyscribe/core";

function isGitRepo(cwd: string): boolean {
  try {
    execSync("git rev-parse --git-dir", { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function checkGitHubToken(): { ok: boolean; message: string } {
  if (process.env.GITHUB_TOKEN) {
    return { ok: true, message: "GITHUB_TOKEN is set" };
  }
  return {
    ok: true,
    message: "GITHUB_TOKEN not set (optional for local draft/changelog)",
  };
}

function checkLLM(configProvider?: string): { ok: boolean; message: string } {
  const provider = configProvider as "openai" | "anthropic" | undefined;
  if (hasLLMCredentials(provider)) {
    const resolved =
      provider ?? (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");
    return { ok: true, message: `LLM credentials found for ${resolved}` };
  }
  return {
    ok: false,
    message: "No LLM API key found (set OPENAI_API_KEY or ANTHROPIC_API_KEY)",
  };
}

function checkChangelogWritable(
  cwd: string,
  changelogPath: string,
): { ok: boolean; message: string } {
  const absolutePath = join(cwd, changelogPath);

  if (existsSync(absolutePath)) {
    try {
      accessSync(absolutePath, constants.W_OK);
      return { ok: true, message: `${changelogPath} is writable` };
    } catch {
      return { ok: false, message: `${changelogPath} exists but is not writable` };
    }
  }

  const parent = dirname(absolutePath);
  try {
    accessSync(parent, constants.W_OK);
    return {
      ok: true,
      message: `${changelogPath} can be created (parent directory writable)`,
    };
  } catch {
    return {
      ok: false,
      message: `Cannot write ${changelogPath} (parent directory not writable)`,
    };
  }
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check git repo, optional GITHUB_TOKEN, and LLM credentials")
    .action(async () => {
      const cwd = process.cwd();
      const { config } = loadConfig(cwd);
      let failed = false;

      console.log(pc.bold("PolyScribe doctor\n"));

      const gitOk = isGitRepo(cwd);
      console.log(
        `${gitOk ? pc.green("✓") : pc.red("✗")} Git repository: ${
          gitOk ? "yes" : "not detected"
        }`,
      );
      if (!gitOk) failed = true;

      if (gitOk) {
        const latestTag = await getLatestTag(cwd);
        console.log(
          `${latestTag ? pc.green("✓") : pc.yellow("!")} Latest tag: ${
            latestTag ?? "none detected"
          }`,
        );

        try {
          const range = await resolveRange(cwd);
          console.log(
            `${pc.green("✓")} Suggested range: ${range.fromRef}..${range.toRef}`,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`${pc.red("✗")} Suggested range: ${message}`);
          failed = true;
        }
      }

      const github = checkGitHubToken();
      console.log(
        `${github.ok ? pc.green("✓") : pc.yellow("!")} GitHub: ${github.message}`,
      );

      const llm = checkLLM(config.llm?.provider);
      console.log(
        `${llm.ok ? pc.green("✓") : pc.red("✗")} LLM: ${llm.message}`,
      );
      if (!llm.ok) failed = true;

      const configPath = findConfigPath(cwd);
      console.log(
        `${configPath ? pc.green("✓") : pc.yellow("!")} Config: ${
          configPath ?? "using defaults (run polyscribe config init)"
        }`,
      );

      const changelog = checkChangelogWritable(cwd, config.changelogPath);
      console.log(
        `${changelog.ok ? pc.green("✓") : pc.red("✗")} Changelog: ${changelog.message}`,
      );
      if (!changelog.ok) failed = true;

      console.log("");
      if (failed) {
        console.log(pc.red("Some checks failed."));
        process.exit(1);
      }

      console.log(pc.green("All checks passed."));
    });
}
