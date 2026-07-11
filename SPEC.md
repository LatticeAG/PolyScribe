# PolyScribe — Product Specification

> **Status:** OSS Phase 1 — active implementation  
> **Owner:** LatticeAG  
> **Repo:** `LatticeAG/PolyScribe`  
> **Audience:** founders, eng, design, GTM  
> **Active scope:** `@polyscribe/core` + `@polyscribe/cli` only. SaaS deferred.  
> **Rule for this doc:** Prefer a concrete recommendation over an open debate. Open questions are listed only where a human product call is genuinely needed.

---

## 0. Executive Verdict

### Crucial decision: OSS, SaaS, or Hybrid?

**Long-term: Hybrid.** **Right now: OSS only.**

| Option | Long-term | Phase 1 (now) |
|--------|-----------|---------------|
| **Pure OSS** | Part of hybrid | **Ship this first** |
| **Pure SaaS** | Reject alone | Deferred |
| **Hybrid** | **Target end state** | OSS now → SaaS after OSS v0.1 |

**Why OSS first (locked):**

1. Validates the core value (ingestion → draft → changelog) without App/billing/queue complexity.
2. Builds trust and community before asking for GitHub App install permissions.
3. CLI is the viral wedge (`npx @polyscribe/cli draft`).
4. SaaS later reuses `@polyscribe/core` unchanged — no throwaway work.

**Hybrid end state (deferred, not in active scope):**

1. **MIT OSS** — `@polyscribe/core`, `@polyscribe/cli`, templates, prompt schemas, changelog parser.
2. **Hosted SaaS** — GitHub App, dashboard, queue, billing (Phase 2+).
3. **Self-host server** — `@polyscribe/server` + Docker (Phase 2+).

---

## 0.1 OSS Phase 1 — Implementation Specification

> This section is the **active build contract**. Everything here should be implementable without SaaS infrastructure.

### 0.1.1 Phase 1 goal

Ship a production-quality **local CLI** that:

1. Reads git history (+ optional GitHub PRs via `GITHUB_TOKEN`) for a ref range.
2. Generates an evidence-linked AI release draft (BYO LLM key).
3. Merges output into `CHANGELOG.md` (Keep a Changelog).
4. Passes CI: build, typecheck, 30+ unit tests, no live LLM in tests.

**Phase 1 exit criteria:**

```bash
pnpm install && pnpm build && pnpm test && pnpm typecheck  # all green
polyscribe doctor                                           # passes in a git repo + API key
polyscribe draft --from v0.1.0 --to HEAD --output NOTES.md  # produces cited draft
polyscribe changelog --version 0.2.0 --write                # updates CHANGELOG.md
```

### 0.1.2 Monorepo layout (locked)

```
PolyScribe/
├── package.json                 # pnpm workspaces root, turbo scripts
├── pnpm-workspace.yaml
├── turbo.json
├── LICENSE                      # MIT
├── README.md
├── SPEC.md
├── packages/
│   ├── tsconfig/
│   │   ├── base.json
│   │   └── node.json
│   ├── core/                    # @polyscribe/core
│   │   ├── package.json
│   │   ├── tsup.config.ts
│   │   ├── vitest.config.ts
│   │   ├── src/
│   │   │   ├── index.ts         # public barrel
│   │   │   ├── types.ts
│   │   │   ├── config/
│   │   │   ├── git/
│   │   │   ├── github/
│   │   │   ├── ingest/
│   │   │   ├── semver/
│   │   │   ├── changelog/
│   │   │   ├── redact/
│   │   │   ├── draft/
│   │   │   └── sources/         # re-export ingest + git + github
│   │   └── tests/
│   └── cli/                     # @polyscribe/cli
│       ├── package.json         # bin: polyscribe
│       └── src/
│           ├── index.ts
│           └── commands/
```

**Tooling (locked):**

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 22 | Runtime |
| pnpm | 10.x | Workspaces |
| Turborepo | 2.x | Task orchestration |
| TypeScript | 5.x | Language |
| tsup | 8.x | ESM + DTS builds |
| Vitest | 3.x | Unit tests |
| Zod | 3.x | Config + LLM JSON schema |
| Commander | 12.x | CLI parsing |
| picocolors | 1.x | Terminal colors |

### 0.1.3 Package: `@polyscribe/core`

**Purpose:** Pure library — no CLI, no env reads except where explicitly passed in options. All I/O via injected paths/tokens.

#### Public exports (`src/index.ts`)

```ts
// types
export type { SourceItem, Draft, DraftSection, ReleaseRange, PolyScribeConfig, ... }

// config
export { loadConfig, parseConfig, polyScribeConfigSchema, DEFAULT_IGNORE_GLOBS, EXAMPLE_CONFIG_YAML }

// sources / ingestion
export { collectSources, resolveRange, getLatestTag, resolveRef, applyIgnoreGlobs, ... }

// semver
export { suggestSemverFromSources }

// changelog
export { parseChangelog, insertVersion, renderKeepAChangelogBody }

// draft
export { generateDraft, buildDraftPrompts, renderDraftMarkdown, createLLMClient, CitationValidationError }

// redact
export { redactSecrets }
```

#### Module: `config/`

| File | API | Behavior |
|------|-----|----------|
| `schema.ts` | `polyScribeConfigSchema` (Zod) | Defaults per §0.1.6 |
| `load.ts` | `loadConfig(cwd)` | Merge `.github/polyscribe.yml` then `.polyscribe.yml`; later file wins on keys |
| `load.ts` | `validateConfigFile(path)` | Parse + validate; throw `ConfigError` with path |

**Config precedence (locked):** `defaults < .github/polyscribe.yml < .polyscribe.yml < CLI flags`

#### Module: `git/`

| File | API | Behavior |
|------|-----|----------|
| `exec.ts` | `git(cwd, args[])` | Wrapper around `execa('git', ...)` with cwd |
| `refs.ts` | `resolveRef(cwd, ref)` | `git rev-parse` → full SHA |
| `refs.ts` | `getLatestTag(cwd)` | `git describe --tags --abbrev=0` or null |
| `refs.ts` | `resolveRange(cwd, from?, to?)` | Default: `latestTag..HEAD`; if no tags, `root..HEAD` |
| `log.ts` | `getCommitsInRange(cwd, fromSha, toSha)` | Delimited `git log`; returns `CommitInfo[]` |
| `diff.ts` | `getFileChanges(cwd, fromSha, toSha, opts)` | `git diff --name-status` + `--numstat` + per-file patch; apply caps |

**Git log format (locked):** Use a unique record delimiter (`\x1e`) between commits and `\x1f` between fields to avoid parsing fragility:

```
sha\x1fauthorName\x1fauthorEmail\x1fdate\x1ftitle\x1fbody
```

#### Module: `github/`

| File | API | Behavior |
|------|-----|----------|
| `client.ts` | `detectRemoteRepo(cwd)` | Parse `origin` URL → `{ owner, repo, host }` |
| `client.ts` | `createOctokit(token?)` | `@octokit/rest` instance |
| `client.ts` | `getCommitDate(cwd, sha)` | For PR date window |
| `prs.ts` | `fetchMergedPrsInRange(remote, token?, since, until)` | Paginate `pulls.list` state=closed; filter `merged_at` in range |

