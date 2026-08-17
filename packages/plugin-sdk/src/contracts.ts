import type { ApiVersionRange } from "./api-version.js";
import type { PluginDiagnostic } from "./diagnostics.js";
import type {
  DirectRelationObservation,
  EvidenceObservation,
  ExternalEvidenceRef,
} from "./evidence.js";
import type { PluginManifest } from "./manifest.js";

export interface PluginConnection<TConfig = unknown> {
  readonly id: string;
  readonly pluginId: string;
  readonly config: TConfig;
  readonly credentialHandle?: string;
}

export interface ConnectionScope {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly parentId?: string;
}

export interface ConnectionValidationRequest<TConfig = unknown> {
  readonly connection: PluginConnection<TConfig>;
  readonly deadline?: string;
}

export interface ConnectionValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly PluginDiagnostic[];
}

export interface ScopeDiscoveryRequest<TConfig = unknown> {
  readonly connection: PluginConnection<TConfig>;
  readonly parentScopeId?: string;
  readonly deadline?: string;
}

export interface ScopeDiscoveryResult {
  readonly scopes: readonly ConnectionScope[];
  readonly diagnostics: readonly PluginDiagnostic[];
}

export interface ConnectorSyncRequest<TConfig = unknown> {
  readonly connection: PluginConnection<TConfig>;
  readonly scopes: readonly ConnectionScope[];
  readonly objectKinds: readonly string[];
  readonly cursor?: string;
  readonly since?: string;
  readonly until?: string;
  readonly pageLimit?: number;
  readonly idempotencyKey: string;
  readonly deadline?: string;
}

export interface ConnectorSyncResult {
  readonly observations: readonly EvidenceObservation[];
  readonly directRelations: readonly DirectRelationObservation[];
  readonly nextCursor?: string;
  readonly watermark?: string;
  readonly partial: boolean;
  readonly incompleteScopes?: readonly string[];
  readonly diagnostics: readonly PluginDiagnostic[];
}

export interface ConnectorHydrateRequest<TConfig = unknown> {
  readonly connection: PluginConnection<TConfig>;
  readonly references: readonly ExternalEvidenceRef[];
  readonly deadline?: string;
}

export interface ConnectorHydrateResult {
  readonly observations: readonly EvidenceObservation[];
  readonly diagnostics: readonly PluginDiagnostic[];
}

export interface ConnectorHealth {
  readonly healthy: boolean;
  readonly expiresAt?: string;
  readonly rateLimitRemaining?: number;
  readonly diagnostics: readonly PluginDiagnostic[];
}

export interface ConnectorPlugin<TConfig = unknown> {
  readonly manifest: PluginManifest;
  validateConnection(
    request: ConnectionValidationRequest<TConfig>,
  ): Promise<ConnectionValidationResult>;
  discoverScopes(
    request: ScopeDiscoveryRequest<TConfig>,
  ): Promise<ScopeDiscoveryResult>;
  sync(request: ConnectorSyncRequest<TConfig>): Promise<ConnectorSyncResult>;
  hydrate?(request: ConnectorHydrateRequest<TConfig>): Promise<ConnectorHydrateResult>;
  health(connection: PluginConnection<TConfig>): Promise<ConnectorHealth>;
  revoke(connection: PluginConnection<TConfig>): Promise<{ readonly diagnostics: readonly PluginDiagnostic[] }>;
}

export interface PublisherValidationRequest {
  readonly connection: PluginConnection;
  readonly audience: string;
  readonly contentHash: string;
  readonly target: Readonly<Record<string, unknown>>;
}

export interface PublisherPreviewResult {
  readonly content: string;
  readonly contentHash: string;
  readonly warnings: readonly PluginDiagnostic[];
}

export interface PublisherPlanResult {
  readonly idempotencyKey: string;
  readonly targetArtifactId?: string;
  readonly scheduledAt?: string;
  readonly diagnostics: readonly PluginDiagnostic[];
}

export interface PublisherReceipt {
  readonly remoteId: string;
  readonly remoteUrl?: string;
  readonly contentHash: string;
  readonly publishedAt: string;
}

export interface PublisherPlugin {
  readonly manifest: PluginManifest;
  validate(request: PublisherValidationRequest): Promise<ConnectionValidationResult>;
  preview(request: PublisherValidationRequest): Promise<PublisherPreviewResult>;
  plan(request: PublisherValidationRequest): Promise<PublisherPlanResult>;
  publish(
    request: PublisherValidationRequest & { readonly idempotencyKey: string },
  ): Promise<PublisherReceipt>;
  reconcile(
    request: PublisherValidationRequest & { readonly idempotencyKey: string },
  ): Promise<PublisherReceipt | undefined>;
}

export interface ModelRequest<TSchema = unknown> {
  readonly taskType: string;
  readonly schema: TSchema;
  readonly context: Readonly<Record<string, unknown>>;
  readonly tokenBudget?: number;
  readonly costBudget?: number;
  readonly traceId: string;
  readonly deadline?: string;
}

export interface ModelResponse<TOutput = unknown> {
  readonly output: TOutput;
  readonly model: string;
  readonly providerVersion?: string;
  readonly usage?: Readonly<{ inputTokens?: number; outputTokens?: number }>;
  readonly finishReason?: string;
}

export interface ModelPlugin {
  readonly manifest: PluginManifest;
  completeStructured<TSchema, TOutput>(
    request: ModelRequest<TSchema>,
  ): Promise<ModelResponse<TOutput>>;
}

export interface MeshEnvelope {
  readonly eventId: string;
  readonly eventType: string;
  readonly envelopeVersion: string;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly signature?: string;
}

export interface MeshAcknowledgement {
  readonly status:
    | "accepted"
    | "duplicate"
    | "rejected-policy"
    | "unsupported-schema"
    | "retryable-failure";
  readonly acknowledgedAt: string;
  readonly reference?: string;
}

export interface MeshTransportPlugin {
  readonly manifest: PluginManifest;
  readonly apiVersion: ApiVersionRange;
  dispatch(envelope: MeshEnvelope): Promise<MeshAcknowledgement>;
}
