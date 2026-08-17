/** The first stable host/plugin protocol for PolyScribe plugins. */
export const PLUGIN_API_VERSION = "1.0";

export interface ParsedApiVersion {
  readonly major: number;
  readonly minor: number;
  readonly value: string;
}

/**
 * A plugin can support a contiguous range of host protocol versions. Ranges
 * intentionally use protocol versions rather than package semver: a plugin
 * package may patch independently without changing its wire contract.
 */
export interface ApiVersionRange {
  readonly minimum: string;
  readonly maximum?: string;
}

export interface ApiVersionNegotiation {
  readonly compatible: boolean;
  readonly selected?: string;
  readonly reason?: string;
}

const API_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseApiVersion(value: string): ParsedApiVersion | undefined {
  const match = API_VERSION_PATTERN.exec(value);
  if (!match) return undefined;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    value,
  };
}

export function compareApiVersions(left: string, right: string): number {
  const parsedLeft = parseApiVersion(left);
  const parsedRight = parseApiVersion(right);

  if (!parsedLeft || !parsedRight) {
    throw new Error(`Invalid API version comparison: ${left} and ${right}`);
  }

  if (parsedLeft.major !== parsedRight.major) {
    return parsedLeft.major - parsedRight.major;
  }

  return parsedLeft.minor - parsedRight.minor;
}

export function isApiVersionInRange(
  version: string,
  range: ApiVersionRange,
): boolean {
  if (!parseApiVersion(version) || !parseApiVersion(range.minimum)) {
    return false;
  }

  if (compareApiVersions(version, range.minimum) < 0) return false;
  if (range.maximum && compareApiVersions(version, range.maximum) > 0) {
    return false;
  }

  return true;
}

/**
 * Selects the highest mutually supported protocol version. Negotiation fails
 * closed so an incompatible plugin is never invoked with a guessed contract.
 */
export function negotiateApiVersion(
  hostSupported: readonly string[],
  pluginSupported: ApiVersionRange,
): ApiVersionNegotiation {
  if (!parseApiVersion(pluginSupported.minimum)) {
    return {
      compatible: false,
      reason: `Plugin minimum API version is invalid: ${pluginSupported.minimum}`,
    };
  }

  if (
    pluginSupported.maximum &&
    (!parseApiVersion(pluginSupported.maximum) ||
      compareApiVersions(pluginSupported.minimum, pluginSupported.maximum) > 0)
  ) {
    return {
      compatible: false,
      reason: "Plugin API version range is invalid",
    };
  }

  const candidates = hostSupported
    .filter((version) => parseApiVersion(version))
    .filter((version) => isApiVersionInRange(version, pluginSupported))
    .sort((left, right) => compareApiVersions(right, left));

  const selected = candidates[0];
  if (!selected) {
    return {
      compatible: false,
      reason: `No host API version is compatible with ${pluginSupported.minimum}${
        pluginSupported.maximum ? `..${pluginSupported.maximum}` : "+"
      }`,
    };
  }

  return { compatible: true, selected };
}
