# PolyScribe 📝

<p align="center">
  <a href="https://github.com/LatticeAG/PolyScribe/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/LatticeAG/PolyScribe?style=for-the-badge" alt="License" />
  </a>
  <a href="https://github.com/LatticeAG/PolyScribe">
    <img src="https://img.shields.io/badge/TypeScript-5.7%2B-blue?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  </a>
  <a href="https://github.com/LatticeAG/PolyScribe/stargazers">
    <img src="https://img.shields.io/github/stars/LatticeAG/PolyScribe?style=for-the-badge" alt="GitHub stars" />
  </a>
  <a href="https://github.com/LatticeAG/PolyScribe/issues">
    <img src="https://img.shields.io/github/issues/LatticeAG/PolyScribe?style=for-the-badge" alt="GitHub issues" />
  </a>
  <a href="https://www.npmjs.com/package/@polyscribe/cli">
    <img src="https://img.shields.io/npm/v/@polyscribe/cli?style=for-the-badge" alt="npm" />
  </a>
  <a href="https://github.com/LatticeAG/PolyScribe/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/LatticeAG/PolyScribe/ci.yml?style=for-the-badge" alt="CI" />
  </a>
</p>

<p align="center">
  <b>GitHub-native release editor for AI-native teams.</b><br/>
  Ingests commits. Drafts release notes. Publishes with confidence.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#why-polyscribe">Why PolyScribe</a> ·
  <a href="#how-it-works">How It Works</a> ·
  <a href="#features">Features</a> ·
  <a href="#commands">Commands</a> ·
  <a href="#packages">Packages</a>
</p>

---

PolyScribe ingests commits, PRs, and diffs for a ref range, drafts polished release notes and changelog sections, and supports human approve-to-publish. Fully OSS-first -- `@polyscribe/core` and `@polyscribe/cli` are MIT-licensed and work offline with your own LLM key.

Built for engineering teams who want release notes that read like they were hand-crafted, without the manual triage of every merged PR.

## Why PolyScribe

- **Stop writing release notes by hand** - PolyScribe reads your actual git history (commits, PRs, diffs) and drafts structured release notes organized by contribution type.
- **Human-in-the-loop publishing** - draft, review, edit, then publish. PolyScribe handles the grunt work; you make the call on what ships.
- **GitHub-native, offline-capable** - works with any git repository. No vendor lock-in. Use your own LLM key or a local model.
- **Two output formats** - polished release notes for your users (`--output RELEASE.md`) and structured changelog sections for your repo (`--write`).
- **Tone control** - `--tone technical` for developer-facing releases, `--tone marketing` for user-facing announcements. Same sources, different voice.

### How PolyScribe is different

- **Ingests the raw source of truth** - commits, PRs, and diffs, not an LLM's guess at "what changed." PolyScribe builds its draft from what actually landed in the repo.
- **PR metadata enrichment** - when a `GITHUB_TOKEN` is provided, PolyScribe fetches PR titles, descriptions, labels, and review comments to produce richer, more accurate notes.
- **Not a one-shot AI generator** - PolyScribe supports a full draft-review-publish workflow with `--dry-run` previews and `--output` for human editing before publishing.

## Quick Start

### Install

```bash
npm install -g @polyscribe/cli
# or
npx @polyscribe/cli --help
```

### One-time setup

```bash
polyscribe config init
export OPENAI_API_KEY=sk-...          # or ANTHROPIC_API_KEY
export GITHUB_TOKEN=ghp_...           # optional -- enriches with PR metadata
```

### Preflight

```bash
polyscribe doctor
polyscribe validate-config
```

### Draft release notes

```bash
polyscribe draft --from v0.1.0 --to HEAD
polyscribe draft --from v0.1.0 --to HEAD --output RELEASE.md
polyscribe draft --tone technical --json --output draft.json
```

### Update changelog

