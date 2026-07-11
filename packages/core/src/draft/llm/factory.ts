import type { LLMProvider } from "../../types.js";
import { AnthropicLLMClient, OpenAILLMClient } from "./providers.js";

export interface CreateLLMClientOptions {
  provider?: LLMProvider;
  model?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  baseUrl?: string;
}

function resolveProvider(explicit?: LLMProvider): LLMProvider {
  if (explicit) return explicit;

  const envProvider = process.env.POLYSCRIBE_LLM_PROVIDER as LLMProvider | undefined;
  if (envProvider) return envProvider;

  if (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    return "anthropic";
  }

  return "openai";
}

function defaultModel(provider: LLMProvider): string {
  switch (provider) {
    case "anthropic":
      return "claude-sonnet-4-20250514";
    case "openai":
    case "openai-compatible":
      return "gpt-4.1";
  }
}

export function createLLMClient(options: CreateLLMClientOptions = {}) {
  const provider = resolveProvider(options.provider);
  const model = options.model ?? defaultModel(provider);

  switch (provider) {
    case "anthropic": {
      const apiKey = options.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY is required for anthropic provider");
      }
      return new AnthropicLLMClient(model, apiKey);
    }
    case "openai":
    case "openai-compatible": {
      const apiKey = options.openaiApiKey ?? process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is required for openai provider");
      }
      return new OpenAILLMClient(model, apiKey, options.baseUrl);
    }
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unsupported LLM provider: ${String(_exhaustive)}`);
    }
  }
}

export function hasLLMCredentials(provider?: LLMProvider): boolean {
  const resolved = resolveProvider(provider);
  if (resolved === "anthropic") {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }
  return Boolean(process.env.OPENAI_API_KEY);
}

export type { LLMClient } from "./client.js";
