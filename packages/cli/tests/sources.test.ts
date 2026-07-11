import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerSourcesCommand } from "../src/commands/sources.js";
import type { SourceItem } from "@polyscribe/core";

const mockSources: SourceItem[] = [
  {
    id: "commit:abc123",
    type: "commit",
    sha: "abc123",
    title: "feat: add sources command",
    author: { login: "dev", id: "dev" },
    labels: [],
    url: "commit:abc123",
  },
];

vi.mock("../src/lib/gather-sources.js", () => ({
  gatherSources: vi.fn(async () => ({
    config: { changelogPath: "CHANGELOG.md", tone: "developer-friendly" },
    range: { fromRef: "v1.0.0", toRef: "HEAD", fromSha: "aaa", toSha: "bbb" },
    sources: mockSources,
  })),
}));

vi.mock("../src/lib/handle-error.js", () => ({
  handleCommandError: vi.fn((error: unknown) => {
    throw error;
  }),
}));

describe("sources command", () => {
  const logs: string[] = [];
  const errors: string[] = [];

  afterEach(() => {
    logs.length = 0;
    errors.length = 0;
    vi.restoreAllMocks();
  });

  function createProgram(): Command {
    const program = new Command();
    registerSourcesCommand(program);
    return program;
  }

  function captureOutput(): void {
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
  }

  it("registers with expected options", () => {
    const program = createProgram();
    const cmd = program.commands.find((command) => command.name() === "sources");

    expect(cmd).toBeDefined();
    expect(cmd?.options.map((option) => option.flags)).toEqual(
      expect.arrayContaining([
        "--from <ref>",
        "--to <ref>",
        "--json",
        "--pretty",
        "--count",
      ]),
    );
  });

  it("prints JSON sources by default", async () => {
    captureOutput();
    const program = createProgram();
    await program.parseAsync(["node", "polyscribe", "sources"]);

    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0]!)).toEqual(mockSources);
    expect(errors.some((line) => line.includes("Collecting sources"))).toBe(
      true,
    );
  });

  it("prints pretty JSON when --pretty is set", async () => {
    captureOutput();
    const program = createProgram();
    await program.parseAsync(["node", "polyscribe", "sources", "--pretty"]);

    expect(logs[0]).toContain("\n");
    expect(logs[0]).toContain("feat: add sources command");
  });

  it("prints count summary when --count is set", async () => {
    captureOutput();
    const program = createProgram();
    await program.parseAsync(["node", "polyscribe", "sources", "--count"]);

    expect(logs[0]).toContain("Sources: 1");
    expect(logs[0]).toContain("v1.0.0..HEAD");
  });

  it("forwards --from and --to to gatherSources", async () => {
    const { gatherSources } = await import("../src/lib/gather-sources.js");
    captureOutput();
    const program = createProgram();
    await program.parseAsync([
      "node",
      "polyscribe",
      "sources",
      "--from",
      "v0.1.0",
      "--to",
      "main",
    ]);

    expect(gatherSources).toHaveBeenCalledWith(process.cwd(), {
      from: "v0.1.0",
      to: "main",
    });
  });
});