```bash
polyscribe changelog --from v0.1.0 --to HEAD
polyscribe changelog --version 0.2.0 --write
polyscribe changelog --version 0.2.0 --dry-run
polyscribe changelog --version 0.2.0 --write --notes RELEASE.md
```

### Publish to GitHub

```bash
polyscribe publish --version v0.2.0 --notes RELEASE.md
polyscribe publish --version v0.2.0 --notes RELEASE.md --update
```

## How It Works

```mermaid
flowchart LR
  A[Git Range\nv0.1.0..HEAD] --> B[PolyScribe Ingest]
  B --> C[Diff Analysis]
  B --> D[PR Enrichment\n(with GITHUB_TOKEN)]
  C --> E[Commit Categorization]
  D --> E
  E --> F[LLM Drafting]
  F --> G[Release Notes\nor Changelog]
  G --> H{Human Review}
  H -->|Approve| I[GitHub Release\nPublish]
  H -->|Edit| G
```

## Features

### Core

| Feature | Description |
|---------|------------|
| **Commit & PR ingestion** | Parses commits, diffs, and PR metadata for a ref range. No manual triage. |
| **Structured draft generation** | Organized by contribution type (features, fixes, breaking changes, chores). |
| **Changelog management** | Write, preview, or update `CHANGELOG.md` with formatted sections. |
| **GitHub Release publishing** | Create and update GitHub Releases with release notes. |
| **Tone control** | `--tone technical` or `--tone marketing` adjusts voice for your audience. |
| **Dry-run everywhere** | Every destructive command supports `--dry-run` for CI-safe previews. |

### Advanced

| Feature | Description |
|---------|------------|
| **Multiple LLM providers** | OpenAI or Anthropic. Configure via `POLYSCRIBE_LLM_PROVIDER`. |
| **JSON output** | `--json` flag exports structured data for CI pipelines and custom tooling. |
| **Source debugging** | `polyscribe sources` lists every commit and PR in the range with raw metadata. |
| **Offline-first** | Core parsing and drafting works with local LLMs. No cloud dependency. |
| **Config persistence** | `.polyscribe.yml` stores preferences per-repository. |

## Commands

| Command | Description |
|---------|-------------|
| `polyscribe config init` | Create `.polyscribe.yml` in current directory |
| `polyscribe doctor` | Validate API keys, git repo, and config |
| `polyscribe validate-config` | Check `.polyscribe.yml` schema |
| `polyscribe draft` | Draft release notes from a ref range |
| `polyscribe changelog` | Update or preview `CHANGELOG.md` |
| `polyscribe sources` | Debug raw commit and PR sources |
| `polyscribe publish` | Create or update a GitHub Release |

## Packages

| Package | Description |
|---------|-------------|
| [`@polyscribe/core`](./packages/core) | Core library -- parsing, drafting, and release logic |
| [`@polyscribe/cli`](./packages/cli) | Command-line interface (`polyscribe`) |

Published packages include a `prepublishOnly` script that runs `pnpm build` before npm publish.

## Documentation

- [CLI reference](./docs/cli.md) -- all commands, options, and exit codes
- [Configuration](./docs/configuration.md) -- `.polyscribe.yml` schema
- [Self-hosting](./docs/self-hosting.md) -- OSS CLI setup; server coming later
- [SPEC](./SPEC.md) -- product and implementation specification

## Development

Requires **Node.js 22+** and **pnpm 10+**.

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

CI runs the same checks on push and pull requests to `main` and `cursor/*`.

## Known Issues

- **Large ref ranges** - Drafting release notes for 500+ commits can take 30-60s depending on LLM provider. Use `--json` for structured output in CI pipelines.
- **GITHUB_TOKEN required for PR enrichment** - Without a token, PolyScribe falls back to commit messages only. PR titles and labels will be absent from the draft.
- **Changelog merge conflicts** - `--write` modifies `CHANGELOG.md` in place. If multiple branches write concurrently, standard git merge conflict resolution applies.

## License

MIT -- see [LICENSE](./LICENSE). Copyright &copy; 2026 LatticeAG.
