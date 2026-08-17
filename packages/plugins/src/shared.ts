import type {
  ConnectionScope,
  ConnectorHealth,
  ConnectorSyncRequest,
  ConnectionValidationRequest,
  ConnectionValidationResult,
  PluginConnection,
  ScopeDiscoveryRequest,
  ScopeDiscoveryResult,
} from "@polyscribe/plugin-sdk";

export interface ProviderSyncPayload<TItem> {
  readonly items: readonly TItem[];
  readonly observedAt: string;
  readonly nextCursor?: string;
  readonly watermark?: string;
  readonly partial?: boolean;
  readonly incompleteScopes?: readonly string[];
}

export interface ProviderFetcher<TConfig, TItem> {
  sync(
    request: ConnectorSyncRequest<TConfig>,
  ): Promise<ProviderSyncPayload<TItem>>;
  validateConnection?(
    request: ConnectionValidationRequest<TConfig>,
  ): Promise<ConnectionValidationResult>;
  discoverScopes?(
    request: ScopeDiscoveryRequest<TConfig>,
  ): Promise<ScopeDiscoveryResult>;
  health?(connection: PluginConnection<TConfig>): Promise<ConnectorHealth>;
  revoke?(
    connection: PluginConnection<TConfig>,
  ): Promise<{ readonly diagnostics: readonly import("@polyscribe/plugin-sdk").PluginDiagnostic[] }>;
}

export function defaultConnectionValidation(): ConnectionValidationResult {
  return { valid: true, diagnostics: [] };
}

export function defaultScopeDiscovery(): ScopeDiscoveryResult {
  return { scopes: [], diagnostics: [] };
}

export function defaultHealth(): ConnectorHealth {
  return { healthy: true, diagnostics: [] };
}

export function emptyRevokeResult(): {
  readonly diagnostics: readonly import("@polyscribe/plugin-sdk").PluginDiagnostic[];
} {
  return { diagnostics: [] };
}

export function selectedScope(
  id: string,
  label: string,
  kind: string,
): ConnectionScope {
  return { id, label, kind };
}
