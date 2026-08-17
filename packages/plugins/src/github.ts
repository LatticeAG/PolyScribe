import {
  createDirectRelationObservation,
  createEvidenceObservation,
  createEvidenceTombstone,
  type ConnectorPlugin,
  type DirectRelationObservation,
  type EvidenceActor,
  type EvidenceAuthority,
  type EvidenceObservation,
  type EvidenceRelationType,
  type ExternalEvidenceRef,
  type PluginManifest,
} from "@polyscribe/plugin-sdk";
import {
  defaultConnectionValidation,
  defaultHealth,
  defaultScopeDiscovery,
  emptyRevokeResult,
  type ProviderFetcher,
  type ProviderSyncPayload,
} from "./shared.js";

export const GITHUB_PLUGIN_ID = "io.polyscribe.github";

export interface GitHubConnectorConfig {
  readonly repository?: string;
  readonly includeIssues?: boolean;
}

export interface GitHubActorInput {
  readonly id: string | number;
  readonly login?: string;
  readonly name?: string;
  readonly url?: string;
}

interface GitHubRecordBase {
  readonly kind: "pull_request" | "commit" | "issue" | "release";
  readonly url?: string;
  readonly revision?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly deleted?: boolean;
  readonly deletedAt?: string;
  readonly author?: GitHubActorInput;
  readonly participants?: readonly GitHubActorInput[];
  readonly labels?: readonly string[];
  readonly visibility?: "public" | "internal" | "restricted" | "embargoed";
}

export interface GitHubPullRequest extends GitHubRecordBase {
  readonly kind: "pull_request";
  readonly number: number;
  readonly title: string;
  readonly body?: string;
  readonly state?: string;
  readonly mergedAt?: string;
  readonly mergeCommitSha?: string;
  readonly linkedIssueNumbers?: readonly number[];
  readonly closingIssueNumbers?: readonly number[];
}

export interface GitHubCommit extends GitHubRecordBase {
  readonly kind: "commit";
  readonly sha: string;
  readonly message: string;
  readonly pullRequestNumbers?: readonly number[];
}

export interface GitHubIssue extends GitHubRecordBase {
  readonly kind: "issue";
  readonly number: number;
  readonly title: string;
  readonly body?: string;
  readonly state?: string;
  readonly pullRequestNumbers?: readonly number[];
}

export interface GitHubRelease extends GitHubRecordBase {
  readonly kind: "release";
  readonly id: string | number;
  readonly tagName: string;
  readonly title?: string;
  readonly body?: string;
  readonly publishedAt?: string;
}

export type GitHubSourceRecord =
  | GitHubPullRequest
  | GitHubCommit
  | GitHubIssue
  | GitHubRelease;

export interface NormalizeGitHubOptions {
  readonly connectionId: string;
  readonly observedAt: string;
  readonly completeness?: "complete" | "partial" | "unknown" | "not-applicable";
  readonly connectorVersion?: string;
}

export const githubConnectorManifest: PluginManifest = {
  schemaVersion: "polyscribe/plugin-manifest@1",
  id: GITHUB_PLUGIN_ID,
  displayName: "GitHub",
  version: "1.0.0",
  apiVersion: { minimum: "1.0", maximum: "1.0" },
  capabilities: [
    {
      type: "connector",
      operations: [
        "validateConnection",
        "discoverScopes",
        "sync",
        "health",
        "revoke",
      ],
    },
  ],
  configurationSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      repository: { type: "string" },
      includeIssues: { type: "boolean" },
    },
  },
  auth: {
    methods: ["api-token", "oauth2", "github-app"],
    credentialBrokerRequired: true,
    identity: "either",
  },
  permissions: ["Read selected repository commits, pull requests, issues, and releases"],
  objectKinds: ["pull_request", "commit", "issue", "release"],
  syncModes: ["poll", "backfill", "webhook"],
  dataPolicy: {
    defaultSensitivity: "internal",
    permittedHostnames: ["api.github.com", "github.com"],
    retentionRequired: false,
  },
  integrity: {},
};

function actor(input: GitHubActorInput | undefined): EvidenceActor | undefined {
  if (!input) return undefined;
  return {
    externalId: String(input.id),
    login: input.login,
    displayName: input.name,
    url: input.url,
  };
}

function externalId(record: GitHubSourceRecord): string {
  switch (record.kind) {
    case "pull_request":
    case "issue":
      return String(record.number);
    case "commit":
      return record.sha;
    case "release":
      return String(record.id);
  }
}

function title(record: GitHubSourceRecord): string | undefined {
  if (record.kind === "commit") return record.message.split("\n", 1)[0];
  if (record.kind === "release") return record.title ?? record.tagName;
  return record.title;
}

function excerpt(record: GitHubSourceRecord): string | undefined {
  if (record.kind === "commit") return record.message;
  return record.body;
}

function revision(record: GitHubSourceRecord): string {
  if (record.revision) return record.revision;
  if (record.updatedAt) return record.updatedAt;
  if (record.kind === "commit") return record.sha;
  if (record.kind === "pull_request" && record.mergedAt) return record.mergedAt;
  if (record.kind === "release" && record.publishedAt) return record.publishedAt;
  if (record.deletedAt) return record.deletedAt;
  return externalId(record);
}

function authority(record: GitHubSourceRecord): EvidenceAuthority {
  if (record.kind === "issue") return "intent";
  if (record.kind === "release") return "historical-publication";
  return "delivery";
}

