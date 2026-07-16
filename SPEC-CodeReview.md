# SPEC-CodeReview: Code Review AI With Execution

> **Status:** Proposal
> **Type:** Feature spec

## Problem

Code review tools (CodeRabbit, Copilot Review, Diffblue) read diffs and give feedback. None actually *run the code*. They can tell you "this looks like a memory leak" but not "this branch uses 12% more memory than main."

## Relationship to PolyScribe

PolyScribe today generates release notes from commits and PRs. This extends it into active code review — same commit ingestion pipeline, different output:

| Feature | PolyScribe Today | CodeReview Addition |
|---------|-----------------|-------------------|
| Input | Git log, commits, PR metadata | Full PR diff + repo clone + test suite |
| Output | Release notes | Test results, perf diff, bug report |
| When | On release | On PR open + every push |

## Solution

A second mode for PolyScribe: automated code review with real execution.

### Mode: PR Review
When a PR is opened:
1. **Sandbox the code** — Spin up a Firecracker microVM or DO sandbox
2. **Run the existing tests** — Are they all green with the changes?
3. **Generate new test cases** — Use an LLM to create targeted tests for the diff
4. **Run both** — Existing + generated tests, measure runtime and memory
5. **Diff against base** — Before/after: test results, memory usage, API call counts
6. **Return** — Pass/fail with evidence, diff table, and recommendation

### Mode: Commit-Level Quick Check
For every push to an open PR:
- Run only the generated test cases (fast, <30s)
- Alert on: test failures, memory regressions >5%, new API endpoints introduced
- Comment on the PR with results

## Architecture

```
GitHub webhook (PR opened / push)
  ↓
PolyScribe CodeReview Worker
  ├── Clone repo at PR ref + base branch
  ├── Run existing test suite on both (sandboxed)
  ├── LLM-gen new tests from diff
  ├── Run generated tests
  ├── Measure runtime/memory diffs
  └── Report: structured JSON → PR comment
```

## Key Design Decisions

- **Firecracker microVMs** for isolation. One per review, destroyed after. <5 min lifetime typical.
- **Test generation uses the diff as context.** Not re-testing unchanged code — keeps costs low.
- **3-5 test cases per PR**, not 100s. Focus on boundary conditions and changed paths.
- **Result cache.** Identical diff + identical test suite → skip re-run (TTL: 1 hour, busted on new commits).
- **Opt-in sandbox.** Repos opt in via `.polyreview.yml` config. Default: disabled.

## Implementation Notes

- Reuses PolyScribe's GitHub webhook infrastructure
- Sandbox: `firecracker-containerd` or `fly machines` — whichever is lighter
- Test generation model: Claude 4 or GPT-4o via LexGateway
- Memory measurement: `time -v` or `perf stat` depending on language

## Success Criteria

- Catches 1 real bug in the first 20 reviews against dogfood repos
- False positive rate <10%
- Full review completes in <5 min for a typical PR (<500 lines changed)
- Zero sandbox escapes (no shell injection, no host access)
