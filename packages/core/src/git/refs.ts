import type { ReleaseRange, ResolvedRange } from "../types.js";
import { git, tryGit } from "./exec.js";

export async function resolveRef(cwd: string, ref: string): Promise<string> {
  const result = await git(cwd, ["rev-parse", ref]);
  return result.stdout.trim();
}

export async function getLatestTag(cwd: string): Promise<string | null> {
  const result = await tryGit(cwd, ["describe", "--tags", "--abbrev=0"]);
  return result.ok ? result.stdout.trim() : null;
}

export async function resolveRange(
  cwd: string,
  fromRef?: string,
  toRef = "HEAD",
): Promise<ResolvedRange> {
  const toSha = await resolveRef(cwd, toRef);

  if (fromRef) {
    const fromSha = await resolveRef(cwd, fromRef);
    return { fromRef, toRef, fromSha, toSha };
  }

  const latestTag = await getLatestTag(cwd);
  if (latestTag) {
    const fromSha = await resolveRef(cwd, latestTag);
    return { fromRef: latestTag, toRef, fromSha, toSha };
  }

  const rootResult = await tryGit(cwd, ["rev-list", "--max-parents=0", "HEAD"]);
  const fromSha = rootResult.ok
    ? rootResult.stdout.split("\n")[0]!.trim()
    : toSha;

  return { fromRef: fromSha, toRef, fromSha, toSha };
}

export type { ReleaseRange, ResolvedRange };
