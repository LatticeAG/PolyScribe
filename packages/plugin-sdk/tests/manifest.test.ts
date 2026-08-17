import { describe, expect, it } from "vitest";
import {
  PLUGIN_MANIFEST_SCHEMA_VERSION,
  assertPluginManifest,
  validatePluginManifest,
} from "../src/manifest.js";

const manifest = {
  schemaVersion: PLUGIN_MANIFEST_SCHEMA_VERSION,
  id: "io.polyscribe.example",
  displayName: "Example",
  version: "1.0.0",
  apiVersion: { minimum: "1.0", maximum: "1.0" },
  capabilities: [{ type: "connector", operations: ["sync"] }],
  configurationSchema: { type: "object", additionalProperties: false },
  auth: { methods: ["oauth2"], credentialBrokerRequired: true },
  permissions: ["Read selected records"],
  objectKinds: ["issue"],
  syncModes: ["poll"],
  dataPolicy: {
    defaultSensitivity: "internal",
    permittedHostnames: ["api.example.test"],
    retentionRequired: false,
  },
  integrity: {},
};

describe("plugin manifests", () => {
  it("accepts a strict, versioned manifest", () => {
    expect(validatePluginManifest(manifest)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(() => assertPluginManifest(manifest)).not.toThrow();
  });

  it("rejects unknown top-level fields and malformed plugin IDs", () => {
    const result = validatePluginManifest({
      ...manifest,
      id: "github",
      unreviewed: true,
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toEqual(
      expect.arrayContaining([
        "id must be a reverse-DNS plugin identifier",
        "Unknown manifest field: unreviewed",
      ]),
    );
  });
});
