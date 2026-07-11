import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { ZodSchema } from "zod";
import { zodToJsonSchema } from "../zod-to-json-schema.js";
import type { LLMClient, LLMCompleteInput } from "./client.js";

const DEFAULT_MAX_TOKENS = 4096;

export class OpenAILLMClient implements LLMClient {
  readonly provider = "openai";
  private readonly client: OpenAI;

  constructor(
    readonly model: string,
    apiKey?: string,
    baseURL?: string,
  ) {
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.OPENAI_API_KEY,
      baseURL,
    });
  }

  async completeStructured<T>(input: LLMCompleteInput<T>): Promise<T> {
    const jsonSchema = zodToJsonSchema(input.schema);
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "polyscribe_draft",
          strict: true,
          schema: jsonSchema,
        },
      },
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned empty response");
    }

    const parsed = JSON.parse(content) as unknown;
    return input.schema.parse(parsed);
  }
}

export class AnthropicLLMClient implements LLMClient {
  readonly provider = "anthropic";
  private readonly client: Anthropic;

  constructor(
    readonly model: string,
    apiKey?: string,
  ) {
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
  }

  async completeStructured<T>(input: LLMCompleteInput<T>): Promise<T> {
    const jsonSchema = zodToJsonSchema(input.schema);
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
      tools: [
        {
          name: "polyscribe_draft",
          description: "Structured release notes draft",
          input_schema: jsonSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "polyscribe_draft" },
    });

    const toolBlock = response.content.find((block) => block.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new Error("Anthropic returned no tool_use block");
    }

    return input.schema.parse(toolBlock.input);
  }
}