**PR mapping → `SourceItem` (locked):**

```ts
{
  id: `pr:${number}`,
  type: "pr",
  prNumber: number,
  sha: merge_commit_sha,
  title, body, author, labels, linkedIssues, url,
  mergedAt: merged_at,
}
```

**Without `GITHUB_TOKEN`:** ingestion still works from git commits + diffs; PR bodies/labels unavailable.

#### Module: `ingest/`

| File | API | Behavior |
|------|-----|----------|
| `filter.ts` | `applyIgnoreGlobs(paths, globs)` | `minimatch` with `dot: true` |
| `collect.ts` | `collectSources(cwd, range, config)` | Orchestrate; **PR-first dedupe** |

**`collectSources` algorithm (locked):**

1. Resolve range → `fromSha`, `toSha`
2. Parallel fetch: commits, file changes, remote metadata
3. If remote + token: fetch merged PRs in commit-date window
4. Build `prCommitShas` from PR merge SHAs
5. Orphan commits = commits not in `prCommitShas`
6. Diff items: top 20 file changes as `type: "diff"` evidence (path + truncated patch)
7. Return `[...prItems, ...orphanCommitItems, ...diffItems]`

#### Module: `semver/heuristics.ts`

**`suggestSemverFromSources(sources)` (locked rules):**

1. `major` if any source has label `breaking` OR title/body matches `/BREAKING CHANGE/i`
2. else `minor` if any label `feat` OR conventional `feat:` in commit title
3. else `patch`

Returns `{ heuristic: SemverLevel, reasons: string[] }` for UI/debug.

#### Module: `changelog/`

| File | API | Behavior |
|------|-----|----------|
| `parse.ts` | `parseChangelog(markdown)` | Extract `preamble`, `unreleased`, `versions[]` |
| `merge.ts` | `insertVersion(doc, version, date, body)` | Insert after Unreleased or after preamble |
| `render.ts` | `renderKeepAChangelogBody(sections)` | `### Added/Changed/Fixed/...` from draft sections |

**Supported changelog headers (locked):**

```markdown
## [Unreleased]
## [1.2.3] - 2026-07-11
## 1.2.3 (2026-07-11)   # also parse, normalize on write
```

#### Module: `redact/secrets.ts`

**Patterns to redact before LLM (locked):**

| Pattern | Replacement |
|---------|-------------|
| AWS access key `AKIA...` | `[REDACTED_AWS_KEY]` |
| GitHub `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` | `[REDACTED_GITHUB_TOKEN]` |
| OpenAI `sk-...` | `[REDACTED_OPENAI_KEY]` |
| PEM `-----BEGIN ... PRIVATE KEY-----` blocks | `[REDACTED_PRIVATE_KEY]` |
| `Bearer eyJ...` JWTs | `[REDACTED_BEARER_TOKEN]` |

Apply to: commit messages, PR bodies, diff patches.

#### Module: `draft/`

**Pipeline (locked order):**

```
sources → redactSecrets → buildDraftPrompts → LLM structured JSON → validate citations → renderDraftMarkdown → Draft
```

| File | Responsibility |
|------|----------------|
| `prompt.ts` | System + user prompts; tone instructions; source catalog with ids |
| `schema.ts` | Zod `llmDraftOutputSchema`: `{ sections: [{type, title, content, sourceIds}], contributors, suggestedSemver? }` |
| `generate.ts` | `generateDraft(sources, config, llmClient)` + `CitationValidationError` |
| `render.ts` | Section order from config; omit empty; `## Contributors` last |
| `llm/client.ts` | `LLMClient.completeStructured<T>({ system, user, schema, maxTokens })` |
| `llm/providers.ts` | `OpenAILLMClient`, `AnthropicLLMClient` |
| `llm/factory.ts` | `createLLMClient(config?)` reads env |

**Citation validation (locked):**

- Every non-empty section (except `credits`) must have ≥1 valid `sourceId` OR inline `(#123)` / `(source:...)`
- Unknown `sourceId` → `CitationValidationError`
- On validation failure: retry once with repair prompt; then throw

**LLM defaults (OSS, locked):**

| Env | Default |
|-----|---------|
| `POLYSCRIBE_LLM_PROVIDER` | `openai` if `OPENAI_API_KEY`, else `anthropic` if `ANTHROPIC_API_KEY` |
| `OPENAI_API_KEY` | required for OpenAI |
| `ANTHROPIC_API_KEY` | required for Anthropic |
| Model (OpenAI) | `gpt-4.1` |
| Model (Anthropic) | `claude-sonnet-4-20250514` |
| `maxTokens` | 4096 output |

**Structured output:** Use provider native JSON mode / tool schema where available; fall back to `zod-to-json-schema.ts` + parse + Zod safeParse.

#### Tone prompt fragments (locked)

| Tone | System instruction fragment |
|------|----------------------------|
| `developer-friendly` | Clear, concrete, second-person optional; explain user impact; no hype |
| `technical` | Precise API names; mention endpoints, types, config keys |
| `executive` | 2–3 sentence summary; outcomes over implementation |
| `community` | Warm; emphasize contributors; thank by @handle |

### 0.1.4 Package: `@polyscribe/cli`

**Entry:** `packages/cli/src/index.ts` — Commander program, `run()` for testing.

#### Commands (Phase 1)

| Command | Status | Description |
|---------|--------|-------------|
| `polyscribe draft` | **Implemented** | Generate AI draft |
| `polyscribe changelog` | **Implemented** | Draft + merge into CHANGELOG |
| `polyscribe config --init` | **Implemented** | Write example `.polyscribe.yml` |
| `polyscribe validate-config` | **Implemented** | Validate config file |
| `polyscribe doctor` | **Implemented** | Preflight checks |
| `polyscribe publish` | **Implemented** | Create GitHub Release via API |
| `polyscribe sources` | **Implemented** | Print collected sources as JSON (debug) |

#### `polyscribe draft` (spec)

```
polyscribe draft [options]

Options:
  --from <ref>     Start ref (default: latest tag or root)
  --to <ref>       End ref (default: HEAD)
  --tone <tone>    Override config tone
  --output <file>  Write markdown to file
  --json           Print Draft JSON to stdout

Exit codes: 0 ok | 1 config/usage | 2 git | 3 LLM | 4 citation validation
```

**Stdout (default):** rendered markdown  
**Stderr:** progress (`Collecting sources...`, `Generating draft...`)

#### `polyscribe changelog` (spec)

```
polyscribe changelog [options]

Options:
  --from <ref>       Same as draft
  --to <ref>
  --version <ver>    Required unless interactive prompt
  --write            Write to changelogPath from config
  --date <YYYY-MM-DD> Default: today UTC

Flow:
  1. collectSources + generateDraft (or reuse cached draft — post-MVP)
  2. renderKeepAChangelogBody(sections)
  3. read changelogPath → insertVersion → write if --write else stdout
```

#### `polyscribe doctor` (spec)

Checks (print ✓/✗ each):

