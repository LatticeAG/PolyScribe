export type PluginDiagnosticCode =
  | "authentication_failed"
  | "authorization_denied"
  | "capability_unsupported"
  | "connection_invalid"
  | "cursor_invalid"
  | "deadline_exceeded"
  | "invalid_manifest"
  | "invalid_observation"
  | "network_error"
  | "not_found"
  | "rate_limited"
  | "scope_incomplete"
  | "target_conflict"
  | "target_invalid"
  | "unknown";

export interface PluginDiagnostic {
  readonly code: PluginDiagnosticCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly providerRequestId?: string;
  readonly affectedScope?: string;
  /** Context is deliberately scalar and secret-filtered before it leaves a plugin. */
  readonly context?: Readonly<Record<string, string | number | boolean>>;
}

const SENSITIVE_CONTEXT_KEY = /(?:token|secret|authorization|password|credential|api[_-]?key)/i;

export function sanitizeDiagnosticContext(
  context: Record<string, unknown> | undefined,
): Readonly<Record<string, string | number | boolean>> | undefined {
  if (!context) return undefined;

  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_CONTEXT_KEY.test(key)) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? Object.freeze(sanitized) : undefined;
}

export function createDiagnostic(
  diagnostic: PluginDiagnostic & {
    readonly context?: Record<string, unknown>;
  },
): PluginDiagnostic {
  const { context, ...rest } = diagnostic;
  const sanitizedContext = sanitizeDiagnosticContext(context);
  return Object.freeze({
    ...rest,
    ...(sanitizedContext ? { context: sanitizedContext } : {}),
  });
}

export class PluginDiagnosticError extends Error {
  readonly diagnostic: PluginDiagnostic;

  constructor(diagnostic: PluginDiagnostic) {
    super(diagnostic.message);
    this.name = "PluginDiagnosticError";
    this.diagnostic = diagnostic;
  }
}
