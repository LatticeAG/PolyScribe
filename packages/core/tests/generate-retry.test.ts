import { describe, expect, it } from "vitest";
import type { SourceItem } from "../src/types.js";
import { generateDraft } from "../src/draft/generate.js";
import type { LLMClient } from "../src/draft/llm/client.js";
import type { z } from "zod";
import { llmDraftOutputSchema } from "../src/draft/schema.js";

const source: SourceItem = {
  id: "pr:1",
  type: "pr",
  prNumber: 1,
  title: "Add widgets",
  author: { login: "alice", id: "1" },
  labels: ["feat"],
  url: "https://github.com/acme/repo/pull/1",
};

function mockClient(
  responses: Array<z.infer<typeof llmDraftOutputSchema>>,
): LLMClient {
  let call = 0;
  return {
    provider: "mock",
    model: "mock",
    async completeStructured<T>({
      schema,
    }: {
      schema: { parse: (data: unknown) => T };
    }): Promise<T> {
      const data = responses[call] ?? responses[responses.length - 1]!;
      call += 1;
      return schema.parse(data);
    },
  };
}

describe("generateDraft citation retry", () => {
  it("retries once when first response lacks citations", async () => {
    const invalid = {
      sections: [
        {
          type: "features" as const,
          title: "Features",
          content: "- Add widgets",
          sourceIds: [],
        },
        {
          type: "credits" as const,
          title: "Contributors",
          content: "Thanks @alice",
          sourceIds: [],
        },
      ],
      contributors: [{ login: "alice" }],
      suggestedSemver: "minor" as const,
    };

    const valid = {
      ...invalid,
      sections: [
        {
          type: "features" as const,
          title: "Features",
          content: "- Add widgets (#1)",
          sourceIds: ["pr:1"],
        },
        {
          type: "credits" as const,
          title: "Contributors",
          content: "Thanks @alice",
          sourceIds: [],
        },
      ],
    };

    const client = mockClient([invalid, valid]);
    const draft = await generateDraft([source], { tone: "developer-friendly" }, client);

    expect(draft.sections[0]?.sourceIds).toContain("pr:1");
  });
});
