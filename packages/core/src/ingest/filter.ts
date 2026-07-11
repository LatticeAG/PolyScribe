import { minimatch } from "minimatch";

export function shouldIgnorePath(path: string, ignoreGlobs: string[]): boolean {
  return ignoreGlobs.some((glob) => minimatch(path, glob, { dot: true }));
}

export function applyIgnoreGlobs<T extends { path: string }>(
  items: T[],
  ignoreGlobs: string[],
): T[] {
  return items.filter((item) => !shouldIgnorePath(item.path, ignoreGlobs));
}
