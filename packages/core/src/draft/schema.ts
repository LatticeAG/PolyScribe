import { z } from "zod";
import { draftSectionTypeSchema } from "../config/schema.js";

export const llmDraftSectionSchema = z.object({
  type: draftSectionTypeSchema,
  title: z.string().min(1),
  content: z.string(),
  sourceIds: z.array(z.string()).default([]),
});

export const llmDraftOutputSchema = z.object({
  suggestedSemver: z.enum(["patch", "minor", "major"]),
  sections: z.array(llmDraftSectionSchema).min(1),
  contributors: z
    .array(
      z.object({
        login: z.string(),
        id: z.string().optional(),
      }),
    )
    .default([]),
});

export type LLMDraftOutput = z.infer<typeof llmDraftOutputSchema>;
export type LLMDraftSection = z.infer<typeof llmDraftSectionSchema>;
