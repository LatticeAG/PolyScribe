import { describe, expect, it, vi } from "vitest";
import {
  createGitHubReleasePublisher,
  createRssPublisher,
  publicationIdempotencyKey,
  renderRssFeed,
  sha256,
  type GitHubReleaseGateway,
  type PublicationPlan,
  type RenderedEditionArtifact,
  type RssFeedStore,
} from "../src/v3/publish/index.js";

function artifact(overrides: Partial<RenderedEditionArtifact> = {}): RenderedEditionArtifact {
  const content = overrides.content ?? "# v1.2.3\n\n- Adds retry controls.";
  return {
    contentRevisionId: "rev_123",
    editionRevisionId: "ed_123",
    audience: "developer",
    visibility: "public",
    content,
    contentHash: sha256(content),
    templateVersion: "markdown@1",
    ...overrides,
  };
}

function githubPlan(overrides: Partial<PublicationPlan> = {}): PublicationPlan<{
  owner: string;
  repo: string;
  tag: string;
  updateExisting?: boolean;
}> {
  const rendered = artifact();
  return {
    planId: "pub_123",
    targetId: "github",
    targetKind: "github-release",
    artifact: rendered,
    configuration: { owner: "lattice", repo: "polyscribe", tag: "v1.2.3" },
    idempotencyKey: publicationIdempotencyKey(rendered.contentRevisionId, "github", rendered.contentHash),
    createdAt: "2026-07-21T00:00:00.000Z",
    approved: true,
    ...overrides,
  };
}

describe("V3 publication targets", () => {
  it("creates an idempotent GitHub Release receipt from an approved public edition", async () => {
    const gateway: GitHubReleaseGateway = {
      getReleaseByTag: vi.fn().mockResolvedValue(undefined),
      createRelease: vi.fn().mockResolvedValue({ id: 19, htmlUrl: "https://github.test/releases/19" }),
      updateRelease: vi.fn(),
    };
    const publisher = createGitHubReleasePublisher(gateway, "github");
    const plan = githubPlan();

    expect(await publisher.validate(plan)).toEqual({ ok: true, warnings: [], blockers: [] });
    await expect(publisher.publish(plan)).resolves.toMatchObject({
      status: "succeeded",
      remoteId: "19",
      remoteUrl: "https://github.test/releases/19",
      contentHash: plan.artifact.contentHash,
    });
    expect(gateway.createRelease).toHaveBeenCalledWith(expect.objectContaining({
      tag: "v1.2.3",
      body: plan.artifact.content,
    }));

    vi.mocked(gateway.getReleaseByTag).mockResolvedValue({
      id: 19,
      htmlUrl: "https://github.test/releases/19",
      body: plan.artifact.content,
    });
    await expect(publisher.publish(plan)).resolves.toMatchObject({ status: "succeeded", remoteId: "19" });
    expect(gateway.createRelease).toHaveBeenCalledTimes(1);
    expect(gateway.updateRelease).not.toHaveBeenCalled();
  });

  it("does not amend an existing GitHub Release without explicit update policy", async () => {
    const gateway: GitHubReleaseGateway = {
      getReleaseByTag: vi.fn().mockResolvedValue({ id: 19, htmlUrl: "https://github.test/releases/19" }),
      createRelease: vi.fn(),
      updateRelease: vi.fn(),
    };
    const receipt = await createGitHubReleasePublisher(gateway).publish(githubPlan());

    expect(receipt).toMatchObject({ status: "retryable_failed", retryable: true });
    expect(gateway.updateRelease).not.toHaveBeenCalled();
  });

  it("blocks restricted material before a public GitHub Release target", async () => {
    const gateway: GitHubReleaseGateway = {
      getReleaseByTag: vi.fn(),
      createRelease: vi.fn(),
      updateRelease: vi.fn(),
    };
    const plan = githubPlan({ artifact: artifact({ visibility: "restricted" }) });
    const validation = await createGitHubReleasePublisher(gateway).validate(plan);

    expect(validation.ok).toBe(false);
    expect(validation.blockers).toContain("A GitHub Release can only receive a public edition artifact.");
  });

  it("renders a deterministic RSS item with a stable content-revision GUID", async () => {
    const store: RssFeedStore = {
      read: vi.fn().mockResolvedValue(undefined),
      write: vi.fn().mockResolvedValue({ url: "https://example.test/releases.xml" }),
    };
    const rendered = artifact({ audience: "user", content: "A <B> improvement & fix" });
    const plan: PublicationPlan<{
      channel: { title: string; link: string; description: string };
      itemUrl: string;
    }> = {
      planId: "pub_rss",
      targetId: "rss",
      targetKind: "rss",
      artifact: rendered,
      configuration: {
        channel: { title: "PolyScribe", link: "https://example.test", description: "Releases" },
        itemUrl: "https://example.test/releases/1.2.3",
      },
      idempotencyKey: "rss-key",
      createdAt: "2026-07-21T00:00:00.000Z",
      approved: true,
    };

    expect(renderRssFeed(plan)).toContain("<![CDATA[A <B> improvement & fix]]>");
    const receipt = await createRssPublisher(store).publish(plan);
    expect(receipt).toMatchObject({ status: "succeeded", remoteId: expect.stringContaining("rev_123") });
    expect(store.write).toHaveBeenCalledWith(expect.stringContaining("polyscribe:rev_123:ed_123"), "rss-key");

    const updated = renderRssFeed(
      plan,
      `<?xml version="1.0"?><rss><channel><item><guid isPermaLink="false">polyscribe:rev_123:ed_123:${rendered.contentHash}</guid><description>old copy</description></item></channel></rss>`,
    );
    expect(updated.match(/<item>/g)).toHaveLength(1);
    expect(updated).not.toContain("old copy");
    expect(updated).toContain(rendered.content);
  });
});
