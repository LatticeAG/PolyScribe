import { Octokit } from "@octokit/rest";
import type { RemoteRepo, SourceItem } from "../types.js";

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

  const octokit = new Octokit({ auth: token });
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
