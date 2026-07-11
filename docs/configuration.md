# Configuration reference

PolyScribe reads YAML configuration from your repository. Two locations are supported and **deep-merged** (later files override earlier ones):

1. `.github/polyscribe.yml` — org/repo defaults (loaded first)
2. `.polyscribe.yml` — repository overrides (loaded second, wins on conflicts)

If no file exists, sensible defaults apply. Run `polyscribe config init` to scaffold a starter file.

Validate any file with:

```bash
polyscribe validate-config
```

## Full schema

```yaml
# Path to Keep a Changelog file (relative to repo root)
changelogPath: CHANGELOG.md

# Editorial tone for generated release notes
# Values: technical | developer-friendly | executive | community
tone: developer-friendly

# Glob patterns excluded from diff ingestion
ignoreGlobs:
  - "**/package-lock.json"
  - "**/pnpm-lock.yaml"
  - "**/yarn.lock"
  - "**/bun.lockb"
  - "**/dist/**"
  - "**/generated/**"

# Monorepo package roots for scoped ingestion (future use)
monorepoRoots: []

# SaaS workflow flags (ignored by OSS CLI in v0.1.0)
requireApprover: true
autoPublish: false
includeUnreleased: false

# Planned publish destinations (Phase 1b+)
publishTargets:
  - github-release
  - changelog-pr

# Include commit authors not linked to a PR in the contributors section
includeCommittersWithoutPr: true

# Cap diff size per file and total across the range
maxDiffBytesPerFile: 20000
maxTotalDiffBytes: 400000

# Section ordering in rendered output
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

# LLM provider (CLI / self-host only)
llm:
  provider: openai          # openai | anthropic | openai-compatible
  model: gpt-4.1
```

## Field reference

### `changelogPath`

| Type | Default |
|------|---------|
| string | `CHANGELOG.md` |

Relative path to the Keep a Changelog file updated by `polyscribe changelog --write`.

### `tone`

| Type | Default |
|------|---------|
| enum | `developer-friendly` |

Controls prompt style for `draft` and `changelog`. Can be overridden per invocation with `polyscribe draft --tone`.

| Value | Style |
|-------|-------|
| `developer-friendly` | Clear, concrete; explains user impact |
| `technical` | Precise API names, endpoints, config keys |
| `executive` | Short outcome-focused summary |
| `community` | Warm tone; emphasizes contributors |

### `ignoreGlobs`

| Type | Default |
|------|---------|
| string[] | lockfiles, `dist/**`, `generated/**` |

Minimatch patterns. Matching files are omitted from diff ingestion.

### `monorepoRoots`

| Type | Default |
|------|---------|
| string[] | `[]` |

Reserved for monorepo-aware ingestion (e.g. `packages/*`). Empty means whole-repo scope.

### `requireApprover`

| Type | Default |
|------|---------|
| boolean | `true` |

Used by hosted PolyScribe for approval workflows. Ignored by the OSS CLI in v0.1.0.

### `autoPublish`

| Type | Default |
|------|---------|
| boolean | `false` |

When true in hosted mode, approved drafts publish automatically. Ignored by OSS CLI.

### `includeUnreleased`

| Type | Default |
|------|---------|
| boolean | `false` |

Include unreleased changelog sections when merging (hosted workflows).

### `publishTargets`

| Type | Default |
|------|---------|
| enum[] | `github-release`, `changelog-pr` |

Destinations for `polyscribe publish` (Phase 1b). OSS v0.1.0 does not publish yet.

### `includeCommittersWithoutPr`

| Type | Default |
|------|---------|
| boolean | `true` |

When true, commit authors without an associated PR appear in the Contributors section.

### `maxDiffBytesPerFile` / `maxTotalDiffBytes`

| Field | Type | Default |
|-------|------|---------|
| `maxDiffBytesPerFile` | positive integer | `20000` |
| `maxTotalDiffBytes` | positive integer | `400000` |

Guardrails to keep LLM context bounded. Large diffs are truncated.

### `sections.order`

| Type | Default |
|------|---------|
| enum[] | see schema above |

Order of sections in rendered markdown and Keep a Changelog output. Empty sections are omitted except Summary and Contributors when sources exist.

### `llm`

Optional block for CLI and self-hosted deployments.

| Field | Type | Description |
|-------|------|-------------|
| `provider` | `openai` \| `anthropic` \| `openai-compatible` | LLM backend |
| `model` | string | Model ID (defaults: `gpt-4.1` for OpenAI, `claude-sonnet-4-20250514` for Anthropic) |

Credentials are **not** stored in config. Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in the environment.

## Example: minimal config

```yaml
changelogPath: CHANGELOG.md
tone: technical
llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
```

## Example: split org + repo config

**.github/polyscribe.yml** (shared defaults):

```yaml
tone: developer-friendly
ignoreGlobs:
  - "**/dist/**"
llm:
  provider: openai
  model: gpt-4.1
```

**.polyscribe.yml** (repo override):

```yaml
tone: technical
changelogPath: docs/CHANGELOG.md
```

Merged result uses `tone: technical` and inherits `ignoreGlobs` and `llm` from `.github/polyscribe.yml`.

See also: [CLI reference](./cli.md) · [self-hosting](./self-hosting.md)
