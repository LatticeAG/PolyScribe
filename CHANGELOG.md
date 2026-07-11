# Changelog

All notable changes to PolyScribe will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
