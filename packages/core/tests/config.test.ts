import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultConfig,
  loadConfig,
  parseConfig,
  polyScribeConfigSchema,
} from "../src/config/index.js";

describe("polyScribeConfigSchema", () => {
  it("applies defaults for an empty object", () => {
    const config = polyScribeConfigSchema.parse({});

    expect(config.changelogPath).toBe("CHANGELOG.md");
    expect(config.tone).toBe("developer-friendly");
    expect(config.requireApprover).toBe(true);
    expect(config.autoPublish).toBe(false);
    expect(config.includeUnreleased).toBe(false);
    expect(config.publishTargets).toEqual(["github-release", "changelog-pr"]);
    expect(config.ignoreGlobs).toContain("**/dist/**");
    expect(config.maxDiffBytesPerFile).toBe(20_000);
    expect(config.maxTotalDiffBytes).toBe(400_000);
    expect(config.llm).toBeUndefined();
  });

  it("accepts partial overrides while keeping other defaults", () => {
    const config = parseConfig({
      tone: "technical",
      requireApprover: false,
      maxDiffBytesPerFile: 10_000,
    });

    expect(config.tone).toBe("technical");
    expect(config.requireApprover).toBe(false);
    expect(config.maxDiffBytesPerFile).toBe(10_000);
    expect(config.changelogPath).toBe("CHANGELOG.md");
    expect(config.autoPublish).toBe(false);
  });

  it("matches defaultConfig output", () => {
    expect(defaultConfig()).toEqual(polyScribeConfigSchema.parse({}));
  });
});

describe("loadConfig", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createFixtureDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "polyscribe-config-"));
    tempDirs.push(dir);
    return dir;
  }

  it("returns defaults when no config files exist", () => {
    const cwd = createFixtureDir();
    const result = loadConfig(cwd);

    expect(result.path).toBeUndefined();
    expect(result.config).toEqual(defaultConfig());
  });

  it("loads a single config file", () => {
    const cwd = createFixtureDir();
    writeFileSync(
      join(cwd, ".polyscribe.yml"),
      `tone: executive
autoPublish: true
`,
      "utf8",
    );

    const result = loadConfig(cwd);

    expect(result.path).toBe(join(cwd, ".polyscribe.yml"));
    expect(result.config.tone).toBe("executive");
    expect(result.config.autoPublish).toBe(true);
    expect(result.config.requireApprover).toBe(true);
  });

  it("deep-merges .github/polyscribe.yml and .polyscribe.yml", () => {
    const cwd = createFixtureDir();
    mkdirSync(join(cwd, ".github"), { recursive: true });

    writeFileSync(
      join(cwd, ".github/polyscribe.yml"),
      `tone: technical
sections:
  order:
    - summary
    - fixes
`,
      "utf8",
    );
    writeFileSync(
      join(cwd, ".polyscribe.yml"),
      `requireApprover: false
sections:
  order:
    - features
    - summary
`,
      "utf8",
    );

    const result = loadConfig(cwd);

    expect(result.path).toBe(join(cwd, ".polyscribe.yml"));
    expect(result.config.tone).toBe("technical");
    expect(result.config.requireApprover).toBe(false);
    expect(result.config.sections?.order).toEqual(["features", "summary"]);
    expect(existsSync(join(cwd, ".github/polyscribe.yml"))).toBe(true);
  });
});
