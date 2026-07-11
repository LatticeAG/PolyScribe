import type { SourceItem } from "../types.js";

const BREAKING_LABELS = new Set(["breaking", "breaking-change"]);
const FEAT_LABELS = new Set(["feat", "feature", "enhancement"]);

export type SemverLevel = "patch" | "minor" | "major";

export interface SemverSuggestion {
  level: SemverLevel;
  reasons: string[];
}

const CONVENTIONAL_MAJOR = /^[a-z]+!\s*[:(]/i;
const CONVENTIONAL_FEAT = /^feat(\(|:)/i;
const CONVENTIONAL_PATCH_TYPES = /^(fix|chore|docs)(\(|:)/i;

function collectMajorReasons(source: SourceItem): string[] {
  const reasons: string[] = [];
  const labels = source.labels.map((l) => l.toLowerCase());
  const titleBody = `${source.title}\n${source.body ?? ""}`;

  if (labels.some((l) => BREAKING_LABELS.has(l))) {
    reasons.push(`breaking label on ${source.id}`);
  }
  if (/BREAKING CHANGE/i.test(titleBody)) {
    reasons.push(`BREAKING CHANGE in ${source.id}`);
  }
  if (CONVENTIONAL_MAJOR.test(source.title)) {
    reasons.push(`conventional breaking commit: ${source.title}`);
  }

  return reasons;
}

function collectMinorReasons(source: SourceItem): string[] {
  const reasons: string[] = [];
  const labels = source.labels.map((l) => l.toLowerCase());

  if (labels.some((l) => FEAT_LABELS.has(l))) {
    reasons.push(`feature label on ${source.id}`);
  }
  if (CONVENTIONAL_FEAT.test(source.title) && !CONVENTIONAL_MAJOR.test(source.title)) {
    reasons.push(`conventional feat commit: ${source.title}`);
  }

  return reasons;
}

function collectPatchReasons(source: SourceItem): string[] {
  const reasons: string[] = [];

  if (CONVENTIONAL_PATCH_TYPES.test(source.title)) {
    reasons.push(`conventional patch commit: ${source.title}`);
  }

  return reasons;
}

export function suggestSemverFromSources(sources: SourceItem[]): SemverSuggestion {
  const majorReasons: string[] = [];
  const minorReasons: string[] = [];
  const patchReasons: string[] = [];

  for (const source of sources) {
    majorReasons.push(...collectMajorReasons(source));
  }

  if (majorReasons.length > 0) {
    return { level: "major", reasons: majorReasons };
  }

  for (const source of sources) {
    minorReasons.push(...collectMinorReasons(source));
  }

  if (minorReasons.length > 0) {
    return { level: "minor", reasons: minorReasons };
  }

  for (const source of sources) {
    patchReasons.push(...collectPatchReasons(source));
  }

  if (patchReasons.length > 0) {
    return { level: "patch", reasons: patchReasons };
  }

  return { level: "patch", reasons: ["no semver signals; defaulting to patch"] };
}
