import { PolyMeshClient, type ClientOptions } from "@latticeag/polymesh-client";
import type { PolyMeshReleaseEnvelope } from "./types.js";

export interface PolyMeshTransportReceipt {
  eventId: string;
  targetAgentId: string;
  status: "accepted" | "duplicate" | "rejected-policy" | "unsupported-schema" | "retryable-failure";
  acknowledgedAt: string;
  consumerReference?: string;
  message?: string;
}

export type PolyMeshTaskClient = Pick<PolyMeshClient, "call">;

export interface PolyMeshDispatchOptions {
  targetAgentId: string;
  /** A recipient's declared capability; callers can override for negotiated versions. */
  capability?: string;
  timeoutMs?: number;
}

/**
 * Thin adapter around @latticeag/polymesh-client. The client owns the broker
 * handshake, task idempotency and transport security; PolyScribe owns the
 * PSCF-derived payload and release-specific acknowledgement interpretation.
 */
export function createPolyMeshReleaseTransport(client: PolyMeshTaskClient) {
  return {
    async dispatch(
      envelope: PolyMeshReleaseEnvelope,
      options: PolyMeshDispatchOptions,
    ): Promise<PolyMeshTransportReceipt> {
      const result = await client.call(
        options.targetAgentId,
        options.capability ?? "polyscribe.release.publish.v1",
        envelope as unknown as Parameters<PolyMeshTaskClient["call"]>[2],
        {
          taskId: envelope.eventId,
          idempotencyKey: envelope.idempotencyKey,
          timeoutMs: options.timeoutMs,
        },
      );
      return normalizeAcknowledgement(result, envelope.eventId, options.targetAgentId);
    },
  };
}

/**
 * Convenience constructor for direct mode. Advanced hosts may construct a
 * PolyMeshClient themselves (for enrolled keys, a durable replay ledger, or a
 * custom broker transport) and pass it to createPolyMeshReleaseTransport.
 */
export function createPolyMeshClientReleaseTransport(options: ClientOptions) {
  return createPolyMeshReleaseTransport(new PolyMeshClient(options));
}

export function normalizeAcknowledgement(
  result: unknown,
  eventId: string,
  targetAgentId: string,
): PolyMeshTransportReceipt {
  const acknowledgement = isRecord(result) ? result : {};
  const status = acknowledgement.status;
  if (!isAcknowledgementStatus(status)) {
    return {
      eventId,
      targetAgentId,
      status: "retryable-failure",
      acknowledgedAt: new Date().toISOString(),
      message: "PolyMesh recipient returned an invalid acknowledgement.",
    };
  }
  return {
    eventId,
    targetAgentId,
    status,
    acknowledgedAt: typeof acknowledgement.acknowledgedAt === "string"
      ? acknowledgement.acknowledgedAt
      : new Date().toISOString(),
    consumerReference: typeof acknowledgement.consumerReference === "string"
      ? acknowledgement.consumerReference
      : undefined,
    message: typeof acknowledgement.message === "string" ? acknowledgement.message : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAcknowledgementStatus(value: unknown): value is PolyMeshTransportReceipt["status"] {
  return value === "accepted"
    || value === "duplicate"
    || value === "rejected-policy"
    || value === "unsupported-schema"
    || value === "retryable-failure";
}
