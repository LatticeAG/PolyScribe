import { describe, expect, it } from "vitest";
import { insertVersion, parseChangelog, updateUnreleased } from "../src/changelog/index.js";

const KEEP_A_CHANGELOG = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Draft changelog generation

## [1.0.0] - 2024-01-15

### Added
- Initial release
`;

describe("parseChangelog", () => {
  it("parses Keep a Changelog sections", () => {
    const parsed = parseChangelog(KEEP_A_CHANGELOG);

    expect(parsed.preamble).toContain("# Changelog");
    expect(parsed.unreleased?.version).toBe("Unreleased");
    expect(parsed.unreleased?.content).toContain("Draft changelog generation");
    expect(parsed.versions).toHaveLength(1);
    expect(parsed.versions[0]?.version).toBe("1.0.0");
    expect(parsed.versions[0]?.date).toBe("2024-01-15");
    expect(parsed.versions[0]?.content).toContain("Initial release");
  });
});

describe("insertVersion", () => {
  it("inserts a new version while preserving Unreleased", () => {
    const updated = insertVersion(
      KEEP_A_CHANGELOG,
      "1.1.0",
      "2024-06-01",
      `### Added
- Webhook retries`,
    );

    expect(updated).toContain("## [Unreleased]");
    expect(updated).toContain("Draft changelog generation");
    expect(updated).toContain("## [1.1.0] - 2024-06-01");
    expect(updated).toContain("Webhook retries");
    expect(updated).toContain("## [1.0.0] - 2024-01-15");
    expect(updated.indexOf("## [Unreleased]")).toBeLessThan(
      updated.indexOf("## [1.1.0]"),
    );
    expect(updated.indexOf("## [1.1.0]")).toBeLessThan(
      updated.indexOf("## [1.0.0]"),
    );
  });
});

describe("updateUnreleased", () => {
  it("replaces Unreleased body while keeping version history", () => {
    const updated = updateUnreleased(
      KEEP_A_CHANGELOG,
      `### Added
- New unreleased feature`,
    );

    expect(updated).toContain("## [Unreleased]");
    expect(updated).toContain("New unreleased feature");
    expect(updated).not.toContain("Draft changelog generation");
    expect(updated).toContain("## [1.0.0] - 2024-01-15");
  });
});
