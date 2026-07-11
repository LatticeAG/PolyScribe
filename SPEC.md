# PolyScribe — SPEC.md

## 1. Problem & User Value

Shipping software is noisy. Every release, maintainers waste hours reading through commits, PRs, and diffs to reconstruct what changed, why it matters, and how to describe it to users. The result is usually a sparse changelog or a manually drafted release note that misses contributions, mischaracterizes risk, and delays launches.

PolyScribe is a GitHub App that reads a repository's commits, pull requests, and diffs and drafts polished, ready-to-publish release notes and changelog updates. It turns the post-merge cleanup from a manual chore into a one-click (or fully automated) editorial step.

Key value:
- **Saves time** — what used to take 30–90 minutes per release now takes seconds.
- **Reduces omission** — no merged PR is forgotten because the human lost context.
- **Improves quality** — consistent tone, risk labels, migration callouts, and contributor credits.
- **Builds trust** — transparent, well-structured release communication for open-source communities and enterprise customers.

## 2. Target Users

| Segment | Who | Pain | How PolyScribe helps |
|---------|-----|------|---------------------|
| Open-source maintainers | Solo maintainers, core teams, foundations | Releases slip because no one writes notes; contributors feel ignored | Auto-drafts notes from merged PRs and credits authors |
| DevRel / product engineers | Teams at API-first companies | Need clear, customer-facing release posts | Generates polished summaries with migration and deprecation sections |
| Enterprise platform teams | Internal platform / infra teams | Many small service releases, hard to audit | Batch drafts per repo or per monorepo package |
| Release managers | Teams with compliance requirements | Need an auditable, structured record of changes | Versioned changelog entries with linked evidence |

## 3. Product Positioning

PolyScribe follows the LatticeAG product pattern:

- **Open-source CLI/SDK** (MIT license) — installable locally, auditable, no network required for local inference.
- **Invite-only hosted SaaS** — GitHub App hosted by LatticeAG for teams that want zero-config automation.

The OSS side builds trust and community contributions; the hosted side delivers speed, moat, and revenue. Self-hosting is possible via the OSS server package; the hosted SaaS is the fastest path.

## 4. Core Concepts

### 4.1 Repository
Any GitHub repository PolyScribe is installed on. A repo has configuration, history, and a generated changelog.

### 4.2 Release
A point-in-time snapshot of changes between two refs (usually two Git tags, or `last tag..HEAD`). Releases are the unit of output.

### 4.3 Changelog
A persistent, versioned markdown file (default `CHANGELOG.md`) that PolyScribe keeps updated. Each release becomes a new section.

### 4.4 Draft
An AI-generated candidate release note or changelog section before human approval. Drafts are stored temporarily and can be edited.

### 4.5 Source items
The raw evidence PolyScribe reads:
- **Commits** — messages, authors, stats.
- **Pull requests** — title, body, labels, linked issues, review comments, merge method.
- **Diffs** — file-level and hunk-level changes, renames, deletions.

### 4.6 Labels
PolyScribe interprets and emits labels:
- **Kind labels**: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `security`, `breaking`.
- **Risk labels**: `patch`, `minor`, `major` (for semver impact), `migration-required`, `deprecation`.

## 5. Core Features

### 5.1 Installable GitHub App
- One-click install for orgs or selected repos.
- Optional event-driven mode: draft release notes automatically after a tag is pushed.
- Optional on-demand mode: generate from `/draft` command or web dashboard.

### 5.2 Multi-source ingestion
- Reads commits, PRs, diffs, and PR review comments.
- Respects `.gitattributes` and ignores generated files by default.
- Groups changes by package in monorepos (via configurable paths or `package.json` / `pyproject.toml` roots).

### 5.3 AI drafting
- Generates a semver-aware draft with summary, sections, risk callouts, migration notes, and contributor credits.
- Supports multiple editorial tones: `technical`, `developer-friendly`, `executive`, `community`.
- Cites source PRs/commits via links.

