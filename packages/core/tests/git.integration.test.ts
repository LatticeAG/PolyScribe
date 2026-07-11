import { describe, expect, it, beforeAll } from "vitest";
import { getFileChanges } from "../src/git/diff.js";
import { getCommitsInRange } from "../src/git/log.js";
import { resolveRange } from "../src/git/refs.js";
import {
  createGitFixture,
  isGitAvailable,
  type GitFixture,
} from "./fixtures/git-repo.js";

const gitAvailable = isGitAvailable();

describe.skipIf(!gitAvailable)("git integration", () => {
  let fixture: GitFixture | undefined;

  beforeAll(() => {
    if (!gitAvailable) return;
    fixture = createGitFixture();
  }, 30_000);

  it("resolveRange defaults to tag..HEAD", async () => {
    const resolved = await resolveRange(fixture!.cwd);

    expect(resolved.fromRef).toBe(fixture!.tag);
    expect(resolved.toRef).toBe("HEAD");
    expect(resolved.fromSha).toBe(fixture!.tagSha);
    expect(resolved.toSha).toBe(fixture!.headSha);
  });

  it("getCommitsInRange returns commits after the tag", async () => {
    const resolved = await resolveRange(fixture!.cwd);
    const commits = await getCommitsInRange(
      fixture!.cwd,
      resolved.fromSha,
      resolved.toSha,
    );

    expect(commits).toHaveLength(1);
    expect(commits[0]?.title).toBe("fix: patch after tag");
  });

  it("getFileChanges returns file changes in range", async () => {
    const resolved = await resolveRange(fixture!.cwd);
    const changes = await getFileChanges(
      fixture!.cwd,
      resolved.fromSha,
      resolved.toSha,
      {
        ignoreGlobs: [],
        maxDiffBytesPerFile: 20_000,
        maxTotalDiffBytes: 400_000,
      },
    );

    expect(changes.length).toBeGreaterThan(0);
    expect(changes.some((change) => change.path === "src/index.ts")).toBe(true);
  });
});
