import type {
  PublicationPlan,
  PublicationReceipt,
  PublicationTarget,
  PublicationValidation,
  RenderedEditionArtifact,
} from "./types.js";
import { hasValidArtifactHash } from "./types.js";
import { sha256 } from "./hash.js";

export interface GitHubReleaseTargetConfig {
  owner: string;
  repo: string;
  tag: string;
  name?: string;
  prerelease?: boolean;
  draft?: boolean;
  /** Updating an existing release is always opt-in. */
  updateExisting?: boolean;
}

export interface GitHubReleaseRemote {
  id: number | string;
  htmlUrl: string;
  body?: string | null;
}

/** Minimal Octokit-shaped boundary that keeps a publisher easy to test. */
export interface GitHubReleaseGateway {
  getReleaseByTag(input: {
    owner: string;
    repo: string;
    tag: string;
  }): Promise<GitHubReleaseRemote | undefined>;
  createRelease(input: {
    owner: string;
    repo: string;
    tag: string;
    name: string;
    body: string;
    prerelease: boolean;
    draft: boolean;
  }): Promise<GitHubReleaseRemote>;
  updateRelease(input: {
    owner: string;
    repo: string;
    releaseId: number | string;
    tag: string;
    name: string;
    body: string;
    prerelease: boolean;
    draft: boolean;
  }): Promise<GitHubReleaseRemote>;
}

export function createGitHubReleasePublisher(
  gateway: GitHubReleaseGateway,
  id = "github-release",
): PublicationTarget<GitHubReleaseTargetConfig> {
  return {
    id,
    kind: "github-release",
    validate(plan) {
      return validateGitHubReleasePlan(plan);
    },
    preview(plan) {
      return plan.artifact;
    },
    async publish(plan) {
      const validation = validateGitHubReleasePlan(plan);
      if (!validation.ok) {
        return failedReceipt(plan, validation.blockers.join(" "));
      }

      try {
        const existing = await gateway.getReleaseByTag({
          owner: plan.configuration.owner,
          repo: plan.configuration.repo,
          tag: plan.configuration.tag,
        });
        if (existing?.body === plan.artifact.content) {
          return successfulReceipt(plan, existing);
        }
        const release = existing
          ? await updateExisting(gateway, plan, existing)
          : await gateway.createRelease(toCreateInput(plan));

        return successfulReceipt(plan, release);
      } catch (error) {
        return failedReceipt(plan, errorMessage(error), true);
      }
    },
    async reconcile(plan) {
      try {
        const remote = await gateway.getReleaseByTag({
          owner: plan.configuration.owner,
          repo: plan.configuration.repo,
          tag: plan.configuration.tag,
        });
        if (!remote || remote.body !== plan.artifact.content) {
          return undefined;
        }
        return successfulReceipt(plan, remote);
      } catch (error) {
        return failedReceipt(plan, errorMessage(error), true);
      }
    },
  };
}

export function validateGitHubReleasePlan(
  plan: PublicationPlan<GitHubReleaseTargetConfig>,
): PublicationValidation {
  const blockers: string[] = [];
  if (!plan.approved) blockers.push("The edition revision has not been approved.");
  if (!plan.configuration.owner || !plan.configuration.repo || !plan.configuration.tag) {
    blockers.push("GitHub owner, repository, and tag are required.");
  }
  if (plan.artifact.visibility !== "public") {
    blockers.push("A GitHub Release can only receive a public edition artifact.");
  }
  if (!hasValidArtifactHash(plan.artifact)) {
    blockers.push("The rendered artifact content hash does not match its content.");
  }
  return { ok: blockers.length === 0, warnings: [], blockers };
}

function toCreateInput(plan: PublicationPlan<GitHubReleaseTargetConfig>) {
  const { owner, repo, tag, name, prerelease = false, draft = false } = plan.configuration;
  return {
    owner,
    repo,
    tag,
    name: name ?? tag,
    body: plan.artifact.content,
    prerelease,
    draft,
  };
}

async function updateExisting(
  gateway: GitHubReleaseGateway,
  plan: PublicationPlan<GitHubReleaseTargetConfig>,
  existing: GitHubReleaseRemote,
): Promise<GitHubReleaseRemote> {
  if (!plan.configuration.updateExisting) {
    throw new Error("A release already exists for this tag; enable updateExisting to amend it.");
  }
  const input = toCreateInput(plan);
  return gateway.updateRelease({ ...input, releaseId: existing.id });
}

function failedReceipt(
  plan: PublicationPlan<GitHubReleaseTargetConfig>,
  message: string,
  retryable = false,
): PublicationReceipt {
  return {
    status: retryable ? "retryable_failed" : "failed",
    targetId: plan.targetId,
    idempotencyKey: plan.idempotencyKey,
    contentHash: plan.artifact.contentHash,
    message,
    retryable,
  };
}

function successfulReceipt(
  plan: PublicationPlan<GitHubReleaseTargetConfig>,
  release: GitHubReleaseRemote,
): PublicationReceipt {
  return {
    status: "succeeded",
    targetId: plan.targetId,
    idempotencyKey: plan.idempotencyKey,
    contentHash: plan.artifact.contentHash,
    publishedAt: new Date().toISOString(),
    remoteId: String(release.id),
    remoteUrl: release.htmlUrl,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "GitHub Release publishing failed.";
}

export function githubReleaseArtifact(content: string): RenderedEditionArtifact {
  return {
    contentRevisionId: "unbound",
    editionRevisionId: "unbound",
    audience: "developer",
    visibility: "public",
    content,
    contentHash: sha256(content),
    templateVersion: "github-release@1",
  };
}