### 5.4 Changelog management
- Appends or inserts entries into `CHANGELOG.md` (or user-specified path).
- Preserves existing formatting and unreleased sections.
- Can keep an `Unreleased` section updated on every merge.

### 5.5 Release note export
- Outputs GitHub Release notes, markdown file, or JSON payload.
- One-click publish as a GitHub Release (with tag creation).

### 5.6 Human review workflow
- Dashboard shows draft, diff, source evidence, and suggested semver bump.
- Comments / suggestions can be saved and versioned.
- Approver role required before publish (configurable).

### 5.7 CLI (OSS)
- `polyscribe draft` — generate a local draft from a git range.
- `polyscribe changelog` — update a local changelog.
- `polyscribe publish` — push a GitHub Release (requires `GITHUB_TOKEN`).
- `polyscribe config` — interactive configuration wizard.

### 5.8 Configuration
- Repo-level config via `.polyscribe.yml` or `.github/polyscribe.yml`.
- Org-level defaults via the SaaS dashboard.
- Key knobs: tone, changelog path, ignore globs, monorepo package roots, required approvers, auto-publish rules.

## 6. Non-Goals

The following are intentionally out of scope for the MVP:

- Writing marketing blog posts or social threads (export to those formats may come later).
- Automatic semver version bumping / tag creation without explicit approval.
- Support for non-Git forges (GitLab, Bitbucket, etc.) in MVP.
- Real-time editing of release notes inside GitHub's native UI (we provide our own dashboard).
- Guaranteed hallucination-free output — the product is a draft; human review is required.
- Multi-language release notes in MVP (English only).

## 7. Data Model

```ts
interface Repository {
  id: string;                     // GitHub node id
  owner: string;
  name: string;
  defaultBranch: string;
  config: PolyScribeConfig;
  installedAt: string;
  lastSyncedAt?: string;
}

interface PolyScribeConfig {
  changelogPath: string;          // default "CHANGELOG.md"
  tone: "technical" | "developer-friendly" | "executive" | "community";
  ignoreGlobs: string[];          // e.g. ["package-lock.json", "dist/**"]
  monorepoRoots?: string[];       // e.g. ["packages/*"]
  requireApprover: boolean;
  autoPublish: boolean;
  includeUnreleased: boolean;
}

interface ReleaseRange {
  fromRef: string;                // tag or sha
  toRef: string;                  // tag or sha (often "HEAD")
}

interface SourceItem {
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
  linkedIssues?: number[];
}

interface FileChange {
  path: string;
  status: "added" | "modified" | "removed" | "renamed";
  additions: number;
  deletions: number;
  patch?: string;
}

interface Draft {
  id: string;
  repositoryId: string;
  range: ReleaseRange;
  status: "pending" | "approved" | "published" | "discarded";
  suggestedSemver: "patch" | "minor" | "major";
  markdown: string;
  sections: DraftSection[];
  contributors: GitHubUser[];
  createdAt: string;
  updatedAt: string;
}

interface DraftSection {
  type: "summary" | "breaking" | "features" | "fixes" | "perf" | "docs" | "chore" | "security" | "migration" | "credits";
  title: string;
  content: string;
  sourceIds: string[];
}

interface ChangelogUpdate {
  repositoryId: string;
  version: string;
  date: string;
  markdown: string;
  prBranch?: string;
  commitMessage?: string;
}
```

## 8. API / Integration Surface

### 8.1 External Services

| Service | Purpose | Auth | Data Used |
|---------|---------|------|-----------|
| GitHub API (REST + GraphQL) | Read commits, PRs, diffs, labels, tags; publish releases; open PRs | GitHub App installation token | Repository metadata, commit/PR/diff content, user handles |
| LLM provider (OpenAI / Anthropic / local) | Summarize changes and generate prose | API key or local model | Aggregated source items (no raw secrets) |
| LatticeAG SaaS identity | Org/repo settings, billing, user accounts | Session cookie / OAuth | Emails, plan tier, usage |

### 8.2 GitHub App Permissions

