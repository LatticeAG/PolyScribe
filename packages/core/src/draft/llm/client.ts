import type { ZodSchema } from "zod";

export interface LLMCompleteInput<T> {
  system: string;
  user: string;
  schema: ZodSchema<T>;
  maxTokens?: number;
}

export interface LLMClient {
  readonly provider: string;
  readonly model: string;
  completeStructured<T>(input: LLMCompleteInput<T>): Promise<T>;
}
