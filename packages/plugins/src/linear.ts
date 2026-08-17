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

export const LINEAR_PLUGIN_ID = "io.polyscribe.linear";

export interface LinearConnectorConfig {
  readonly teamIds?: readonly string[];
  readonly projectIds?: readonly string[];
}

export interface LinearActorInput {
  readonly id: string;
  readonly name?: string;
  readonly email?: string;
  readonly url?: string;
}

export interface LinearDirectLink {
  readonly targetExternalId: string;
  readonly targetObjectKind?: string;
  readonly targetPluginId?: string;
  readonly targetConnectionId?: string;
  readonly type?: EvidenceRelationType;
  readonly explanation?: string;
}

export interface LinearIssue {
  readonly id: string;
  readonly identifier: string;
  readonly url?: string;
  readonly title: string;
  readonly description?: string;
  readonly state?: string;
  readonly labels?: readonly string[];
  readonly teamId?: string;
  readonly projectId?: string;
  readonly cycleId?: string;
  readonly revision?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly deleted?: boolean;
  readonly deletedAt?: string;
  readonly creator?: LinearActorInput;
  readonly assignee?: LinearActorInput;
  readonly participants?: readonly LinearActorInput[];
  readonly visibility?: "public" | "internal" | "restricted" | "embargoed";
  readonly directLinks?: readonly LinearDirectLink[];
}

export interface NormalizeLinearOptions {
  readonly connectionId: string;
  readonly observedAt: string;
  readonly completeness?: "complete" | "partial" | "unknown" | "not-applicable";
  readonly connectorVersion?: string;
}

export const linearConnectorManifest: PluginManifest = {
  schemaVersion: "polyscribe/plugin-manifest@1",
  id: LINEAR_PLUGIN_ID,
  displayName: "Linear",
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
      teamIds: { type: "array", items: { type: "string" } },
      projectIds: { type: "array", items: { type: "string" } },
    },
  },
  auth: {
    methods: ["api-token", "oauth2"],
    credentialBrokerRequired: true,
    identity: "user",
  },
  permissions: ["Read selected Linear teams, projects, issues, and direct links"],
  objectKinds: ["issue"],
  syncModes: ["poll", "backfill", "webhook"],
  dataPolicy: {
    defaultSensitivity: "internal",
    permittedHostnames: ["api.linear.app"],
    retentionRequired: false,
  },
  integrity: {},
};

function actor(input: LinearActorInput | undefined): EvidenceActor | undefined {
  if (!input) return undefined;
  return {
    externalId: input.id,
    displayName: input.name,
    url: input.url,
  };
}

function sourceReference(issue: LinearIssue, connectionId: string): ExternalEvidenceRef {
  return {
    pluginId: LINEAR_PLUGIN_ID,
    connectionId,
    objectKind: "issue",
    externalId: issue.identifier,
  };
}

function revision(issue: LinearIssue): string {
  return issue.revision ?? issue.updatedAt ?? issue.deletedAt ?? issue.id;
}

export function normalizeLinearIssue(
  issue: LinearIssue,
  options: NormalizeLinearOptions,
): EvidenceObservation {
  const source = sourceReference(issue, options.connectionId);
  const participants = [issue.creator, issue.assignee, ...(issue.participants ?? [])]
    .map(actor)
    .filter((value): value is EvidenceActor => Boolean(value));
  const input = {
    source,
    externalRevision: revision(issue),
    canonicalUrl: issue.url,
    observedAt: options.observedAt,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    author: actor(issue.creator),
    participants,
    content: {
      title: issue.title,
      excerpt: issue.description,
      fields: {
        identifier: issue.identifier,
        state: issue.state,
        labels: issue.labels ?? [],
        teamId: issue.teamId,
        projectId: issue.projectId,
        cycleId: issue.cycleId,
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

export function directLinearRelations(
  issue: LinearIssue,
  options: NormalizeLinearOptions,
): readonly DirectRelationObservation[] {
  if (issue.deleted) return [];

  const from = sourceReference(issue, options.connectionId);
  const relations = (issue.directLinks ?? []).map((link) => {
    const target: ExternalEvidenceRef = {
      pluginId: link.targetPluginId ?? LINEAR_PLUGIN_ID,
      connectionId:
        link.targetConnectionId ??
        (link.targetPluginId === undefined || link.targetPluginId === LINEAR_PLUGIN_ID
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

export type LinearConnectorFetcher = ProviderFetcher<LinearConnectorConfig, LinearIssue>;

export function createLinearConnector(
  fetcher: LinearConnectorFetcher,
): ConnectorPlugin<LinearConnectorConfig> {
  return {
    manifest: linearConnectorManifest,
    validateConnection: (request) =>
      fetcher.validateConnection?.(request) ?? Promise.resolve(defaultConnectionValidation()),
    discoverScopes: (request) =>
      fetcher.discoverScopes?.(request) ?? Promise.resolve(defaultScopeDiscovery()),
    async sync(request) {
      const payload: ProviderSyncPayload<LinearIssue> = await fetcher.sync(request);
      const options: NormalizeLinearOptions = {
        connectionId: request.connection.id,
        observedAt: payload.observedAt,
        completeness: payload.partial ? "partial" : "complete",
      };
      return {
        observations: payload.items.map((item) => normalizeLinearIssue(item, options)),
        directRelations: payload.items.flatMap((item) => directLinearRelations(item, options)),
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
