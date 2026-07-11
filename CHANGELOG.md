# Changelog

All notable changes to PolyScribe will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `polyscribe changelog --unreleased` to update only the `[Unreleased]` section
- Citation validation retry: one automatic LLM repair pass before failing
- `polyscribe publish` defaults `--notes` to `RELEASE.md`
- `polyscribe sources` command with `--json`, `--pretty`, and `--count`
- `polyscribe changelog --dry-run`, `--date`, and `--notes` (skip LLM)
- `polyscribe draft --sources-only` / `--no-llm` for ingestion-only output
- GitHub Releases API via `polyscribe publish` (`--update`, `--draft`, `--prerelease`)
- Semver heuristics with `{ level, reasons }` and conventional commit detection
- Linked issue parsing from PR bodies (`Fixes #123`, etc.)
- Octokit retry/throttling for GitHub API rate limits
- Git integration tests, citation tests, and release API tests (65 total)
- CI workflow, docs (`docs/cli.md`, `docs/configuration.md`), and npm publish metadata

## [0.1.0] - 2026-07-11

### Added

- Initial open-source release of `@polyscribe/core` and `@polyscribe/cli`
- Git-native source ingestion: commits, PR metadata (with `GITHUB_TOKEN`), and diffs
- AI-powered `draft` command with structured release note sections and semver heuristics
- `changelog` command with Keep a Changelog merge via `--write`
- Configuration via `.polyscribe.yml` and `.github/polyscribe.yml` (deep-merged)
- `config init`, `validate-config`, and `doctor` preflight commands
- OpenAI and Anthropic LLM providers with configurable models
- Secret redaction, diff size limits, and citation validation in the draft pipeline
- Monorepo scaffold (pnpm + Turborepo), unit tests, and GitHub Actions CI

[Unreleased]: https://github.com/LatticeAG/PolyScribe/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/LatticeAG/PolyScribe/releases/tag/v0.1.0
