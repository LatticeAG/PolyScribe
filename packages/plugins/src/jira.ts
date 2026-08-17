import {
  createDirectRelationObservation,
  createEvidenceObservation,
  createEvidenceTombstone,
  type ConnectorPlugin,
  type DirectRelationObservation,
  type EvidenceActor,
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

export const JIRA_PLUGIN_ID = "io.polyscribe.jira";

export interface JiraConnectorConfig {
  readonly siteUrl?: string;
  readonly projectKeys?: readonly string[];
}

export interface JiraActorInput {
  readonly accountId: string;
  readonly displayName?: string;
  readonly emailAddress?: string;
  readonly url?: string;
}

/** A provider-native link; adapters never create title/similarity matches. */
export interface JiraDirectLink {
  readonly targetExternalId: string;
  readonly targetObjectKind?: string;
  readonly targetPluginId?: string;
  readonly targetConnectionId?: string;
  readonly type?: EvidenceRelationType;
  readonly explanation?: string;
}

export interface JiraIssue {
  readonly key: string;
  readonly id?: string;
  readonly url?: string;
  readonly summary: string;
  readonly description?: string;
  readonly issueType?: string;
  readonly status?: string;
  readonly labels?: readonly string[];
  readonly projectKey?: string;
  readonly fixVersions?: readonly string[];
  readonly revision?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly deleted?: boolean;
  readonly deletedAt?: string;
  readonly reporter?: JiraActorInput;
  readonly assignee?: JiraActorInput;
  readonly participants?: readonly JiraActorInput[];
  readonly visibility?: "public" | "internal" | "restricted" | "embargoed";
  readonly directLinks?: readonly JiraDirectLink[];
}

export interface NormalizeJiraOptions {
  readonly connectionId: string;
  readonly observedAt: string;
  readonly completeness?: "complete" | "partial" | "unknown" | "not-applicable";
  readonly connectorVersion?: string;
}

export const jiraConnectorManifest: PluginManifest = {
  schemaVersion: "polyscribe/plugin-manifest@1",
  id: JIRA_PLUGIN_ID,
  displayName: "Jira",
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
      siteUrl: { type: "string", format: "uri" },
      projectKeys: { type: "array", items: { type: "string" } },
    },
  },
  auth: {
    methods: ["api-token", "oauth2"],
    credentialBrokerRequired: true,
    identity: "user",
  },
  permissions: ["Read selected Jira projects, issues, fields, and direct links"],
  objectKinds: ["issue"],
  syncModes: ["poll", "backfill", "webhook"],
  dataPolicy: {
    defaultSensitivity: "internal",
    permittedHostnames: [],
    retentionRequired: false,
  },
  integrity: {},
};

function actor(input: JiraActorInput | undefined): EvidenceActor | undefined {
  if (!input) return undefined;
  return {
    externalId: input.accountId,
    displayName: input.displayName,
    url: input.url,
  };
}

function sourceReference(issue: JiraIssue, connectionId: string): ExternalEvidenceRef {
  return {
    pluginId: JIRA_PLUGIN_ID,
    connectionId,
    objectKind: "issue",
    externalId: issue.key,
  };
}

function revision(issue: JiraIssue): string {
  return issue.revision ?? issue.updatedAt ?? issue.deletedAt ?? issue.id ?? issue.key;
}

export function normalizeJiraIssue(
  issue: JiraIssue,
  options: NormalizeJiraOptions,
): EvidenceObservation {
  const source = sourceReference(issue, options.connectionId);
  const participants = [issue.reporter, issue.assignee, ...(issue.participants ?? [])]
    .map(actor)
    .filter((value): value is EvidenceActor => Boolean(value));
  const input = {
    source,
    externalRevision: revision(issue),
    canonicalUrl: issue.url,
    observedAt: options.observedAt,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    author: actor(issue.reporter),
    participants,
    content: {
      title: issue.summary,
      excerpt: issue.description,
      fields: {
        key: issue.key,
        issueType: issue.issueType,
        status: issue.status,
        labels: issue.labels ?? [],
        projectKey: issue.projectKey,
        fixVersions: issue.fixVersions ?? [],
      },
    },
    authority: "intent" as const,
    sensitivity: issue.visibility ?? "internal",
    redactionPolicyVersion: "plugin-input@1",
    connectorVersion: options.connectorVersion ?? "1.0.0",
    completeness: options.completeness ?? "complete",
  } as const;

  if (issue.deleted) {
    return createEvidenceTombstone({
      ...input,
      deletedAt: issue.deletedAt ?? options.observedAt,
    });
  }

  return createEvidenceObservation(input);
}

export function directJiraRelations(
  issue: JiraIssue,
  options: NormalizeJiraOptions,
): readonly DirectRelationObservation[] {
  if (issue.deleted) return [];

  const from = sourceReference(issue, options.connectionId);
  const relations = (issue.directLinks ?? []).map((link) => {
    const target: ExternalEvidenceRef = {
      pluginId: link.targetPluginId ?? JIRA_PLUGIN_ID,
      connectionId:
        link.targetConnectionId ??
        (link.targetPluginId === undefined || link.targetPluginId === JIRA_PLUGIN_ID
          ? options.connectionId
          : undefined),
      objectKind: link.targetObjectKind ?? "issue",
      externalId: link.targetExternalId,
    };

    return createDirectRelationObservation({
      from,
      to: target,
      type: link.type ?? "references",
      authority: "intent",
      sourceRevision: revision(issue),
      observedAt: options.observedAt,
      explanation: link.explanation,
    });
  });

  return Object.freeze(
    [...new Map(relations.map((relation) => [relation.id, relation])).values()],
  );
}

export type JiraConnectorFetcher = ProviderFetcher<JiraConnectorConfig, JiraIssue>;

export function createJiraConnector(
  fetcher: JiraConnectorFetcher,
): ConnectorPlugin<JiraConnectorConfig> {
  return {
    manifest: jiraConnectorManifest,
    validateConnection: (request) =>
      fetcher.validateConnection?.(request) ?? Promise.resolve(defaultConnectionValidation()),
    discoverScopes: (request) =>
      fetcher.discoverScopes?.(request) ?? Promise.resolve(defaultScopeDiscovery()),
    async sync(request) {
      const payload: ProviderSyncPayload<JiraIssue> = await fetcher.sync(request);
      const options: NormalizeJiraOptions = {
        connectionId: request.connection.id,
        observedAt: payload.observedAt,
        completeness: payload.partial ? "partial" : "complete",
      };
      return {
        observations: payload.items.map((item) => normalizeJiraIssue(item, options)),
        directRelations: payload.items.flatMap((item) => directJiraRelations(item, options)),
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