1. Inside a git repository
2. `git remote -v` has parseable origin
3. `GITHUB_TOKEN` set (optional, warn if missing)
4. LLM key reachable (`createLLMClient` + minimal ping or model list)
5. Config file valid if present
6. `changelogPath` exists or parent writable

### 0.1.5 Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | One of LLM keys | OpenAI draft generation |
| `ANTHROPIC_API_KEY` | One of LLM keys | Anthropic draft generation |
| `POLYSCRIBE_LLM_PROVIDER` | No | Force `openai` \| `anthropic` |
| `GITHUB_TOKEN` | No | Enrich with PR metadata |
| `POLYSCRIBE_CONFIG` | No | Override config file path |

### 0.1.6 Default `.polyscribe.yml` (locked)

```yaml
changelogPath: CHANGELOG.md
tone: developer-friendly
ignoreGlobs:
  - "**/package-lock.json"
  - "**/pnpm-lock.yaml"
  - "**/yarn.lock"
  - "**/bun.lockb"
  - "**/dist/**"
  - "**/build/**"
  - "**/generated/**"
  - "**/*.min.js"
monorepoRoots: []
requireApprover: true        # relevant for SaaS; ignored by CLI publish in Phase 1
autoPublish: false
includeUnreleased: false
publishTargets:
  - github-release
  - changelog-pr
includeCommittersWithoutPr: true
maxDiffBytesPerFile: 20000
maxTotalDiffBytes: 400000
sections:
  order:
    - summary
    - breaking
    - features
    - fixes
    - perf
    - security
    - docs
    - chore
    - migration
    - credits
# llm:                        # optional CLI override
#   provider: openai
#   model: gpt-4.1
```

### 0.1.7 Test matrix (Phase 1)

| Suite | File | Cases | Live deps |
|-------|------|-------|-----------|
| Config | `tests/config.test.ts` | defaults, merge, loadConfig | none |
| Semver | `tests/semver.test.ts` | patch/minor/major/breaking | none |
| Changelog | `tests/changelog.test.ts` | parse, insert Unreleased | none |
| Redact | `tests/redact.test.ts` | secret patterns | none |
| Filter | `tests/filter.test.ts` | ignore globs | none |
| Prompt | `tests/prompt.test.ts` | tone, source catalog | none |
| Render | `tests/render.test.ts` | section order, empty omit | none |
| Git integration | `tests/git.integration.test.ts` | **Phase 1b** | local git fixture repo |
| Citation | `tests/citation.test.ts` | **Phase 1b** | none |

**CI command (locked):** `pnpm build && pnpm test && pnpm typecheck && pnpm lint`

**Never in CI:** live LLM calls, live GitHub API calls.

### 0.1.8 Implementation status tracker

| Component | Status | Notes |
|-----------|--------|-------|
| Monorepo scaffold | ✅ Done | pnpm + turbo + tsup |
| `config/` | ✅ Done | Zod schema + load |
| `git/` refs, log, diff | ✅ Done | |
| `github/` client, prs | ✅ Done | optional token |
| `ingest/collect` | ✅ Done | PR-first dedupe |
| `semver/heuristics` | ✅ Done | |
| `changelog/` parse + merge | ✅ Done | |
| `redact/secrets` | ✅ Done | |
| `draft/` pipeline | ✅ Done | OpenAI + Anthropic |
| CLI draft/changelog/config/doctor | ✅ Done | |
| Unit tests (52+) | ✅ Done | core + cli |
| GitHub Actions CI | ✅ Done | `.github/workflows/ci.yml` |
| `docs/cli.md` | ✅ Done | full CLI reference |
| `docs/configuration.md` | ✅ Done | `.polyscribe.yml` reference |
| `docs/self-hosting.md` | ✅ Done | OSS CLI note; server later |
| Root `CHANGELOG.md` + `.polyscribe.yml` | ✅ Done | Keep a Changelog + example config |
| npm publish prep (`@polyscribe/*` v0.1.0) | ✅ Done | metadata, `prepublishOnly`, public access |
| `polyscribe publish` | ✅ Done | GitHub Releases API |
| `polyscribe sources` | ✅ Done | debug JSON export |
| Git integration tests | ✅ Done | fixture repo |
| Citation unit tests | ✅ Done | |
| Dogfood on LatticeAG repo | ⬜ Phase 1b | |
| npm publish `@polyscribe/*` to registry | ⬜ Phase 1c | `pnpm publish` after tag |

### 0.1.9 OSS milestones (active)

| ID | Done when | Status |
|----|-----------|--------|
| **O1** Scaffold + build | `pnpm build` green | ✅ |
| **O2** Ingestion | `collectSources` returns PRs+commits+diffs | ✅ |
| **O3** Draft | `generateDraft` + CLI `draft` | ✅ |
| **O4** Changelog | `insertVersion` + CLI `changelog --write` | ✅ |
| **O5** Tests | ≥30 unit tests, no live LLM | ✅ |
| **O6** Publish | `polyscribe publish` creates GitHub Release | ✅ |
| **O7** Docs + npm | README quickstart + npm publish prep | 🟡 Docs/CI done; registry publish Phase 1c |
| **O8** Dogfood | PolyScribe release notes via PolyScribe | ⬜ |

### 0.1.10 Phase 1b recommendations (next build tasks)

1. **`polyscribe publish`** — `POST /repos/{owner}/{repo}/releases` with `tag_name`, `body`, `draft: false`; require existing tag.
2. **`polyscribe sources --json`** — expose ingestion for debugging without LLM spend.
3. **Fixture git repo** in `packages/core/tests/fixtures/repo/` for integration tests.
4. **`CitationValidationError` tests** — bullet without sourceId fails; repair retry mocked.
5. **Config `llm.model` override** — wire through `createLLMClient`.
6. **Conventional commit detection** — `feat:` / `fix:` in commit titles augments semver heuristics.
7. **Rate limit handling** — Octokit retry plugin for GitHub 403/429.
8. **`polyscribe changelog --dry-run`** — print diff of changelog change without write.

### 0.1.11 Explicitly deferred (Phase 2+)

Do **not** build until OSS v0.1 ships:

- GitHub App + webhooks
- Dashboard (`@polyscribe/web`)
- `@polyscribe/server` multi-tenant
- Postgres, queues, billing, invites
- Auto-draft on tag push
- Approver roles / audit log UI
- SSO, org defaults

---

## 1. Problem & User Value

### 1.1 Problem

Shipping software is noisy. Every release, maintainers reconstruct “what changed and why it matters” from commits, PRs, diffs, labels, and tribal knowledge. Outcomes:

- Sparse or late changelogs
- Missed contributors and breaking changes
- Inconsistent tone across releases
- Hours burned per release (often 30–90 minutes for serious notes)
- Release managers without an auditable trail of what was communicated

Existing partial solutions leave gaps:

| Tool | What it does well | What’s missing |
|------|-------------------|----------------|
| GitHub “Auto-generate release notes” | Fast, free, linked PRs | Shallow prose; no risk/migration editorial; weak monorepo; no review UX |
| Release Drafter | Label → section automation | Template-only; no AI editorial judgment |
| semantic-release / Release Please | Versioning automation | Changelog is mechanical, not narrative |
| Conventional Commits parsers | Structure | Still human-written narrative |
| Generic LLM chat | Flexible prose | No GitHub evidence wiring, no changelog merge, no approval workflow |

