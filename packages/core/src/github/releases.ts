import type { Octokit } from "@octokit/rest";
import type { PublishReleaseOptions, PublishReleaseResult } from "../types.js";
import { createOctokit } from "./client.js";

export async function tagExists(
  octokit: Octokit,
  owner: string,
  repo: string,
  tag: string,
): Promise<boolean> {
  try {
    await octokit.git.getRef({
      owner,
      repo,
      ref: `tags/${tag}`,
    });
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 404
    ) {
      return false;
    }
    throw error;
  }
}

export async function getReleaseByTag(
  octokit: Octokit,
  owner: string,
  repo: string,
  tag: string,
): Promise<{ id: number; html_url: string; tag_name: string; draft: boolean; prerelease: boolean } | null> {
  try {
    const response = await octokit.repos.getReleaseByTag({
      owner,
      repo,
      tag,
    });
    return response.data;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 404
    ) {
      return null;
    }
    throw error;
  }
}

function mapReleaseResult(
  release: {
    id: number;
    html_url: string;
    tag_name: string;
    draft: boolean;
    prerelease: boolean;
  },
  created: boolean,
): PublishReleaseResult {
  return {
    id: release.id,
    htmlUrl: release.html_url,
    tagName: release.tag_name,
    draft: release.draft,
    prerelease: release.prerelease,
    created,
  };
}

export async function createGitHubRelease(
  options: PublishReleaseOptions,
  octokit?: Octokit,
): Promise<PublishReleaseResult> {
  const client = octokit ?? createOctokit(options.token);
  if (!client) {
    throw new Error("GitHub token is required to create a release");
  }
  const response = await client.repos.createRelease({
    owner: options.owner,
    repo: options.repo,
    tag_name: options.tag,
    name: options.title,
    body: options.body,
    draft: options.draft ?? false,
    prerelease: options.prerelease ?? false,
  });

  return mapReleaseResult(response.data, true);
}

export async function updateGitHubRelease(
  options: PublishReleaseOptions & { releaseId: number },
  octokit?: Octokit,
): Promise<PublishReleaseResult> {
  const client = octokit ?? createOctokit(options.token);
  if (!client) {
    throw new Error("GitHub token is required to update a release");
  }
  const response = await client.repos.updateRelease({
    owner: options.owner,
    repo: options.repo,
    release_id: options.releaseId,
    tag_name: options.tag,
    name: options.title,
    body: options.body,
    draft: options.draft ?? false,
    prerelease: options.prerelease ?? false,
  });

  return mapReleaseResult(response.data, false);
}

export async function checkTagExists(
  token: string,
  owner: string,
  repo: string,
  tag: string,
): Promise<boolean> {
  const octokit = createOctokit(token);
  if (!octokit) {
    throw new Error("GitHub token is required to check tag existence");
  }
  return tagExists(octokit, owner, repo, tag);
}

export async function findReleaseByTag(
  token: string,
  owner: string,
  repo: string,
  tag: string,
): Promise<{ id: number; html_url: string; tag_name: string; draft: boolean; prerelease: boolean } | null> {
  const octokit = createOctokit(token);
  if (!octokit) {
    throw new Error("GitHub token is required to find a release");
  }
  return getReleaseByTag(octokit, owner, repo, tag);
}
