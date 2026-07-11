# PolyScribe

[![CI](https://github.com/LatticeAG/PolyScribe/actions/workflows/ci.yml/badge.svg)](https://github.com/LatticeAG/PolyScribe/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![npm @polyscribe/cli](https://img.shields.io/npm/v/@polyscribe/cli.svg)](https://www.npmjs.com/package/@polyscribe/cli)

PolyScribe is a GitHub-native release editor: it ingests commits, PRs, and diffs for a ref range, drafts polished release notes and changelog sections, and supports human approve → publish.

## OSS-first

This repository is **open-source first**. `@polyscribe/core` and `@polyscribe/cli` are MIT-licensed and fully usable offline with your own LLM key or local model. Hosted SaaS and self-host options build on the same foundations.

## Quick start

### Install

```bash
# npm (after publish)
npm install -g @polyscribe/cli

# or run without installing
npx @polyscribe/cli --help
```

### One-time setup

```bash
polyscribe config init
export OPENAI_API_KEY=sk-...          # or ANTHROPIC_API_KEY
export GITHUB_TOKEN=ghp_...           # optional — enriches with PR metadata
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

### Debug sources

```bash
polyscribe sources --from v0.1.0 --to HEAD
polyscribe sources --from v0.1.0 --to HEAD --pretty
polyscribe sources --count
```

### Publish to GitHub

```bash
polyscribe publish --version v0.2.0 --notes RELEASE.md
polyscribe publish --version v0.2.0 --notes RELEASE.md --update
```

### Development (this repo)

```bash
pnpm install && pnpm build
node packages/cli/dist/index.js config --init
```

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | One of the LLM keys | OpenAI draft generation |
| `ANTHROPIC_API_KEY` | One of the LLM keys | Anthropic draft generation |
| `POLYSCRIBE_LLM_PROVIDER` | No | Force `openai` or `anthropic` |
| `GITHUB_TOKEN` | No (required for `publish`) | Enrich ingestion with PR metadata; create GitHub Releases |

## Packages

| Package | Description |
|---------|-------------|
| [`@polyscribe/core`](./packages/core) | Core library — parsing, drafting, and release logic |
| [`@polyscribe/cli`](./packages/cli) | Command-line interface (`polyscribe`) |

Published packages include a `prepublishOnly` script that runs `pnpm build` before npm publish. The root workspace package is private and is not published.

## Documentation

- [CLI reference](./docs/cli.md) — all commands, options, and exit codes
- [Configuration](./docs/configuration.md) — `.polyscribe.yml` schema
- [Self-hosting](./docs/self-hosting.md) — OSS CLI setup; server coming later
- [SPEC](./SPEC.md) — product and implementation specification

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

## License

MIT — see [LICENSE](./LICENSE).
