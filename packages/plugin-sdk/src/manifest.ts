import { parseApiVersion, type ApiVersionRange } from "./api-version.js";
import { createDiagnostic, type PluginDiagnostic } from "./diagnostics.js";

export const PLUGIN_MANIFEST_SCHEMA_VERSION = "polyscribe/plugin-manifest@1";

export const PLUGIN_CAPABILITIES = [
  "connector",
  "publisher",
  "model",
  "mesh-transport",
] as const;

export type PluginCapability = (typeof PLUGIN_CAPABILITIES)[number];

export interface PluginCapabilityDeclaration {
  readonly type: PluginCapability;
  readonly operations: readonly string[];
}

export interface PluginAuthDeclaration {
  readonly methods: readonly ("none" | "api-token" | "oauth2" | "github-app")[];
  readonly scopes?: readonly string[];
  readonly credentialBrokerRequired: boolean;
  readonly identity?: "user" | "installation" | "either";
}

export interface PluginDataPolicy {
  readonly defaultSensitivity: "public" | "internal" | "restricted" | "embargoed";
  readonly permittedHostnames: readonly string[];
  readonly retentionRequired: boolean;
  readonly allowedContentTypes?: readonly string[];
}

export interface PluginIntegrity {
  readonly packageDigest?: string;
  readonly signature?: string;
  readonly sbomUrl?: string;
}

/** JSON Schema is kept opaque by the SDK; hosts own schema execution policy. */
export type PluginConfigurationSchema = Readonly<Record<string, unknown>>;

export interface PluginManifest {
  readonly schemaVersion: typeof PLUGIN_MANIFEST_SCHEMA_VERSION;
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly apiVersion: ApiVersionRange;
  readonly capabilities: readonly PluginCapabilityDeclaration[];
  readonly configurationSchema: PluginConfigurationSchema;
  readonly auth: PluginAuthDeclaration;
  readonly permissions: readonly string[];
  readonly objectKinds: readonly string[];
  readonly syncModes: readonly ("poll" | "backfill" | "webhook")[];
  readonly dataPolicy: PluginDataPolicy;
  readonly rateLimits?: Readonly<Record<string, number>>;
  readonly rendering?: Readonly<Record<string, unknown>>;
  readonly integrity: PluginIntegrity;
}

export interface ManifestValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly PluginDiagnostic[];
}

const MANIFEST_KEYS = new Set([
  "schemaVersion",
  "id",
  "displayName",
  "version",
  "apiVersion",
  "capabilities",
  "configurationSchema",
  "auth",
  "permissions",
  "objectKinds",
  "syncModes",
  "dataPolicy",
  "rateLimits",
  "rendering",
  "integrity",
]);

const PLUGIN_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function invalid(message: string): PluginDiagnostic {
  return createDiagnostic({
    code: "invalid_manifest",
    message,
    retryable: false,
  });
}

/**
 * Performs the SDK-level strict shape checks. Provider-specific configuration
 * schemas remain the host's responsibility, but manifests cannot smuggle in
 * unknown top-level contract fields.
 */
export function validatePluginManifest(value: unknown): ManifestValidationResult {
  const diagnostics: PluginDiagnostic[] = [];
  if (!isRecord(value)) {
    return Object.freeze({ valid: false, diagnostics: Object.freeze([invalid("Manifest must be an object")]) });
  }

  for (const key of Object.keys(value)) {
    if (!MANIFEST_KEYS.has(key)) diagnostics.push(invalid(`Unknown manifest field: ${key}`));
  }

  if (value.schemaVersion !== PLUGIN_MANIFEST_SCHEMA_VERSION) {
    diagnostics.push(invalid(`schemaVersion must be ${PLUGIN_MANIFEST_SCHEMA_VERSION}`));
  }
  if (typeof value.id !== "string" || !PLUGIN_ID_PATTERN.test(value.id)) {
    diagnostics.push(invalid("id must be a reverse-DNS plugin identifier"));
  }
  if (typeof value.displayName !== "string" || value.displayName.trim().length === 0) {
    diagnostics.push(invalid("displayName is required"));
  }
  if (typeof value.version !== "string" || !SEMVER_PATTERN.test(value.version)) {
    diagnostics.push(invalid("version must be semantic versioning compatible"));
  }

  if (!isRecord(value.apiVersion) || typeof value.apiVersion.minimum !== "string") {
    diagnostics.push(invalid("apiVersion.minimum is required"));
  } else {
    const minimum = value.apiVersion.minimum;
    const maximum = value.apiVersion.maximum;
    if (!parseApiVersion(minimum)) diagnostics.push(invalid("apiVersion.minimum is invalid"));
    if (maximum !== undefined && (typeof maximum !== "string" || !parseApiVersion(maximum))) {
      diagnostics.push(invalid("apiVersion.maximum is invalid"));
    }
  }

  if (!Array.isArray(value.capabilities) || value.capabilities.length === 0) {
    diagnostics.push(invalid("At least one capability declaration is required"));
  } else {
    for (const capability of value.capabilities) {
      if (
        !isRecord(capability) ||
        typeof capability.type !== "string" ||
        !PLUGIN_CAPABILITIES.includes(capability.type as PluginCapability) ||
        !hasStringArray(capability.operations) ||
        capability.operations.length === 0
      ) {
        diagnostics.push(invalid("Each capability needs a known type and at least one operation"));
      }
    }
  }

  if (!isRecord(value.configurationSchema)) {
    diagnostics.push(invalid("configurationSchema must be an object"));
  }
  if (!isRecord(value.auth) || !hasStringArray(value.auth.methods) || typeof value.auth.credentialBrokerRequired !== "boolean") {
    diagnostics.push(invalid("auth must declare methods and credentialBrokerRequired"));
  }
  if (!hasStringArray(value.permissions) || value.permissions.length === 0) {
    diagnostics.push(invalid("permissions must be a non-empty string array"));
  }
  if (!hasStringArray(value.objectKinds) || value.objectKinds.length === 0) {
    diagnostics.push(invalid("objectKinds must be a non-empty string array"));
  }
  if (!hasStringArray(value.syncModes)) {
    diagnostics.push(invalid("syncModes must be a string array"));
  }
  if (
    !isRecord(value.dataPolicy) ||
    typeof value.dataPolicy.defaultSensitivity !== "string" ||
    !hasStringArray(value.dataPolicy.permittedHostnames) ||
    typeof value.dataPolicy.retentionRequired !== "boolean"
  ) {
    diagnostics.push(invalid("dataPolicy is incomplete"));
  }
  if (!isRecord(value.integrity)) {
    diagnostics.push(invalid("integrity must be an object"));
  }

  return Object.freeze({
    valid: diagnostics.length === 0,
    diagnostics: Object.freeze(diagnostics),
  });
}

export class PluginManifestValidationError extends Error {
  readonly diagnostics: readonly PluginDiagnostic[];

  constructor(diagnostics: readonly PluginDiagnostic[]) {
    super(`Plugin manifest validation failed (${diagnostics.length} issue(s))`);
    this.name = "PluginManifestValidationError";
    this.diagnostics = diagnostics;
  }
}

export function assertPluginManifest(value: unknown): asserts value is PluginManifest {
  const result = validatePluginManifest(value);
  if (!result.valid) throw new PluginManifestValidationError(result.diagnostics);
}