### 1.2 Solution

**PolyScribe** is a GitHub-native release editor: it ingests commits, PRs, and diffs for a ref range, drafts polished release notes + changelog sections, and supports human approve → publish (GitHub Release and/or changelog PR).

### 1.3 Value propositions (locked messaging)

- **Time:** draft in seconds instead of half an hour.
- **Completeness:** every merged PR in range is considered; contributors credited.
- **Quality:** consistent tone, breaking/migration callouts, semver suggestion.
- **Trust:** evidence-linked drafts; OSS path for audit; human approval before publish by default.
- **Fit:** works for OSS maintainers *and* internal platform teams.

### 1.4 Non-value (do not claim)

- “Fully automatic perfect release notes with zero review”
- “Replaces your release manager”
- “Marketing blog / Twitter thread generator” (post-MVP)

---

## 2. Product Vision & Principles

### 2.1 Vision

Become the default **editorial layer** between git history and public release communication on GitHub — the careful editor, not another noisy ops dashboard.

### 2.2 Principles (locked)

1. **Draft, don’t dictate** — human approval is the default; auto-publish is opt-in.
2. **Evidence over eloquence** — every section cites PRs/commits; no orphan claims.
3. **Quiet UI** — one composition, document-first; reduce chrome.
4. **Config as code** — `.polyscribe.yml` is source of truth for repo behavior; dashboard mirrors it.
5. **Local parity** — CLI can do what SaaS does for a single repo, modulo hosted convenience.
6. **Least privilege** — minimal GitHub App permissions; truncate/redact before LLM.
7. **Changelog as artifact** — `CHANGELOG.md` (Keep a Changelog) is first-class, not an afterthought dump.
8. **Fail closed on publish** — never publish without explicit approval unless `autoPublish: true` is set.

---

## 3. Target Users & Jobs-to-be-Done

### 3.1 Segments

| Segment | Who | JTBD | Success looks like |
|---------|-----|------|--------------------|
| **OSS maintainers** | Solo / small core teams | “When I cut a tag, help me publish fair, complete notes without a writing session” | Tag → draft → approve → GitHub Release in one sitting |
| **DevRel / product eng** | API companies | “Turn merges into customer-safe release copy with migrations called out” | Breaking + migration sections are reliable |
| **Platform / release managers** | Internal multi-repo orgs | “Standardize release communication across services” | Same structure everywhere; audit trail |
| **Compliance-minded eng leads** | Regulated teams | “Prove what we told users about this version” | Versioned drafts + publish audit log |

### 3.2 Primary persona (MVP focus)

**Alex — OSS maintainer / tech lead**  
Maintains 1–5 GitHub repos, tags monthly or more, hates writing changelogs, already uses labels inconsistently, will install a GitHub App if setup is under 5 minutes, will try CLI first if skeptical of SaaS.

### 3.3 Secondary persona (SaaS growth)

**Riley — release manager at a 50–200 person company**  
Owns release process across many services, needs approvers, SSO later, wants org defaults and usage visibility.

### 3.4 Anti-personas (do not optimize MVP for)

- Marketing teams wanting blog SEO content
- Non-GitHub forges (GitLab/Bitbucket) users
- Teams wanting fully unattended semver bumps without any human gate

---

## 4. Competitive Positioning

**Category:** AI-assisted release notes / changelog automation for GitHub.

**Positioning statement:**  
*For GitHub teams who care about release quality, PolyScribe is the evidence-linked release editor that drafts Keep-a-Changelog-ready notes from PRs and diffs — open-source where you need control, hosted where you want zero-config.*

**Differentiation (locked):**

1. Evidence pane + draft pane (review UX), not just markdown dump
2. Semver + risk + migration awareness
3. Hybrid distribution (CLI + App + self-host)
4. Changelog merge intelligence (preserve Unreleased / existing structure)
5. Invite-only SaaS quality bar before GA

**Do not compete on:** being the best version bumper (leave that to Release Please / semantic-release; integrate later via hooks).

---

## 5. Hybrid Business Model (detail)

### 5.1 What is open (MIT)

| Package | Contents |
|---------|----------|
| `@polyscribe/core` | Ingestion adapters, config schema, source normalization, changelog parse/merge, prompt builders, section templates, semver heuristics |
| `@polyscribe/cli` | Local draft/changelog/publish/config commands |
| Templates & examples | Example `.polyscribe.yml`, prompt fixtures, sample changelogs |
| `@polyscribe/server` (community) | Self-hostable GitHub App webhook + API surface sufficient for single-tenant install |

### 5.2 What is hosted SaaS (paid / invite)

| Capability | Why SaaS |
|------------|----------|
| Managed GitHub App install | Zero ops |
| Multi-repo org dashboard | Convenience |
| Managed LLM routing + spend controls | Cost + quality |
| Draft history, audit log, approver roles | Team workflow |
| Org defaults, usage metering, invites | GTM |
| Priority support | Revenue |

### 5.3 Open-core boundary (locked)

- **Open:** generation algorithms, templates, CLI, self-host server baseline.
- **Hosted-only initially:** multi-tenant identity, billing, LatticeAG LLM proxy, shared queue, org SSO (later).
- **Avoid:** crippling the OSS CLI so it can’t draft. That kills trust. Monetize convenience, orchestration, and team features — not the ability to summarize a diff.

### 5.4 Licensing

- Code: **MIT** for all public packages at launch.
- Brand: “PolyScribe” and “LatticeAG” trademarks retained.
- CLA: **not required** at MVP; DCO (Developer Certificate of Origin) on commits is enough.
- Contribution guide: welcome fixes to core/CLI; SaaS dashboard contributions optional later.

### 5.5 Pricing (recommendation locked for launch narrative)

| Tier | Audience | Limits | Price |
|------|----------|--------|-------|
| **OSS** | Individuals, self-hosters | Unlimited local; BYO LLM | Free |
| **SaaS Starter** | Early invitees | 5 repos, 20 drafts/month, community support | Free during invite |
| **SaaS Team** | Growing orgs | Unlimited repos, 200 drafts/mo included, then metered | **$29 / seat / mo** or **$99 / org / mo** (prefer org flat for simplicity — **recommend org flat $99**) |
| **SaaS Business** | Larger teams | SSO (later), audit export, custom model, higher limits | **$299 / org / mo** |
| **Enterprise** | Regulated | On-prem assist, custom LLM VPC, MSA/DPA, SLA | Contact sales |

**Recommendation:** Prefer **org-based pricing** over per-seat for MVP SaaS — release tools are used by few people across many repos; seat billing creates friction and under-monetizes.

**Metering unit:** `draft generation` (one LLM job per draft regenerate counts). Approvals/publishes are free.

---

## 6. Core Concepts

