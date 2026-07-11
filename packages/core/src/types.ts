export interface GitHubUser {
  login: string;
  id: string;
  avatarUrl?: string;
}

export interface FileChange {
  path: string;
  status: "added" | "modified" | "removed" | "renamed";
  previousPath?: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface SourceItem {
  id: string;
  type: "commit" | "pr" | "diff";
  sha?: string;
  prNumber?: number;
  title: string;
  body?: string;
  author: GitHubUser;
  mergedAt?: string;
  labels: string[];
  files?: FileChange[];
  linkedIssues?: Array<{ number: number; title: string }>;
  url: string;
}

export interface ReleaseRange {
  fromRef: string;
  toRef: string;
}

export interface ResolvedRange extends ReleaseRange {
  fromSha: string;
  toSha: string;
}

export interface RemoteRepo {
  host: string;
  owner: string;
  repo: string;
}

export interface CommitInfo {
  sha: string;
  title: string;
  body?: string;
  author: GitHubUser;
  committedAt: string;
}

export interface DiffOptions {
  ignoreGlobs?: string[];
  maxDiffBytesPerFile: number;
  maxTotalDiffBytes: number;
}

export interface CollectSourcesConfig extends DiffOptions {
  ignoreGlobs: string[];
  githubToken?: string;
}

export const DEFAULT_COLLECT_CONFIG: CollectSourcesConfig = {
  ignoreGlobs: [
    "**/package-lock.json",
    "**/pnpm-lock.yaml",
    "**/yarn.lock",
    "**/bun.lockb",
    "**/dist/**",
    "**/generated/**",
  ],
  maxDiffBytesPerFile: 20_000,
  maxTotalDiffBytes: 400_000,
};

export type DraftSectionType =
  | "summary"
  | "breaking"
  | "features"
  | "fixes"
  | "perf"
  | "docs"
  | "chore"
  | "security"
  | "migration"
  | "credits";

export interface DraftSection {
  type: DraftSectionType;
  title: string;
  content: string;
  sourceIds: string[];
}

export interface Draft {
  id: string;
  repositoryId: string;
  range: ReleaseRange;
  status: "pending" | "approved" | "published" | "discarded";
  suggestedSemver: "patch" | "minor" | "major";
  heuristicSemver: "patch" | "minor" | "major";
  markdown: string;
  sections: DraftSection[];
  contributors: GitHubUser[];
  model: { provider: string; name: string };
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export type PolyScribeTone =
  | "technical"
  | "developer-friendly"
  | "executive"
  | "community";

export type Tone = PolyScribeTone;

export type PublishTarget = "github-release" | "changelog-pr";

export type LLMProvider = "openai" | "anthropic" | "openai-compatible";

export interface GenerateDraftConfig {
  tone?: Tone;
  repositoryId?: string;
  range?: ReleaseRange;
}
