# PolyScribe

PolyScribe is a GitHub-native release editor: it ingests commits, PRs, and diffs for a ref range, drafts polished release notes and changelog sections, and supports human approve → publish.

## OSS-first

This repository is **open-source first**. `@polyscribe/core` and `@polyscribe/cli` are MIT-licensed and fully usable offline with your own LLM key or local model. Hosted SaaS and self-host options build on the same foundations.

## Quick start

```bash
# From this repo (development)
pnpm install && pnpm build
node packages/cli/dist/index.js config --init

# With npm (after publish)
npx @polyscribe/cli config --init
export OPENAI_API_KEY=sk-...          # or ANTHROPIC_API_KEY
export GITHUB_TOKEN=ghp_...           # optional — enriches with PR metadata

polyscribe doctor
polyscribe draft --from v0.1.0 --to HEAD --output RELEASE.md
polyscribe changelog --version 0.2.0 --write
```

## Packages

| Package | Description |
|---------|-------------|
| `@polyscribe/core` | Core library — parsing, drafting, and release logic |
| `@polyscribe/cli` | Command-line interface (`polyscribe`) |

## Development

Requires **Node.js 22+** and **pnpm**.

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

## License

MIT — see [LICENSE](./LICENSE).
