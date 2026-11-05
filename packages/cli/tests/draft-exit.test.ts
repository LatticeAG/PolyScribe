import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("exits non-zero with a clear message when draft credentials are missing", () => {
  const cwd = mkdtempSync(resolve(process.cwd(), ".draft-test-"));
  try {
    const git = (...args: string[]) => execFileSync("git", args, { cwd, stdio: "ignore" });
    git("init");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    writeFileSync(resolve(cwd, "file.txt"), "one");
    git("add", ".");
    git("commit", "-m", "initial");
    writeFileSync(resolve(cwd, "file.txt"), "two");
    git("commit", "-am", "change");
    const env = { ...process.env };
    delete env.OPENAI_API_KEY;
    delete env.ANTHROPIC_API_KEY;
    const result = spawnSync(process.execPath, [resolve(process.cwd(), "dist/index.js"), "draft", "--from", "HEAD~1", "--to", "HEAD"], { cwd, env, encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("OPENAI_API_KEY is required for openai provider");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