| Concept | Definition |
|---------|------------|
| **Repository** | GitHub repo with PolyScribe installed or locally configured |
| **Release range** | `fromRef..toRef` (tags/SHAs); default `latest tag..HEAD` |
| **Source item** | Normalized commit, PR, or file change used as evidence |
| **Draft** | AI candidate release note + structured sections + suggested semver |
| **Changelog** | Persistent markdown file (default `CHANGELOG.md`) |
| **Publish target** | `github-release` \| `changelog-pr` \| `both` |
| **Tone** | Editorial voice preset |
| **Installation** | GitHub App install binding (SaaS/self-host) |

### 6.1 Kind labels (input + output)

`feat` · `fix` · `chore` · `docs` · `refactor` · `perf` · `test` · `security` · `breaking`

### 6.2 Risk / impact labels (output)

`patch` · `minor` · `major` · `migration-required` · `deprecation`

### 6.3 Tone presets (locked)

| Tone | Voice | Use when |
|------|-------|----------|
| `technical` | Precise, API-oriented | Libraries, infra |
| `developer-friendly` (**default**) | Clear, friendly, concrete | Most OSS + product APIs |
| `executive` | Short, outcome-focused | Internal stakeholder digests |
| `community` | Warm, credits-forward | Community OSS projects |

---

## 7. Scope

### 7.1 MVP in scope

- GitHub App install (org or selected repos)
- Source ingestion: commits, merged PRs, file-level diffs, labels, linked issues
- AI draft with sections + credits + suggested semver
- Dashboard draft review (preview + evidence)
- Approve / discard / regenerate
- Publish GitHub Release
- Changelog update + open PR
- `.polyscribe.yml` config
- OSS CLI: `draft`, `changelog`, `publish`, `config`, `validate-config`
- Ignore globs; basic monorepo path grouping
- Audit log (SaaS)
- Invite-only SaaS gate

### 7.2 Explicit non-goals (MVP)

- Marketing blogs, social threads, email digests
- Auto semver bump + tag creation without approval
- GitLab / Bitbucket / Azure DevOps
- Guaranteed hallucination-free output
- Multi-language notes (English only)
- Real-time editing inside GitHub’s native Release UI
- Slack/Linear bots
- Automatic dependency-update noise summarization beyond ignore rules
- Fine-grained per-file LLM review (too expensive)

### 7.3 Post-MVP candidates (ordered recommendation)

1. Unreleased section auto-update on merge
2. Conventional Commits / label mapping improvements
3. Monorepo per-package releases
4. Custom prompt overlays in config
5. Export JSON for static sites / docs pipelines
6. Integration with Release Please / changesets
7. Multi-language
8. SSO / SAML
9. Slack approve/publish
10. Public “share draft” links (private by default forever unless opted in)

---

## 8. User Journeys

### 8.1 Happy path — SaaS tag push

1. Maintainer installs PolyScribe GitHub App on `acme/api`.
2. Configures `.github/polyscribe.yml` (or accepts defaults).
3. Pushes tag `v1.4.0`.
4. Webhook triggers draft job for `v1.3.0..v1.4.0`.
5. Dashboard shows draft + evidence; Slack email optional later.
6. Maintainer edits lightly, clicks **Approve**, then **Publish** → GitHub Release + changelog PR.
7. Merges changelog PR.

### 8.2 Happy path — OSS CLI

1. `npx @polyscribe/cli config --init`
2. Sets `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` (or local endpoint).
3. `polyscribe draft --from v1.3.0 --to HEAD --output RELEASE.md`
4. Reviews file; `polyscribe changelog --write --version 1.4.0`
5. `polyscribe publish --version 1.4.0` with `GITHUB_TOKEN`

### 8.3 On-demand dashboard draft

1. Open repo in dashboard → **New draft**
2. Pick range / tone → Generate
3. Review → Approve → Publish targets

### 8.4 Failure paths (must handle)

| Failure | UX |
|---------|----|
| No prior tag | Prompt for `fromRef` or first-release mode |
| Empty range | Explain; don’t call LLM |
| LLM timeout | Retry with backoff; show partial sources |
| GitHub rate limit | Queue + retry; surface status |
| Changelog parse failure | Offer overwrite-unreleased or open raw PR |
| Missing permissions | Install remediation checklist |
| Hallucinated API name | Evidence highlighting; regenerate; user edit |

---

## 9. Feature Specifications

### 9.1 GitHub App

- Manifest-based create/install
- Org or repo selection
- Webhooks: `push` (tags), `pull_request` (merged, optional Unreleased), `installation`, `installation_repositories`
- Optional: `release` for sync when humans publish manually
- Commands later: issue comment `/polyscribe draft` (post-MVP)

**Recommendation:** MVP triggers = **manual dashboard/CLI + tag push**. Do not auto-draft on every merge in MVP (noise/cost).

### 9.2 Multi-source ingestion

**Collect for range:**

- Commits (message, author, sha, stats)
- Merged PRs intersecting range (title, body, labels, author, reviewers optional, merge commit)
- Linked issues (number + title; body truncated)
- File changes (path, status, +/-, patch truncated)

**Filtering (locked defaults):**

```yaml
ignoreGlobs:
  - "**/package-lock.json"
  - "**/pnpm-lock.yaml"
  - "**/yarn.lock"
  - "**/dist/**"
  - "**/build/**"
  - "**/*.min.js"
  - "**/generated/**"
```

Respect `.gitattributes` `linguist-generated` when available.

**PR-first strategy (locked):** Prefer grouping by PR; orphan commits become their own source items. Do not double-count PR commits as separate narrative items.

### 9.3 AI drafting

**Output structure (locked default markdown):**

```markdown
## Summary
...

## Breaking Changes
...

## Features
...

## Fixes
...

## Performance
...

## Security
...

## Documentation
...

## Maintenance
...

## Migration Guide
...

## Contributors
Thanks to @a, @b, ...
```

Omit empty sections. Always include Summary + Contributors when any sources exist.

**Semver suggestion heuristics (deterministic layer before LLM):**

- Any `breaking` label / `BREAKING CHANGE` footer / major risk → `major`
- Else any `feat` → `minor`
- Else → `patch`
- LLM may confirm/explain but **cannot silently override** without showing the heuristic result; UI shows both if they disagree.

**Prompt pipeline (locked):**

1. Normalize + dedupe source items
2. Classify kind/risk with rules + light model assist if ambiguous
3. Truncate diffs (per-file cap, total token budget)
4. Redact secrets via pattern filters
5. Generate structured JSON sections → render markdown template
6. Validate citations: every bullet must reference ≥1 source id

**Token budget recommendation:** hard cap per draft job (e.g. 100k input tokens equivalent); drop largest patches first, keep PR titles/bodies.

### 9.4 Changelog management

