# Self-hosting

The PolyScribe **OSS CLI is self-contained**. Everything you need to draft and write changelogs runs locally with:

- A git repository
- An LLM API key (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`)
- Optionally `GITHUB_TOKEN` for richer PR metadata

There is no PolyScribe server to deploy in v0.1.0. Install from npm and run commands in your repo:

```bash
npm install -g @polyscribe/cli
# or
npx @polyscribe/cli doctor
```

## What runs where

| Component | v0.1.0 | Notes |
|-----------|--------|-------|
| `@polyscribe/cli` | ✅ Available | `polyscribe` binary |
| `@polyscribe/core` | ✅ Available | Library for custom integrations |
| Hosted SaaS | 🔜 Later | Approval workflows, team roles, managed LLM routing |
| Self-host server | 🔜 Later | Same core, HTTP API + optional UI |

## Recommended setup

1. Add `.polyscribe.yml` (or symlink `.github/polyscribe.yml` → root config).
2. Store `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` and `GITHUB_TOKEN` in your CI secrets or local shell profile — never commit them.
3. Run `polyscribe doctor` in CI or locally before release automation.

Example GitHub Actions step (after secrets are configured):

```yaml
- run: npx @polyscribe/cli draft --from ${{ github.event.release.tag_name }} --to HEAD --output RELEASE.md
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Future self-host server

A dedicated PolyScribe server (REST API, webhooks, approval UI) is planned on top of `@polyscribe/core`. The OSS CLI will remain the offline-first path; the server will be optional for teams that want centralized review without SaaS.

Track progress in [SPEC.md](../SPEC.md) and [CHANGELOG.md](../CHANGELOG.md).

See also: [CLI reference](./cli.md) · [configuration](./configuration.md)
