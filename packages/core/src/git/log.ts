import type { CommitInfo } from "../types.js";
import { git } from "./exec.js";

export async function getCommitsInRange(
  cwd: string,
  fromSha: string,
  toSha: string,
): Promise<CommitInfo[]> {
  const format = "%H%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%b";
  const result = await git(cwd, [
    "log",
    `${fromSha}..${toSha}`,
    "--no-merges",
    `--format=${format}`,
  ]);

  if (!result.stdout.trim()) {
    return [];
  }

  return result.stdout.split("\n").map((line) => {
    const [sha, login, email, committedAt, title, body] = line.split("\x1f");
    return {
      sha: sha!,
      title: title!,
      body: body || undefined,
      author: { login: login || "unknown", id: email || sha!.slice(0, 7) },
      committedAt: committedAt!,
    };
  });
}
