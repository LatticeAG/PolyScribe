import pc from "picocolors";
import type { ResolvedRange, SourceItem } from "@polyscribe/core";

export interface PrintSourcesOptions {
  pretty?: boolean;
  count?: boolean;
  range?: ResolvedRange;
}

export function printSources(
  sources: SourceItem[],
  options: PrintSourcesOptions = {},
): void {
  if (options.count) {
    const rangeLabel = options.range
      ? ` in ${options.range.fromRef}..${options.range.toRef}`
      : "";
    console.log(pc.dim(`Sources: ${sources.length}${rangeLabel}`));
    return;
  }

  const payload = options.pretty
    ? JSON.stringify(sources, null, 2)
    : JSON.stringify(sources);
  console.log(payload);
}
