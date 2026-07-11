import { getFileChanges } from "../git/diff.js";
import { getCommitsInRange } from "../git/log.js";
import { resolveRange } from "../git/refs.js";
import { detectRemoteRepo, getCommitDate } from "../github/client.js";
import { fetchMergedPrsInRange } from "../github/prs.js";
import type {
  CollectSourcesConfig,
  CommitInfo,
  ReleaseRange,
  ResolvedRange,
  SourceItem,
} from "../types.js";

function commitToSourceItem(
  commit: CommitInfo,
  remote?: { owner: string; repo: string; host: string } | null,
): SourceItem {
  const url =
    remote?.host === "github.com"
      ? `https://github.com/${remote.owner}/${remote.repo}/commit/${commit.sha}`
      : `commit:${commit.sha}`;

  return {
    id: `commit:${commit.sha}`,
    type: "commit",
    sha: commit.sha,
    title: commit.title,
    body: commit.body,
    author: commit.author,
    labels: [],
    url,
  };
}

function collectPrCommitShas(prItems: SourceItem[]): Set<string> {
  const shas = new Set<string>();
  for (const item of prItems) {
    if (item.sha) shas.add(item.sha);
  }
  return shas;
}

export async function collectSources(
  cwd: string,
  range: ReleaseRange | ResolvedRange,
  config: CollectSourcesConfig,
): Promise<SourceItem[]> {
  const resolved =
    "fromSha" in range
      ? range
      : await resolveRange(cwd, range.fromRef, range.toRef);

  const remote = await detectRemoteRepo(cwd);
  const [commits, fileChanges] = await Promise.all([
    getCommitsInRange(cwd, resolved.fromSha, resolved.toSha),
    getFileChanges(cwd, resolved.fromSha, resolved.toSha, {
      ignoreGlobs: config.ignoreGlobs,
      maxDiffBytesPerFile: config.maxDiffBytesPerFile,
      maxTotalDiffBytes: config.maxTotalDiffBytes,
    }),
  ]);

  const since =
    (await getCommitDate(cwd, resolved.fromSha)) ?? new Date(0).toISOString();
  const until =
    (await getCommitDate(cwd, resolved.toSha)) ?? new Date().toISOString();

  const prItems = remote
    ? await fetchMergedPrsInRange(remote, config.githubToken, since, until)
    : [];

  const prCommitShas = collectPrCommitShas(prItems);
  const orphanCommits = commits
    .filter((commit) => !prCommitShas.has(commit.sha))
    .map((commit) => commitToSourceItem(commit, remote));

  const diffItems: SourceItem[] = fileChanges.slice(0, 20).map((change) => ({
    id: `diff:${change.path}`,
    type: "diff" as const,
    title: `Change: ${change.path}`,
    author: { login: "git", id: "git" },
    labels: [],
    files: [change],
    url:
      remote?.host === "github.com"
        ? `https://github.com/${remote.owner}/${remote.repo}/blob/HEAD/${change.path}`
        : `file:${change.path}`,
  }));

  return [...prItems, ...orphanCommits, ...diffItems];
}