| Permission | Reason |
|------------|--------|
| `contents` read/write | Read diffs; write changelog PRs; publish releases |
| `metadata` read | Discover repos and tags |
| `pull_requests` read | Read merged PRs, labels, bodies, comments |
| `issues` read | Read linked issue titles/bodies |
| `workflows` read | Identify CI-related changes (optional) |

Webhook subscriptions:
- `push` (tag pushes)
- `pull_request` (merged)
- `release` (published if manual)

### 8.3 Internal API Endpoints (SaaS)

```
GET  /api/repos
  returns: Repository[]

GET  /api/repos/:owner/:name
  returns: Repository

POST /api/repos/:owner/:name/draft
  body: { fromRef, toRef, tone? }
  returns: Draft

GET  /api/repos/:owner/:name/drafts
  returns: Draft[]

POST /api/drafts/:id/approve
  body: { notes? }
  returns: Draft

POST /api/drafts/:id/publish
  body: { version, target?: "github-release" | "changelog-pr" | "both" }
  returns: { url, changelogPrUrl?, releaseUrl? }

POST /api/drafts/:id/discard
  returns: Draft

GET  /api/repos/:owner/:name/config
  returns: PolyScribeConfig

PATCH /api/repos/:owner/:name/config
  body: Partial<PolyScribeConfig>
  returns: PolyScribeConfig
```

### 8.4 OSS CLI Commands

```
polyscribe draft [--from <ref>] [--to <ref>] [--tone <tone>] [--output <file>]
polyscribe changelog [--from <ref>] [--to <ref>] [--version <version>] [--write]
polyscribe publish [--draft-id <id>] [--version <version>] [--target <target>]
polyscribe config [--init]
polyscribe validate-config
```

## 9. UI Screens / Flows

### 9.1 Dashboard — Repo list
- Table of installed repos.
- Columns: repo, last release, draft status, config link, install more.
- Actions: open repo details, regenerate draft, view changelog.

### 9.2 Repo detail — Draft view
- Left pane: generated markdown preview with section tabs (Summary, Breaking, Features, Fixes, etc.).
- Right pane: source evidence (PR/commit list with links to GitHub).
- Top bar: suggested semver, tone selector, regenerate button.
- Bottom bar: edit in place, approve, discard, publish.

### 9.3 Repo detail — Changelog
- Rendered preview of current `CHANGELOG.md`.
- "Update Unreleased" button.
- "Open PR" button to propose a changelog update.

### 9.4 Repo settings
- Config form mirroring `PolyScribeConfig`.
- Webhook event log.
- User access / approver list.

### 9.5 CLI output
- Progress spinner for ingestion.
- Draft printed to stdout or saved to file.
- Diff preview before `--write`.

## 10. Design Direction

- **Visual language**: clean, document-editor first. Editor occupies the center; metadata is peripheral.
- **Palette**: neutral slate base, indigo accent, amber for breaking changes, emerald for fixes, red for major risk.
- **Typography**: system sans UI; changelog preview uses a narrow proportional serif or mono-adjacent font to evoke documents.
- **Motion**: subtle section reveal on draft generation; link hover states in source evidence panel.
- **Feel**: like a careful editor, not a dashboard. The product's job is to reduce noise, so the UI must be quiet.

## 11. Architecture

### 11.1 SaaS deployment

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  GitHub App     │────▶│  PolyScribe API  │────▶│  LLM provider   │
│  (webhooks)     │     │  (workers/cloud) │     │  (summarizer)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │  Postgres / KV   │
                        │  (drafts, repos) │
                        └──────────────────┘
