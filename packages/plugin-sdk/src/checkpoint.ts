import { createDiagnostic, type PluginDiagnostic } from "./diagnostics.js";

/** Durable cursor state owned by the host, never by a connector process. */
export interface ConnectorCheckpoint {
  readonly connectorId: string;
  readonly connectionId: string;
  readonly cursor?: string;
  readonly watermark?: string;
  readonly committedAt: string;
}

/**
 * The host records exactly which upserts and tombstones reached durable storage
 * before it commits the next cursor supplied by a plugin.
 */
export interface CheckpointCommitRequest {
  readonly current?: ConnectorCheckpoint;
  readonly connectorId: string;
  readonly connectionId: string;
  readonly nextCursor?: string;
  readonly watermark?: string;
  readonly expectedOperationIds: readonly string[];
  readonly durableOperationIds: readonly string[];
  readonly partial: boolean;
  readonly incompleteScopes?: readonly string[];
  readonly committedAt: string;
}

export interface CheckpointCommitResult {
  readonly committed: boolean;
  readonly checkpoint?: ConnectorCheckpoint;
  readonly diagnostics: readonly PluginDiagnostic[];
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

/**
 * A partial sync may advance a cursor, but only when it declares the incomplete
 * scope and every operation (including tombstones) has been persisted.
 */
export function canCommitCheckpoint(
  request: CheckpointCommitRequest,
): readonly PluginDiagnostic[] {
  const diagnostics: PluginDiagnostic[] = [];

  if (
    request.current &&
    (request.current.connectorId !== request.connectorId ||
      request.current.connectionId !== request.connectionId)
  ) {
    diagnostics.push(
      createDiagnostic({
        code: "cursor_invalid",
        message: "Checkpoint belongs to a different connector or connection",
        retryable: false,
      }),
    );
  }

  if (request.partial && (!request.incompleteScopes || request.incompleteScopes.length === 0)) {
    diagnostics.push(
      createDiagnostic({
        code: "scope_incomplete",
        message: "A partial sync must identify its incomplete scope",
        retryable: false,
      }),
    );
  }

  const expectedDuplicates = duplicateValues(request.expectedOperationIds);
  if (expectedDuplicates.length > 0) {
    diagnostics.push(
      createDiagnostic({
        code: "cursor_invalid",
        message: `Duplicate expected operation IDs: ${expectedDuplicates.join(", ")}`,
        retryable: false,
      }),
    );
  }

  const durable = new Set(request.durableOperationIds);
  const missing = request.expectedOperationIds.filter((id) => !durable.has(id));
  if (missing.length > 0) {
    diagnostics.push(
      createDiagnostic({
        code: "cursor_invalid",
        message: `Cannot commit cursor before ${missing.length} operation(s) are durable`,
        retryable: true,
      }),
    );
  }

  return Object.freeze(diagnostics);
}

export function commitCheckpoint(
  request: CheckpointCommitRequest,
): CheckpointCommitResult {
  const diagnostics = canCommitCheckpoint(request);
  if (diagnostics.length > 0) {
    return Object.freeze({ committed: false, diagnostics });
  }

  const checkpoint: ConnectorCheckpoint = Object.freeze({
    connectorId: request.connectorId,
    connectionId: request.connectionId,
    cursor: request.nextCursor,
    watermark: request.watermark,
    committedAt: request.committedAt,
  });

  return Object.freeze({ committed: true, checkpoint, diagnostics });
}
