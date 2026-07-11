import pc from "picocolors";
import { CitationValidationError } from "@polyscribe/core";
import {
  EXIT_CITATION,
  EXIT_CONFIG,
  EXIT_GIT,
  EXIT_LLM,
} from "../util/exit-codes.js";

function isExecaError(
  error: unknown,
): error is Error & { shortMessage?: string; command?: string } {
  return error instanceof Error && "shortMessage" in error;
}

export function isConfigError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Invalid config") ||
    error.message.includes("expected a YAML mapping") ||
    error.message.includes("Invalid date format")
  );
}

export function isGitError(error: unknown): boolean {
  if (isExecaError(error)) {
    return error.command === "git" || error.shortMessage?.includes("git") === true;
  }

  return error instanceof Error && error.message.includes("git");
}

export function handleCommandError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof CitationValidationError) {
    console.error(pc.red(message));
    process.exit(EXIT_CITATION);
  }

  if (isConfigError(error)) {
    console.error(pc.red(`Config error: ${message}`));
    process.exit(EXIT_CONFIG);
  }

  if (isGitError(error)) {
    console.error(pc.red(`Git error: ${message}`));
    process.exit(EXIT_GIT);
  }

  if (
    error instanceof Error &&
    (message.includes("API key") ||
      message.includes("LLM") ||
      message.includes("OpenAI") ||
      message.includes("Anthropic"))
  ) {
    console.error(pc.red(`LLM error: ${message}`));
    process.exit(EXIT_LLM);
  }

  throw error;
}
