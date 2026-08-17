import type { GitHubReleaseGateway, GitHubReleaseRemote } from "./github-release.js";

interface OctokitReleaseData {
  id: number;
  html_url: string;
  body?: string | null;
}

/**
 * The narrow portion of Octokit used by the V3 target. Keeping this structural
 * lets direct mode pass the existing configured Octokit instance and keeps
 * publisher tests independent of the GitHub SDK.
 */
export interface GitHubReleaseOctokit {
  repos: {
    getReleaseByTag(input: { owner: string; repo: string; tag: string }): Promise<{ data: OctokitReleaseData }>;
    createRelease(input: {
      owner: string;
      repo: string;
      tag_name: string;
      name: string;
      body: string;
      prerelease: boolean;
      draft: boolean;
    }): Promise<{ data: OctokitReleaseData }>;
    updateRelease(input: {
      owner: string;
      repo: string;
      release_id: number;
      tag_name: string;
      name: string;
      body: string;
      prerelease: boolean;
      draft: boolean;
    }): Promise<{ data: OctokitReleaseData }>;
  };
}

/** Adapts the existing Octokit client to the V3 idempotent publisher gateway. */
export function createOctokitGitHubReleaseGateway(octokit: GitHubReleaseOctokit): GitHubReleaseGateway {
  return {
    async getReleaseByTag({ owner, repo, tag }) {
      try {
        const response = await octokit.repos.getReleaseByTag({ owner, repo, tag });
        return fromOctokit(response.data);
      } catch (error) {
        if (isNotFound(error)) return undefined;
        throw error;
      }
    },
    async createRelease({ owner, repo, tag, name, body, prerelease, draft }) {
      const response = await octokit.repos.createRelease({
        owner,
        repo,
        tag_name: tag,
        name,
        body,
        prerelease,
        draft,
      });
      return fromOctokit(response.data);
    },
    async updateRelease({ owner, repo, releaseId, tag, name, body, prerelease, draft }) {
      const response = await octokit.repos.updateRelease({
        owner,
        repo,
        release_id: typeof releaseId === "number" ? releaseId : Number(releaseId),
        tag_name: tag,
        name,
        body,
        prerelease,
        draft,
      });
      return fromOctokit(response.data);
    },
  };
}

function fromOctokit(release: OctokitReleaseData): GitHubReleaseRemote {
  return { id: release.id, htmlUrl: release.html_url, body: release.body };
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "status" in error
    && (error as { status?: unknown }).status === 404;
}