```

- GitHub App receives webhooks, fetches source items via GitHub API, and stores normalized source data.
- Draft generation job queues work; LLM produces markdown; result stored as `Draft`.
- Human approves via dashboard; publish step calls GitHub API to create release and/or open changelog PR.

### 11.2 OSS packages

| Package | Runtime | Purpose |
|---------|---------|---------|
| `@polyscribe/core` | Node / Bun | Ingestion, config parsing, source normalization, changelog templating |
| `@polyscribe/cli` | Node / Bun | CLI commands |
| `@polyscribe/server` | Node / Bun / Deno | Self-hosted GitHub App server |
| `@polyscribe/web` | Browser | Dashboard UI (also used by SaaS) |

## 12. Security Model

- **Least-privilege GitHub App**: only the permissions listed in §8.2; no admin or code execution.
- **Installation tokens short-lived**: GitHub App tokens expire after 1 hour; no long-lived PATs in SaaS.
- **No raw secrets in LLM prompts**: source items are summarized; diffs are truncated and filtered.
- **User isolation**: SaaS multi-tenancy by GitHub installation ID; no cross-repo data access.
- **Audit log**: every draft, approve, and publish action is logged with actor and timestamp.
- **Self-hostable**: OSS server can run entirely inside a user's own infrastructure with their own LLM.

## 13. Deployment Model

- **OSS CLI/SDK**: published to npm and GitHub Releases under MIT.
- **Self-hosted server**: Docker image + Helm chart; needs `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `LLM_API_KEY`.
- **Hosted SaaS**: LatticeAG-managed Cloudflare Workers / Deno Deploy cluster with:
  - Serverless GitHub App handler
  - Queue for draft jobs
  - Postgres for persistence
  - Dashboard at `https://polyscribe.latticeag.io`

## 14. 6-Day MVP Milestones

### M1 — GitHub App skeleton + repo install (Day 1)
- Create GitHub App manifest.
- Implement OAuth/install flow.
- Store installation metadata.
- Verify webhook signature.

### M2 — Source ingestion (Day 2)
- Fetch commits and merged PRs between two refs.
- Fetch file-level diffs.
- Normalize into `SourceItem` schema.
- Respect ignore globs.

### M3 — Draft generation (Day 3)
- Build prompt pipeline for LLM.
- Generate markdown with sections and contributor credits.
- Return draft via API/CLI.
- Basic dashboard draft preview.

### M4 — Changelog update (Day 4)
- Parse and update `CHANGELOG.md` preserving structure.
- CLI `polyscribe changelog --write`.
- Open changelog update as PR (API + dashboard).

### M5 — Publish + review workflow (Day 5)
- Approve/discard actions.
- Publish as GitHub Release.
- Require-approver enforcement.
- Audit log.

### M6 — Polish + docs (Day 6)
- README, CLI docs, dashboard copy.
- Error handling and retries.
- Self-hosting quickstart.
- Dogfood on a LatticeAG repo.

## 15. Pricing & Positioning

| Tier | Who | Limits | Price |
|------|-----|--------|-------|
| **OSS** | Individuals, self-hosters | Unlimited local use | Free (MIT) |
| **SaaS Starter** | Small teams, early users | 5 repos, 10 drafts/month | Invite-only free |
| **SaaS Growth** | Growing orgs | Unlimited repos, unlimited drafts, priority LLM | Per-seat / per-org (TBD) |
| **Enterprise** | Large orgs | SSO, audit exports, custom LLM, on-prem deploy | Contact sales |

Early access is invite-only to maintain quality and gather feedback before general availability. OSS remains fully open to prevent lock-in.

## 16. Open Questions / Decisions

| # | Decision | Recommendation | Status |
|---|----------|----------------|--------|
| 1 | Default LLM provider for SaaS | OpenAI GPT-4.1 / Anthropic Claude 4 Sonnet with fallback | Pending |
| 2 | Support monorepo auto-detection | Yes, detect `packages/*`, `apps/*`, and `workspaces` fields | Pending |
| 3 | Auto-publish on tag push | Default off; configurable per repo | Pending |
| 4 | Storage for full diff content | Store 30 days then archive; source of truth remains GitHub | Pending |
| 5 | Public dashboard link sharing | Not in MVP; drafts are private to installation | Pending |
| 6 | Changelog format style | Keep a Changelog (https://keepachangelog.com/) by default | Pending |

## 17. Success Metrics

- Draft acceptance rate > 80% without heavy editing.
- Median time from tag push to published release < 2 minutes.
- Changelog PR merge rate > 70%.
- Zero P0 security incidents in first 90 days of SaaS.
