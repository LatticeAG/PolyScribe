import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  defaultConfig,
  parseConfig,
  type PolyScribeConfigFile,
} from "./schema.js";

const CONFIG_FILENAMES = [
  ".github/polyscribe.yml",
  ".polyscribe.yml",
] as const;

function readYamlFile(path: string): unknown {
  const raw = readFileSync(path, "utf8");
  const parsed = parseYaml(raw);
  if (parsed === null || parsed === undefined) {
    return {};
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid config at ${path}: expected a YAML mapping`);
  }
  return parsed;
}

function deepMerge(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(overlay)) {
    const existing = result[key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing !== null &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      result[key] = deepMerge(
        existing as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

export interface LoadConfigResult {
  config: PolyScribeConfigFile;
  path?: string;
}

export function loadConfig(cwd: string): LoadConfigResult {
  let merged: Record<string, unknown> = {};
  let loadedPath: string | undefined;

  for (const relativePath of CONFIG_FILENAMES) {
    const absolutePath = join(cwd, relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const fileConfig = readYamlFile(absolutePath) as Record<string, unknown>;
    merged = deepMerge(merged, fileConfig);
    loadedPath = absolutePath;
  }

  if (Object.keys(merged).length === 0) {
    return { config: defaultConfig() };
  }

  return {
    config: parseConfig(merged),
    path: loadedPath,
  };
}

export function findConfigPath(cwd: string): string | undefined {
  for (const relativePath of [...CONFIG_FILENAMES].reverse()) {
    const absolutePath = join(cwd, relativePath);
    if (existsSync(absolutePath)) {
      return absolutePath;
    }
  }
  return undefined;
}

export function validateConfigFile(
  configPath: string,
): { ok: true; config: PolyScribeConfigFile } | { ok: false; error: string } {
  try {
    const fileConfig = readYamlFile(configPath) as Record<string, unknown>;
    const config = parseConfig(fileConfig);
    return { ok: true, config };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}
