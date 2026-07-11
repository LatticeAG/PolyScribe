import { describe, expect, it } from "vitest";
import { redactSecrets } from "../src/redact/index.js";

describe("redactSecrets", () => {
  it("redacts AWS access key ids", () => {
    const input = "export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
    expect(redactSecrets(input)).toBe("export AWS_ACCESS_KEY_ID=[REDACTED]");
  });

  it("redacts GitHub personal access tokens", () => {
    const input = "token=ghp_abcdefghijklmnopqrstuvwxyz123456";
    expect(redactSecrets(input)).toBe("token=[REDACTED]");
  });

  it("redacts OpenAI-style API keys", () => {
    const input = "Authorization: Bearer sk-abcdefghijklmnopqrstuv";
    expect(redactSecrets(input)).toBe("Authorization: Bearer [REDACTED]");
  });

  it("redacts private key headers", () => {
    const input = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----`;
    expect(redactSecrets(input)).toContain("[REDACTED]");
    expect(redactSecrets(input)).not.toContain("BEGIN RSA PRIVATE KEY");
  });

  it("redacts multiple secret types in one string", () => {
    const input = [
      "AKIAIOSFODNN7EXAMPLE",
      "ghp_abcdefghijklmnopqrstuvwxyz123456",
      "sk-abcdefghijklmnopqrstuv",
    ].join("\n");

    const redacted = redactSecrets(input);
    expect(redacted).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(redacted).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz123456");
    expect(redacted).not.toContain("sk-abcdefghijklmnopqrstuv");
    expect(redacted.match(/\[REDACTED\]/g)?.length).toBe(3);
  });
});
