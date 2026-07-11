# CLI reference

PolyScribe ships as `@polyscribe/cli` with the `polyscribe` binary. Run `polyscribe --help` for a summary.

## Global options

| Option | Description |
|--------|-------------|
| `-V, --version` | Print CLI version |
| `-h, --help` | Show help |

## Environment

PolyScribe reads credentials from the environment. See [configuration](./configuration.md) for `.polyscribe.yml` settings.

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | One of the LLM keys | OpenAI draft generation |
| `ANTHROPIC_API_KEY` | One of the LLM keys | Anthropic draft generation |
| `POLYSCRIBE_LLM_PROVIDER` | No | Force `openai` or `anthropic` |
| `GITHUB_TOKEN` | No | Enrich ingestion with PR metadata from GitHub |

## `polyscribe draft`

Generate AI release notes from git history for a ref range.

```bash
polyscribe draft [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--from <ref>` | Start ref (default: latest tag, or root commit if none) |
| `--to <ref>` | End ref (default: `HEAD`) |
| `--tone <tone>` | Override config tone: `technical`, `developer-friendly`, `executive`, `community` |
| `--output <file>` | Write output to a file |
| `--json` | Output structured draft JSON instead of markdown |

### Behavior

1. Loads `.polyscribe.yml` / `.github/polyscribe.yml` (see [configuration](./configuration.md)).
2. Resolves the git ref range.
3. Collects sources (commits, PRs, diffs) with optional GitHub enrichment.
4. Calls the configured LLM to produce structured sections and rendered markdown.

### Examples

```bash
polyscribe draft --from v0.1.0 --to HEAD
polyscribe draft --from v0.1.0 --to HEAD --output RELEASE.md
polyscribe draft --tone technical --json --output draft.json
```

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | No sources, config error, or usage error |

---

## `polyscribe changelog`

Generate a Keep a Changelog body for a ref range and optionally merge it into your changelog file.

```bash
polyscribe changelog [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--from <ref>` | Start ref |
| `--to <ref>` | End ref (default: `HEAD`) |
| `--version <version>` | Version heading (required with `--write` or `--dry-run`) |
| `--write` | Update `changelogPath` from config (default: `CHANGELOG.md`) |
| `--dry-run` | Show unified diff of changelog change without writing |
| `--date <YYYY-MM-DD>` | Override release date (default: today UTC) |
| `--notes <file>` | Use existing markdown as body (skips LLM) |

### Behavior

1. Collects sources and generates a draft (same pipeline as `draft`).
2. Renders sections in Keep a Changelog format.
3. Without `--write` or `--dry-run`, prints the body to stdout.
4. With `--write`, inserts a new `## [version] - YYYY-MM-DD` section under `## [Unreleased]`.
5. With `--dry-run`, prints a line diff of the file change without writing.
6. With `--notes`, uses an existing markdown file as the body and skips the LLM.

### Examples

```bash
polyscribe changelog --from v0.1.0 --to HEAD
polyscribe changelog --version 0.2.0 --write
polyscribe changelog --version 0.2.0 --dry-run
polyscribe changelog --version 0.2.0 --write --notes RELEASE.md
```

---

## `polyscribe sources`

Collect and print ingestion sources as JSON without calling an LLM. Useful for debugging what PolyScribe would analyze before spending API credits.

```bash
polyscribe sources [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--from <ref>` | Start ref (default: latest tag, or root commit if none) |
| `--to <ref>` | End ref (default: `HEAD`) |
| `--json` | Output `SourceItem[]` as JSON (default) |
| `--pretty` | Pretty-print JSON |
| `--count` | Print only a source count summary |

### Examples

```bash
polyscribe sources --from v0.1.0 --to HEAD
polyscribe sources --pretty
polyscribe sources --count
```

Progress messages go to stderr; JSON output goes to stdout.

---

## `polyscribe publish`

Create or update a GitHub Release for an existing git tag.

```bash
polyscribe publish --version <tag> --notes <file> [options]
```

### Options

| Option | Required | Description |
|--------|----------|-------------|
| `--version <tag>` | Yes | Tag name (e.g. `v1.0.0`) — must exist on GitHub |
| `--notes <file>` | Yes | Markdown release notes file |
| `--title <title>` | No | Release title (default: tag name) |
| `--draft` | No | Create as draft release |
| `--prerelease` | No | Mark as prerelease |
| `--update` | No | Update existing release instead of failing |

### Requirements

- `GITHUB_TOKEN` with `repo` scope
- `origin` remote pointing at `github.com`
- Tag must already exist on the remote

### Behavior

1. Detects `origin` remote and validates it is GitHub.
2. Verifies the tag exists via the GitHub API.
3. Creates a release, or updates an existing one with `--update`.

### Examples

```bash
polyscribe draft --from v0.1.0 --to HEAD --output RELEASE.md
git tag v0.2.0 && git push origin v0.2.0
polyscribe publish --version v0.2.0 --notes RELEASE.md
polyscribe publish --version v0.2.0 --notes RELEASE.md --update
```

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Config, usage, or missing token/remote/notes |
| `2` | Tag does not exist on remote |

---

## `polyscribe config`

Manage PolyScribe configuration files.

### `polyscribe config init`

Write an example `.polyscribe.yml` in the current directory.

```bash
polyscribe config init [--path <file>]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--path <file>` | `.polyscribe.yml` | Destination path |

### Example

```bash
polyscribe config init
polyscribe config init --path .github/polyscribe.yml
```

---

## `polyscribe validate-config`

Validate a config file against the PolyScribe schema.

```bash
polyscribe validate-config [path]
```

| Argument | Description |
|----------|-------------|
| `[path]` | Optional path to a config file. If omitted, searches `.polyscribe.yml` and `.github/polyscribe.yml`. |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Valid config |
| `1` | Missing or invalid config |

### Example

```bash
polyscribe validate-config
polyscribe validate-config .polyscribe.yml
```

---

## `polyscribe doctor`

Run preflight checks before drafting or publishing.

```bash
polyscribe doctor
```

### Checks

| Check | Required |
|-------|----------|
| Current directory is a git repository | Yes |
| `GITHUB_TOKEN` is set | No (warns if missing) |
| LLM API key available (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`) | Yes |
| Config file present | No (uses defaults if absent) |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | All required checks passed |
| `1` | One or more required checks failed |

### Example

```bash
polyscribe doctor
```

---

## Typical workflow

```bash
# One-time setup
polyscribe config init
export OPENAI_API_KEY=sk-...
export GITHUB_TOKEN=ghp_...   # optional

# Preflight
polyscribe doctor
polyscribe validate-config

# Draft release notes
polyscribe draft --from v0.1.0 --to HEAD --output RELEASE.md

# Update changelog
polyscribe changelog --version 0.2.0 --write

# Inspect sources (no LLM)
polyscribe sources --from v0.1.0 --to HEAD

# Publish to GitHub
polyscribe publish --version v0.2.0 --notes RELEASE.md
```

See also: [configuration](./configuration.md) · [self-hosting](./self-hosting.md)
