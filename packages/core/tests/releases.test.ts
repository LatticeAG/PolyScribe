import { describe, expect, it, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import {
  createGitHubRelease,
  getReleaseByTag,
  tagExists,
  updateGitHubRelease,
} from "../src/github/releases.js";

function createMockOctokit(handlers: {
  getRef?: ReturnType<typeof vi.fn>;
  getReleaseByTag?: ReturnType<typeof vi.fn>;
  createRelease?: ReturnType<typeof vi.fn>;
  updateRelease?: ReturnType<typeof vi.fn>;
}): Octokit {
  return {
    git: {
      getRef: handlers.getRef ?? vi.fn(),
    },
    repos: {
      getReleaseByTag: handlers.getReleaseByTag ?? vi.fn(),
      createRelease: handlers.createRelease ?? vi.fn(),
      updateRelease: handlers.updateRelease ?? vi.fn(),
    },
  } as unknown as Octokit;
}

describe("tagExists", () => {
  it("returns true when the tag ref exists", async () => {
    const getRef = vi.fn().mockResolvedValue({ data: { ref: "refs/tags/v1.0.0" } });
    const octokit = createMockOctokit({ getRef });

    await expect(tagExists(octokit, "acme", "demo", "v1.0.0")).resolves.toBe(true);
    expect(getRef).toHaveBeenCalledWith({
      owner: "acme",
      repo: "demo",
      ref: "tags/v1.0.0",
    });
  });

  it("returns false when the tag ref is missing", async () => {
    const getRef = vi.fn().mockRejectedValue({ status: 404 });
    const octokit = createMockOctokit({ getRef });

    await expect(tagExists(octokit, "acme", "demo", "v1.0.0")).resolves.toBe(false);
  });

  it("rethrows non-404 errors", async () => {
    const getRef = vi.fn().mockRejectedValue({ status: 500, message: "server error" });
    const octokit = createMockOctokit({ getRef });

    await expect(tagExists(octokit, "acme", "demo", "v1.0.0")).rejects.toEqual({
      status: 500,
      message: "server error",
    });
  });
});

describe("getReleaseByTag", () => {
  it("returns release data when found", async () => {
    const release = {
      id: 42,
      html_url: "https://github.com/acme/demo/releases/tag/v1.0.0",
      tag_name: "v1.0.0",
      draft: false,
      prerelease: false,
    };
    const getReleaseByTagMock = vi.fn().mockResolvedValue({ data: release });
    const octokit = createMockOctokit({ getReleaseByTag: getReleaseByTagMock });

    await expect(
      getReleaseByTag(octokit, "acme", "demo", "v1.0.0"),
    ).resolves.toEqual(release);
  });

  it("returns null when release is missing", async () => {
    const getReleaseByTagMock = vi.fn().mockRejectedValue({ status: 404 });
    const octokit = createMockOctokit({ getReleaseByTag: getReleaseByTagMock });

    await expect(
      getReleaseByTag(octokit, "acme", "demo", "v1.0.0"),
    ).resolves.toBeNull();
  });
});

describe("createGitHubRelease", () => {
  it("creates a release and maps the result", async () => {
    const createRelease = vi.fn().mockResolvedValue({
      data: {
        id: 7,
        html_url: "https://github.com/acme/demo/releases/tag/v2.0.0",
        tag_name: "v2.0.0",
        draft: true,
        prerelease: false,
      },
    });
    const octokit = createMockOctokit({ createRelease });

    const result = await createGitHubRelease(
      {
        token: "ghp_test",
        owner: "acme",
        repo: "demo",
        tag: "v2.0.0",
        title: "v2.0.0",
        body: "## Changes\n- Initial release",
        draft: true,
      },
      octokit,
    );

    expect(createRelease).toHaveBeenCalledWith({
      owner: "acme",
      repo: "demo",
      tag_name: "v2.0.0",
      name: "v2.0.0",
      body: "## Changes\n- Initial release",
      draft: true,
      prerelease: false,
    });
    expect(result).toEqual({
      id: 7,
      htmlUrl: "https://github.com/acme/demo/releases/tag/v2.0.0",
      tagName: "v2.0.0",
      draft: true,
      prerelease: false,
      created: true,
    });
  });
});

describe("updateGitHubRelease", () => {
  it("updates a release and maps the result", async () => {
    const updateRelease = vi.fn().mockResolvedValue({
      data: {
        id: 7,
        html_url: "https://github.com/acme/demo/releases/tag/v2.0.0",
        tag_name: "v2.0.0",
        draft: false,
        prerelease: true,
      },
    });
    const octokit = createMockOctokit({ updateRelease });

    const result = await updateGitHubRelease(
      {
        token: "ghp_test",
        owner: "acme",
        repo: "demo",
        tag: "v2.0.0",
        title: "Release 2.0",
        body: "Updated notes",
        prerelease: true,
        releaseId: 7,
      },
      octokit,
    );

    expect(updateRelease).toHaveBeenCalledWith({
      owner: "acme",
      repo: "demo",
      release_id: 7,
      tag_name: "v2.0.0",
      name: "Release 2.0",
      body: "Updated notes",
      draft: false,
      prerelease: true,
    });
    expect(result).toEqual({
      id: 7,
      htmlUrl: "https://github.com/acme/demo/releases/tag/v2.0.0",
      tagName: "v2.0.0",
      draft: false,
      prerelease: true,
      created: false,
    });
  });
});