- Default path: `CHANGELOG.md`
- Default style: **[Keep a Changelog](https://keepachangelog.com/)** + SemVer headings
- Preserve preamble and existing versions
- Support `## [Unreleased]` section
- Write via branch + PR by default on SaaS (`chore: update changelog for vX.Y.Z`)
- CLI `--write` updates working tree locally

**Recommendation:** Never force-push to default branch. Always PR on SaaS.

### 9.5 Publish

Targets:

- GitHub Release body = approved markdown (minus optional internal notes)
- Changelog PR
- Both (default when changelog enabled)

Tag creation: **only if tag missing and user explicitly confirms** in publish dialog. MVP recommendation: require tag to already exist for tag-push flow; allow create-tag checkbox on manual publish.

### 9.6 Human review workflow

Roles (SaaS):

| Role | Powers |
|------|--------|
| Viewer | Read drafts |
| Editor | Generate, edit, regenerate, discard |
| Approver | Approve |
| Admin | Config, members, billing |

MVP simplification: **any install member with write can edit; Approver required only if `requireApprover: true`** (default `true` for SaaS org installs, `false` for personal user installs).

### 9.7 CLI (OSS)

```
polyscribe draft [--from <ref>] [--to <ref>] [--tone <tone>] [--output <file>] [--json]
polyscribe changelog [--from <ref>] [--to <ref>] [--version <version>] [--write]
polyscribe publish [--version <version>] [--notes <file>] [--target <target>]
polyscribe config [--init]
polyscribe validate-config [path]
polyscribe doctor          # auth, repo detection, LLM reachability
```

Exit codes: `0` ok, `1` usage/config, `2` GitHub, `3` LLM, `4` changelog parse.

### 9.8 Configuration schema (locked defaults)

```yaml
# .polyscribe.yml or .github/polyscribe.yml
changelogPath: CHANGELOG.md
tone: developer-friendly
ignoreGlobs: [ ...defaults... ]
monorepoRoots: []          # e.g. ["packages/*", "apps/*"]
requireApprover: true
autoPublish: false
includeUnreleased: false
publishTargets: [github-release, changelog-pr]
sections:
  order: [summary, breaking, features, fixes, perf, security, docs, chore, migration, credits]
includeCommittersWithoutPr: true
maxDiffBytesPerFile: 20000
maxTotalDiffBytes: 400000
llm:
  # CLI/self-host only; SaaS ignores and uses managed routing
  provider: openai         # openai | anthropic | openai-compatible
  model: gpt-4.1
```

Org SaaS defaults can override when repo file absent; **repo file wins** when present.

---

## 10. Data Model

```ts
interface Repository {
  id: string;                 // GitHub node id
  installationId: string;
  owner: string;
  name: string;
  defaultBranch: string;
  config: PolyScribeConfig;
  installedAt: string;        // ISO
  lastSyncedAt?: string;
}

interface PolyScribeConfig {
  changelogPath: string;
  tone: "technical" | "developer-friendly" | "executive" | "community";
  ignoreGlobs: string[];
  monorepoRoots?: string[];
  requireApprover: boolean;
  autoPublish: boolean;
  includeUnreleased: boolean;
  publishTargets: Array<"github-release" | "changelog-pr">;
  maxDiffBytesPerFile: number;
  maxTotalDiffBytes: number;
}

interface ReleaseRange {
  fromRef: string;
  toRef: string;
}

interface GitHubUser {
  login: string;
  id: string;
  avatarUrl?: string;
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
  linkedIssues?: Array<{ number: number; title: string }>;
  url: string;
}

interface FileChange {
  path: string;
  status: "added" | "modified" | "removed" | "renamed";
  previousPath?: string;
  additions: number;
  deletions: number;
  patch?: string;            // truncated
}

interface Draft {
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

interface DraftSection {
  type:
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
  title: string;
  content: string;
  sourceIds: string[];
}

interface ChangelogUpdate {
  repositoryId: string;
  version: string;
  date: string;              // YYYY-MM-DD
  markdown: string;
  prBranch?: string;
  commitMessage?: string;
}

interface AuditEvent {
  id: string;
  repositoryId: string;
  actor: string;
  action: "draft.create" | "draft.regenerate" | "draft.approve" | "draft.discard" | "draft.publish" | "config.update";
  draftId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
```

**Retention (locked recommendation):**

- Drafts + audit: 1 year on SaaS (exportable on Business+)
- Raw patches in DB: **30 days**, then drop; re-fetch from GitHub if needed
- Source metadata (titles, links, labels): keep with draft lifetime

---

## 11. API & Integration Surface

### 11.1 External services

| Service | Purpose | Auth | Notes |
|---------|---------|------|-------|
| GitHub REST + GraphQL | Read/write repo data | GitHub App installation token | Prefer GraphQL for PR lists |
| LLM provider | Draft generation | SaaS: LatticeAG proxy; OSS: user key | Support OpenAI, Anthropic, OpenAI-compatible |
| Email (optional) | Invite + “draft ready” | Provider TBD | Post-MVP ok |
| Payments | SaaS billing | Stripe | Before GA, not before invite |

### 11.2 GitHub App permissions (least privilege)

| Permission | Access | Reason |
|------------|--------|--------|
| Contents | Read & write | Diffs; changelog commits/PRs; releases |
| Metadata | Read | Repo discovery |
| Pull requests | Read & write | Read merged PRs; open changelog PRs |
| Issues | Read | Linked issue titles |
| Members | Read | Approver resolution (SaaS) |

**Avoid:** Actions write, Administration, Secrets, Workflows write.

Webhooks: `push`, `pull_request`, `installation`, `installation_repositories`, `ping`.

### 11.3 Internal SaaS HTTP API

```
GET    /api/repos
GET    /api/repos/:owner/:name
POST   /api/repos/:owner/:name/drafts
GET    /api/repos/:owner/:name/drafts
GET    /api/drafts/:id
PATCH  /api/drafts/:id                 # edit markdown/sections
POST   /api/drafts/:id/regenerate
POST   /api/drafts/:id/approve
POST   /api/drafts/:id/discard
POST   /api/drafts/:id/publish
GET    /api/repos/:owner/:name/config
PATCH  /api/repos/:owner/:name/config
GET    /api/repos/:owner/:name/audit
GET    /api/installations
POST   /api/invites                    # LatticeAG admin
```

Auth: session cookie after GitHub OAuth; CSRF protection; installation-scoped authorization.

Idempotency: `POST .../publish` accepts `Idempotency-Key`.

### 11.4 Webhook → job contract

```ts
type DraftJob = {
  installationId: string;
  repositoryId: string;
  trigger: "tag_push" | "manual" | "cli_bridge";
  range: ReleaseRange;
  tone?: PolyScribeConfig["tone"];
};
```

Queue: at-least-once; workers must be idempotent on `(repositoryId, fromRef, toRef, trigger)` for short window.

---

## 12. UI / UX Specification

### 12.1 Design direction (locked)

- **Composition:** document-editor first — draft is the hero, not a widget grid.
- **Palette:** neutral slate base; indigo accent for actions; amber for breaking; emerald for fixes; red only for major risk / destructive.
- **Typography:** distinctive UI sans (not Inter/Roboto/Arial); changelog preview in a readable document face or mono-adjacent for markdown fidelity.
- **Background:** subtle paper/grid atmosphere; avoid flat pure white and generic purple gradients.
- **Cards:** avoid in hero/draft view; use cards only for interactive repo list rows if needed.
- **Motion (2–3 intentional):**
  1. Draft sections stagger-fade on generation complete
  2. Evidence item highlight when clicking a citation
  3. Soft progress pulse while ingesting/generating
- **Feel:** careful editor, quiet, trustworthy.

**Note:** If implementing inside an existing LatticeAG design system later, inherit system tokens — until then, PolyScribe-specific tokens as above.

### 12.2 Screens

1. **Landing / marketing** (separate from app) — brand-forward, hybrid story, CTA: Request invite / Star on GitHub / `npx` quickstart.
2. **Invite gate**
3. **Repo list** — installed repos, last draft status, last published version
4. **Draft view** — left markdown preview/editor; right evidence; top semver + tone + regenerate; bottom approve/discard/publish
5. **Changelog view** — rendered file + Update Unreleased + Open PR
6. **Settings** — config form, secrets status (LLM for self-host), approvers, webhook log
7. **Audit log**
8. **Billing** (pre-GA stub ok)

### 12.3 Accessibility

- Keyboard approve/publish with confirm
- Contrast AA
- Don’t rely on color alone for risk (icons + text)

### 12.4 Empty / first-run states

- No tags yet → guided first release range
- No PRs in range → commit-only mode explanation
- Not installed → install checklist

---

## 13. Architecture

### 13.1 Logical architecture

```
GitHub webhooks ──▶ API gateway ──▶ Queue ──▶ Draft workers ──▶ LLM provider
                         │                         │
                         ▼                         ▼
                    Postgres (repos, drafts, audit)
                         │
                         ▼
                    Dashboard (web)
```

CLI talks to: local git + GitHub API + LLM directly (no LatticeAG required).

### 13.2 Package map

| Package | Runtime | Role |
|---------|---------|------|
| `@polyscribe/core` | Node 22+ / Bun | Shared domain logic |
| `@polyscribe/cli` | Node 22+ / Bun | DX entrypoint |
| `@polyscribe/server` | Node 22+ | App + API for SaaS/self-host |
| `@polyscribe/web` | Next.js App Router | Dashboard UI |
| `@polyscribe/prompt` (optional split) | Node | Prompt templates + JSON schemas |

### 13.3 Tech stack recommendations (locked for MVP)

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript | One language across CLI/server/web |
| Web | Next.js (App Router) on Vercel | LatticeAG fit; dashboard + marketing |
| API | Next route handlers **or** separate Hono/Node worker service | Prefer **separate worker service** for webhook/queue reliability |
| DB | Postgres (Neon) | Relational drafts/audit; Marketplace-friendly |
| Queue | Inngest or Cloudflare Queues / BullMQ | **Recommend Inngest** for DX on Vercel-centric stack |
| Auth | GitHub OAuth + GitHub App | Natural identity |
| Hosting SaaS | Vercel (web) + workers for jobs | Simple |
| Container self-host | Docker + Compose; Helm later | Enterprise path |
| LLM | Anthropic Claude Sonnet + OpenAI GPT-4.1 fallback | Quality/price; abstract provider interface |
| Validation | Zod | Config + API + LLM JSON schema |
| Logging | Structured JSON + OpenTelemetry traces | Debug draft jobs |
| Error monitoring | Sentry | API + worker + web |

### 13.4 Monorepo recommendation

**Yes — Turborepo / pnpm workspace** under `LatticeAG/PolyScribe`:

```
apps/web
apps/server
packages/core
packages/cli
packages/config-eslint
packages/tsconfig
```

---

## 14. LLM System Design

### 14.1 Provider abstraction

```ts
interface LLMClient {
  completeStructured<T>(input: {
    system: string;
    user: string;
    schema: ZodSchema<T>;
    maxTokens: number;
  }): Promise<T>;
}
```

### 14.2 Safety rails

- Secret redaction before prompt (AWS keys, tokens, private key blocks)
- Strip `Authorization` headers from patches
- Cap patch size
- Structured output only; reject freeform if citations missing
- Store model name/version on Draft for replay

### 14.3 Evaluation harness (required before GA)

- Golden fixture repos (public) with expected section containment
- Metrics: citation coverage, empty-section rate, breaking-change recall on labeled fixtures
- Human eval rubric for invite users (1–5 on accuracy/tone/completeness)

**Gate:** do not open public SaaS until citation coverage ≥ 95% on fixtures and invite draft acceptance ≥ 70%.

### 14.4 Cost controls

- Per-org monthly draft quota
- Per-job token ceiling
- Cache identical `(repo, from, to, configHash)` drafts for 24h unless force regenerate

---

## 15. Security, Privacy, Compliance

### 15.1 Security model

- Short-lived GitHub installation tokens only
- Encrypt LLM provider keys at rest (self-host / BYO on SaaS Business+)
- Tenant isolation by `installationId`
- Webhook signature verification mandatory
- CSP, secure cookies, CSRF on dashboard
- No cross-installation draft access
- Admin impersonation: none in MVP

### 15.2 Privacy

- Diffs may contain sensitive code — disclose clearly in install docs
- Data Processing: drafts stored in LatticeAG SaaS region (**recommend `us-east` single region MVP**)
- Do not train foundation models on customer repo content by default; contractually forbid with providers where possible
- Retention as in §10
- Delete-on-uninstall: soft-delete 30 days then hard-delete

### 15.3 Compliance roadmap

| Stage | Need |
|-------|------|
| Invite | Privacy policy, security page, DPA draft |
| GA Team | SOC2 start (Type I path), Stripe tax |
| Enterprise | SSO, audit export, VPC/on-prem option, signed BAA only if healthcare push (not default) |

---

## 16. Reliability & Observability

### 16.1 SLOs (SaaS targets)

| Metric | Target |
|--------|--------|
| Webhook acknowledge | < 3s |
| Draft job p50 | < 45s |
| Draft job p95 | < 3 min |
| API availability | 99.9% monthly |
| Publish success after approve | ≥ 99% excluding GitHub outages |

### 16.2 Observability

- Metrics: draft success/fail, token usage, GitHub API latency, queue depth
- Traces: ingestion → prompt → validate → store
- Alert: spike in LLM validation failures; webhook signature failures; publish errors

### 16.3 Disaster recovery

- Postgres automated backups (Neon PITR)
- Queue replay for failed jobs
- Runbooks: GitHub App credential rotation, LLM provider failover

---

## 17. Testing Strategy

| Layer | What |
|-------|------|
| Unit | Config parse, changelog merge, semver heuristics, redaction |
| Contract | GitHub API mocks; LLM schema validation |
| Fixture e2e | Public repo ranges → draft snapshots (sanitized) |
| CLI smoke | `doctor`, `draft --json` on fixture git repo |
| Web e2e | Install mock → draft → approve → publish mock |
| Load | Burst tag pushes across N repos |

**Recommendation:** Treat changelog merge and citation validation as the highest-value unit tests — they prevent the worst trust failures.

---

## 18. Documentation Plan

| Doc | Audience |
|-----|----------|
| README | All — 60-second pitch + CLI quickstart + App install |
| SPEC.md (this) | Builders |
| `docs/config.md` | Config reference |
| `docs/self-hosting.md` | Operators |
| `docs/security.md` | Security reviewers |
| `docs/prompting.md` | Contributors extending prompts |
| Changelog of PolyScribe itself | Dogfood |

Dogfood rule: **PolyScribe releases are written with PolyScribe** once M3 exists.

---

## 19. Go-to-Market

### 19.1 Launch sequence (capability-based, not calendar)

1. Private dogfood on LatticeAG repos
2. Invite OSS maintainers (warm network)
3. Public OSS CLI + core on GitHub
4. Product Hunt / HN only after invite acceptance metric hits gate
5. GA SaaS when billing + quotas ready

### 19.2 Distribution wedges

- `npx @polyscribe/cli draft` viral DX
- GitHub Marketplace listing (after permissions review)
- Comparison page vs Release Drafter / auto-notes
- “Migration from Release Drafter” guide

### 19.3 Success metrics (locked)

| Metric | Target |
|--------|--------|
| Draft acceptance without heavy edit | > 80% |
| Tag → published release median (approve included human wait excluded for automation metric: tag → draft ready) | draft ready < 2 min p50 |
| Changelog PR merge rate | > 70% |
| Invite → install conversion | > 40% |
| OSS → SaaS conversion (90 days) | track; no hard gate |
| P0 security incidents | 0 in first 90 days |

---

## 20. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| LLM hallucinated features | Citation validation; evidence UI; human approve default |
| Cost blowups on huge monorepos | Diff caps; package roots; quotas |
| GitHub permission fatigue | Tight scopes; clear install copy |
| OSS cannibalizes SaaS | Monetize team workflow/hosting, not draft ability |
| Changelog format diversity | Detect common formats; Prefer Keep a Changelog; escape hatch raw mode |
| Secret leakage into prompts | Redaction + patch truncation + provider zero-retention where available |
| Competitor: GitHub improves native AI notes | Win on review UX, changelog merge, hybrid trust, migration sections |

---

## 21. Delivery Plan

### 21.1 OSS Phase 1 (active — see §0.1)

| ID | Milestone | Status |
|----|-----------|--------|
| O1 | Scaffold + build | ✅ |
| O2 | Ingestion (`collectSources`) | ✅ |
| O3 | Draft generation + CLI `draft` | ✅ |
| O4 | Changelog merge + CLI `changelog` | ✅ |
| O5 | Unit tests (32+) | ✅ |
| O6 | `polyscribe publish` | ✅ Done |
| O7 | npm publish + docs | ⬜ Phase 1c |
| O8 | Dogfood release | ⬜ Phase 1c |

### 21.2 SaaS Phase 2+ (deferred)

> Do not start until OSS v0.1 is on npm and dogfooded.

### M1 — App skeleton & identity
**Done when:** GitHub App installs; webhook signatures verified; installation stored; user can sign into empty dashboard.

### M2 — Source ingestion (SaaS)
**Done when:** Same as O2 but via webhook-triggered jobs.

### M3 — Draft generation (SaaS)
**Done when:** LLM pipeline produces cited markdown + sections + semver; available via API + dashboard.

### M4 — Changelog (SaaS)
**Done when:** Keep a Changelog merge works; SaaS opens changelog PR.

### M5 — Review & publish (SaaS)
**Done when:** Approve/discard/publish to GitHub Release; `requireApprover` enforced; audit events recorded.

### M6 — Hardening & docs (SaaS)
**Done when:** Retries, security doc, self-host compose, invite flow live.

---

## 22. Open Questions

Only items that still need a human call. Everything else in this SPEC is a **recommendation treated as default**.

| # | Question | Recommendation | Needs founder call? |
|---|----------|----------------|---------------------|
| 1 | Brand domain | `polyscribe.latticeag.io` for app; docs under same | Soft — OK unless you have a vanity domain |
| 2 | Org pricing $99 vs per-seat | **Org flat $99 Team** | Confirm before Stripe |
| 3 | Default LLM | Anthropic Claude Sonnet primary, OpenAI fallback | Soft — engineering may swap on evals |
| 4 | GitHub Marketplace at invite vs GA | **GA only** | Confirm |
| 5 | Trademark “PolyScribe” clearance | Run a quick search before public launch | Yes |
| 6 | Whether `@polyscribe/server` is MIT day-one or delayed | **MIT day-one** for trust | Confirm if you fear hosting cannibalization (I still recommend open) |
| 7 | Single-region US only at MVP? | **Yes** | Confirm if EU users are day-one critical |

### Questions for you (optional replies)

Reply with preferences only where you disagree; otherwise we treat SPEC defaults as law:

1. **Pricing:** Org flat Team at ~$99, or do you prefer free-only until PMF?
2. **Auto-draft on tag:** keep default off, or on for SaaS installs?
3. **Server openness:** MIT day-one for `@polyscribe/server`, or open CLI/core only at first?
4. **Primary model:** Claude Sonnet vs GPT-4.1 as default SaaS brain?
5. **EU data residency:** needed for first invites, or US-only OK?
6. **Name lock:** keep **PolyScribe**, or exploring alternates?

---

## 23. Decision Log (accepted defaults)

| Decision | Choice |
|----------|--------|
| **Active phase** | **OSS only** (`@polyscribe/core` + `@polyscribe/cli`) |
| Commercial shape (long-term) | **Hybrid** (OSS MIT + invite SaaS + self-host) |
| Forge support MVP | GitHub only |
| Changelog style | Keep a Changelog |
| Default tone | `developer-friendly` |
| Auto-publish | Off |
| Approver | Required for org SaaS installs |
| Publish vehicles | GitHub Release + changelog PR |
| Language | English only |
| Monorepo | Path roots supported; auto-detect `packages/*`, `apps/*`, workspace fields |
| Diff storage | 30-day raw patch retention |
| Public draft links | Not in MVP |
| Stack | TS, Next.js, Postgres, Inngest, Zod, Sentry |
| Package manager | pnpm + Turborepo |
| License | MIT |

---

## 24. Appendix A — Example `.polyscribe.yml`

```yaml
changelogPath: CHANGELOG.md
tone: developer-friendly
requireApprover: true
autoPublish: false
includeUnreleased: false
publishTargets:
  - github-release
  - changelog-pr
monorepoRoots:
  - packages/*
ignoreGlobs:
  - "**/package-lock.json"
  - "**/pnpm-lock.yaml"
  - "**/dist/**"
  - "**/generated/**"
maxDiffBytesPerFile: 20000
maxTotalDiffBytes: 400000
```

## 25. Appendix B — Example draft (illustrative)

```markdown
## Summary
This release adds first-class webhook retries and fixes a pagination bug in the installations API.

## Features
- **Webhook retries** — failed deliveries retry with exponential backoff (@alice, #128)
- **Doctor command** — `polyscribe doctor` checks auth and LLM connectivity (@bob, #134)

## Fixes
- Installations list no longer drops page 2 results (#131)

## Migration Guide
Set `POLYSCRIBE_WEBHOOK_MAX_RETRIES` (default 5) if you self-host and need stricter limits.

## Contributors
Thanks to @alice, @bob, and @carol.
```

## 26. Appendix C — Glossary

| Term | Meaning |
|------|---------|
| Draft | Unpublished AI-generated release note candidate |
| Evidence | Source PRs/commits/diffs backing a claim |
| Installation | GitHub App install binding to account/org |
| Hybrid | OSS + SaaS + self-host distribution |
| Keep a Changelog | Community changelog format standard |

---

*End of SPEC — implement only after this document is accepted or explicitly amended.*
