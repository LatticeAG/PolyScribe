import { createHash } from "node:crypto";

/** Stable SHA-256 format used for target artifacts and idempotency keys. */
export function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function publicationIdempotencyKey(
  contentRevisionId: string,
  targetId: string,
  contentHash: string,
): string {
  return sha256(`${contentRevisionId}\u0000${targetId}\u0000${contentHash}`);
}
