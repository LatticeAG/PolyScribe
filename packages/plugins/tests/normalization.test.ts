import { describe, expect, it, vi } from "vitest";
import { validatePluginManifest } from "@polyscribe/plugin-sdk";
import {
  createGitHubConnector,
  directGitHubRelations,
  githubConnectorManifest,
  normalizeGitHubRecord,
} from "../src/github.js";
import {
  directJiraRelations,
  jiraConnectorManifest,
  normalizeJiraIssue,
} from "../src/jira.js";
import {
  linearConnectorManifest,
  normalizeLinearIssue,
} from "../src/linear.js";

const observedAt = "2026-07-21T12:00:00Z";

describe("first-party connector manifests", () => {
  it("exposes valid, versioned manifests", () => {
    for (const manifest of [
      githubConnectorManifest,
      jiraConnectorManifest,
      linearConnectorManifest,
    ]) {
      expect(validatePluginManifest(manifest)).toEqual({
        valid: true,
        diagnostics: [],
      });
    }
  });
});

describe("GitHub normalization", () => {
  const pullRequest = {
    kind: "pull_request" as const,
    number: 128,
    title: "Add webhook retries",
    body: "Retries failed webhook deliveries.",
    url: "https://github.com/acme/demo/pull/128",
    updatedAt: "2026-07-21T10:00:00Z",
    author: { id: 1, login: "alice" },
    labels: ["feature"],
    mergeCommitSha: "a1b2c3",
    linkedIssueNumbers: [120],
    closingIssueNumbers: [121],
  };

  it("creates a provider-neutral delivery observation and direct provider links", () => {
    const options = { connectionId: "conn_github", observedAt };
    const observation = normalizeGitHubRecord(pullRequest, options);
    const relations = directGitHubRelations(pullRequest, options);

    expect(observation).toMatchObject({
      operation: "upsert",
      source: {
        pluginId: "io.polyscribe.github",
        connectionId: "conn_github",
        objectKind: "pull_request",
        externalId: "128",
      },
      authority: "delivery",
      content: {
        title: "Add webhook retries",
        fields: { mergeCommitSha: "a1b2c3", labels: ["feature"] },
      },
    });
    expect(relations.map((relation) => relation.type)).toEqual(
      expect.arrayContaining(["merged-as", "references", "closes"]),
    );
    expect(relations.every((relation) => relation.method === "provider-direct")).toBe(
      true,
    );
  });

  it("uses an injected fetcher and carries its cursor without making a network call", async () => {
    const sync = vi.fn(async () => ({
      items: [pullRequest],
      observedAt,
      nextCursor: "github-page-2",
      partial: true,
      incompleteScopes: ["repository:acme/demo"],
    }));
    const connector = createGitHubConnector({ sync });

    const result = await connector.sync({
      connection: {
        id: "conn_github",
        pluginId: "io.polyscribe.github",
        config: { repository: "acme/demo" },
      },
      scopes: [],
      objectKinds: ["pull_request"],
      cursor: "github-page-1",
      idempotencyKey: "sync-1",
    });

    expect(sync).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: "github-page-1", idempotencyKey: "sync-1" }),
    );
    expect(result).toMatchObject({
      nextCursor: "github-page-2",
      partial: true,
      incompleteScopes: ["repository:acme/demo"],
    });
    expect(result.observations[0]?.completeness).toBe("partial");
  });
});

describe("Jira normalization", () => {
  it("keeps tracker evidence as intent and preserves explicit cross-provider links", () => {
    const issue = {
      key: "API-184",
      id: "100184",
      summary: "Webhook delivery failures",
      description: "Track retry behavior.",
      status: "In Progress",
      updatedAt: "2026-07-21T09:00:00Z",
      directLinks: [
        {
          targetPluginId: "io.polyscribe.github",
          targetObjectKind: "pull_request",
          targetExternalId: "128",
          type: "explains" as const,
        },
      ],
    };
    const options = { connectionId: "conn_jira", observedAt };
    const observation = normalizeJiraIssue(issue, options);
    const relations = directJiraRelations(issue, options);

    expect(observation.authority).toBe("intent");
    expect(observation.source.externalId).toBe("API-184");
    expect(relations[0]).toMatchObject({
      type: "explains",
      to: {
        pluginId: "io.polyscribe.github",
        objectKind: "pull_request",
        externalId: "128",
      },
    });
    expect(relations[0]?.to.connectionId).toBeUndefined();
  });
});

describe("Linear normalization", () => {
  it("represents a removed issue as a tombstone instead of silently dropping it", () => {
    const observation = normalizeLinearIssue(
      {
        id: "linear-id-1",
        identifier: "ENG-42",
        title: "Remove legacy workflow",
        deleted: true,
        deletedAt: "2026-07-21T11:00:00Z",
      },
      { connectionId: "conn_linear", observedAt },
    );

    expect(observation).toMatchObject({
      operation: "tombstone",
      authority: "intent",
      deletedAt: "2026-07-21T11:00:00Z",
      source: { pluginId: "io.polyscribe.linear", externalId: "ENG-42" },
    });
    expect(Object.isFrozen(observation)).toBe(true);
  });
});
