import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface GitFixture {
  cwd: string;
  tagSha: string;
  headSha: string;
  tag: string;
}

export function isGitAvailable(): boolean {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function createGitFixture(): GitFixture {
  const cwd = mkdtempSync(join(tmpdir(), "polyscribe-git-fixture-"));
  const run = (args: string[]) => {
    execFileSync("git", args, { cwd, stdio: "pipe" });
  };

  run(["init"]);
  run(["config", "user.email", "test@polyscribe.dev"]);
  run(["config", "user.name", "PolyScribe Test"]);
  run(["config", "commit.gpgsign", "false"]);

  writeFileSync(join(cwd, "README.md"), "# Fixture\n");
  run(["add", "README.md"]);
  run(["commit", "-m", "chore: initial commit"]);

  writeFileSync(join(cwd, "README.md"), "# Fixture\n\nFirst release.\n");
  run(["add", "README.md"]);
  run(["commit", "-m", "feat: first feature"]);
  const tagSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8",
  }).trim();
  run(["tag", "v0.1.0"]);

  mkdirSync(join(cwd, "src"), { recursive: true });
  writeFileSync(join(cwd, "src", "index.ts"), "export const version = '0.1.1';\n");
  run(["add", "src/index.ts"]);
  run(["commit", "-m", "fix: patch after tag"]);
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8",
  }).trim();

  return { cwd, tagSha, headSha, tag: "v0.1.0" };
}
