import type { RemoteRepo, SourceItem } from "../types.js";
import { createOctokit } from "./client.js";

const LINKED_ISSUE_PATTERN =
  /\b(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\s+#(\d+)\b/gi;

export function parseLinkedIssues(
  body?: string | null,
): Array<{ number: number; title: string }> {
  if (!body) return [];

  const issues = new Map<number, { number: number; title: string }>();

  for (const match of body.matchAll(LINKED_ISSUE_PATTERN)) {
    const number = Number(match[1]);
    if (!Number.isFinite(number)) continue;
    issues.set(number, { number, title: `Issue #${number}` });
  }

  return [...issues.values()];
}

export function mapPrToSourceItem(
  pr: {
    number: number;
    title: string;
    body?: string | null;
    user?: { login?: string | null; id?: number | null } | null;
    merged_at?: string | null;
    merge_commit_sha?: string | null;
    labels?: Array<{ name?: string | null } | string>;
    html_url?: string;
  },
  remote?: RemoteRepo | null,
): SourceItem {
  const labels = (pr.labels ?? [])
    .map((label) => (typeof label === "string" ? label : (label.name ?? "")))
    .filter(Boolean);

  return {
    id: `pr:${pr.number}`,
    type: "pr",
    prNumber: pr.number,
    sha: pr.merge_commit_sha ?? undefined,
    title: pr.title,
    body: pr.body ?? undefined,
    author: {
      login: pr.user?.login ?? "unknown",
      id: String(pr.user?.id ?? pr.number),
    },
    mergedAt: pr.merged_at ?? undefined,
    labels,
    linkedIssues: parseLinkedIssues(pr.body),
    url:
      pr.html_url ??
      (remote
        ? `https://${remote.host}/${remote.owner}/${remote.repo}/pull/${pr.number}`
        : `pr:${pr.number}`),
  };
}

export async function fetchMergedPrsInRange(
  remote: RemoteRepo,
  token: string | undefined,
  since: string,
  until: string,
): Promise<SourceItem[]> {
  if (!token || remote.host !== "github.com") {
    return [];
  }

  const octokit = createOctokit(token);
  if (!octokit) return [];

  const items: SourceItem[] = [];
  let page = 1;

  while (page <= 5) {
    const response = await octokit.pulls.list({
      owner: remote.owner,
      repo: remote.repo,
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: 100,
      page,
    });

    if (response.data.length === 0) break;

    for (const pr of response.data) {
      if (!pr.merged_at) continue;
      if (pr.merged_at < since || pr.merged_at > until) continue;
      items.push(mapPrToSourceItem(pr, remote));
    }

    page += 1;
  }

  return items;
}
