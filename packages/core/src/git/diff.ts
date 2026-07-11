import type { FileChange } from "../types.js";
import { shouldIgnorePath } from "../ingest/filter.js";
import { git } from "./exec.js";

function parseNumstatLine(line: string): {
  path: string;
  additions: number;
  deletions: number;
} | null {
  const parts = line.split("\t");
  if (parts.length < 3) return null;

  const [addRaw, delRaw, path] = parts;
  if (!path || path === "-") return null;

  return {
    path,
    additions: Number(addRaw) || 0,
    deletions: Number(delRaw) || 0,
  };
}

export async function getFileChanges(
  cwd: string,
  fromSha: string,
  toSha: string,
  options: {
    ignoreGlobs: string[];
    maxDiffBytesPerFile: number;
    maxTotalDiffBytes: number;
  },
): Promise<FileChange[]> {
  const result = await git(cwd, ["diff", "--numstat", `${fromSha}..${toSha}`]);

  const changes: FileChange[] = [];
  let totalBytes = 0;

  for (const line of result.stdout.split("\n")) {
    const stat = parseNumstatLine(line.trim());
    if (!stat) continue;
    if (shouldIgnorePath(stat.path, options.ignoreGlobs)) continue;

    const patchResult = await git(cwd, [
      "diff",
      `${fromSha}..${toSha}`,
      "--",
      stat.path,
    ]);
    let patch = patchResult.stdout;
    if (patch.length > options.maxDiffBytesPerFile) {
      patch = `${patch.slice(0, options.maxDiffBytesPerFile)}\n… [truncated]`;
    }

    totalBytes += patch.length;
    if (totalBytes > options.maxTotalDiffBytes) {
      break;
    }

    changes.push({
      path: stat.path,
      status: "modified",
      additions: stat.additions,
      deletions: stat.deletions,
      patch: patch || undefined,
    });
  }

  return changes;
}