function sourceReference(
  record: GitHubSourceRecord,
  connectionId: string,
): ExternalEvidenceRef {
  return {
    pluginId: GITHUB_PLUGIN_ID,
    connectionId,
    objectKind: record.kind,
    externalId: externalId(record),
  };
}

function targetReference(
  connectionId: string,
  objectKind: "issue" | "pull_request" | "commit",
  id: string | number,
): ExternalEvidenceRef {
  return {
    pluginId: GITHUB_PLUGIN_ID,
    connectionId,
    objectKind,
    externalId: String(id),
  };
}

/** Normalize a GitHub payload without assigning it release membership or prose. */
export function normalizeGitHubRecord(
  record: GitHubSourceRecord,
  options: NormalizeGitHubOptions,
): EvidenceObservation {
  const source = sourceReference(record, options.connectionId);
  const input = {
    source,
    externalRevision: revision(record),
    canonicalUrl: record.url,
    observedAt: options.observedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    author: actor(record.author),
    participants: record.participants?.map(actor).filter((value): value is EvidenceActor => Boolean(value)),
    content: {
      title: title(record),
      excerpt: excerpt(record),
      fields: {
        labels: record.labels ?? [],
        kind: record.kind,
        ...(record.kind === "pull_request"
          ? {
              number: record.number,
              state: record.state,
              mergedAt: record.mergedAt,
              mergeCommitSha: record.mergeCommitSha,
            }
          : {}),
        ...(record.kind === "commit" ? { sha: record.sha } : {}),
        ...(record.kind === "issue" ? { number: record.number, state: record.state } : {}),
        ...(record.kind === "release"
          ? { tagName: record.tagName, publishedAt: record.publishedAt }
          : {}),
      },
    },
    authority: authority(record),
    sensitivity: record.visibility ?? "internal",
    redactionPolicyVersion: "plugin-input@1",
    connectorVersion: options.connectorVersion ?? "1.0.0",
    completeness: options.completeness ?? "complete",
  } as const;

  if (record.deleted) {
    return createEvidenceTombstone({
      ...input,
      deletedAt: record.deletedAt ?? options.observedAt,
    });
  }

  return createEvidenceObservation(input);
}

/** Emits only relations GitHub exposed directly in the supplied payload. */
export function directGitHubRelations(
  record: GitHubSourceRecord,
  options: NormalizeGitHubOptions,
): readonly DirectRelationObservation[] {
  if (record.deleted) return [];

  const from = sourceReference(record, options.connectionId);
  const sourceRevision = revision(record);
  const relations: DirectRelationObservation[] = [];
  const add = (
    type: EvidenceRelationType,
    to: ExternalEvidenceRef,
    explanation?: string,
  ) => {
    relations.push(
      createDirectRelationObservation({
        from,
        to,
        type,
        authority: authority(record),
        sourceRevision,
        observedAt: options.observedAt,
        explanation,
      }),
    );
  };

  if (record.kind === "pull_request") {
    if (record.mergeCommitSha) {
      add(
        "merged-as",
        targetReference(options.connectionId, "commit", record.mergeCommitSha),
        "GitHub merge commit association",
      );
    }
    for (const number of record.linkedIssueNumbers ?? []) {
      add("references", targetReference(options.connectionId, "issue", number));
    }
    for (const number of record.closingIssueNumbers ?? []) {
      add("closes", targetReference(options.connectionId, "issue", number));
    }
  }

  if (record.kind === "commit" || record.kind === "issue") {
    for (const number of record.pullRequestNumbers ?? []) {
      add(
        record.kind === "commit" ? "implements" : "references",
        targetReference(options.connectionId, "pull_request", number),
      );
    }
  }

  return Object.freeze(
    [...new Map(relations.map((relation) => [relation.id, relation])).values()],
  );
}

export type GitHubConnectorFetcher = ProviderFetcher<
  GitHubConnectorConfig,
  GitHubSourceRecord
>;

/**
 * Adapter factory deliberately accepts a fetcher. Credentials, HTTP and retry
 * policy remain host-owned and tests can run entirely from static payloads.
 */
export function createGitHubConnector(
  fetcher: GitHubConnectorFetcher,
): ConnectorPlugin<GitHubConnectorConfig> {
  return {
    manifest: githubConnectorManifest,
    validateConnection: (request) =>
      fetcher.validateConnection?.(request) ?? Promise.resolve(defaultConnectionValidation()),
    discoverScopes: (request) =>
      fetcher.discoverScopes?.(request) ?? Promise.resolve(defaultScopeDiscovery()),
    async sync(request) {
      const payload: ProviderSyncPayload<GitHubSourceRecord> = await fetcher.sync(request);
      const options: NormalizeGitHubOptions = {
        connectionId: request.connection.id,
        observedAt: payload.observedAt,
        completeness: payload.partial ? "partial" : "complete",
      };
      return {
        observations: payload.items.map((item) => normalizeGitHubRecord(item, options)),
        directRelations: payload.items.flatMap((item) => directGitHubRelations(item, options)),
        nextCursor: payload.nextCursor,
        watermark: payload.watermark,
        partial: payload.partial ?? false,
        incompleteScopes: payload.incompleteScopes,
        diagnostics: [],
      };
    },
    health: (connection) => fetcher.health?.(connection) ?? Promise.resolve(defaultHealth()),
    revoke: (connection) => fetcher.revoke?.(connection) ?? Promise.resolve(emptyRevokeResult()),
  };
}
