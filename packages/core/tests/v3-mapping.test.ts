import { describe, expect, it } from "vitest";
import {
  canAutoAcceptMapping,
  createMappingCandidate,
  detectMappingConflicts,
  resolveMappingCandidate,
  scoreMappingSignals,
} from "../src/v3/mapping.js";

describe("V3 mapping policy", () => {
  it("uses the strongest deterministic proof rather than summing weak heuristics", () => {
    const score = scoreMappingSignals([
      { kind: "heuristic", detail: "similar title" },
      { kind: "heuristic", detail: "same path" },
      { kind: "issue-key", detail: "API-42 in verified branch" },
    ]);

    expect(score.score).toBe(75);
    expect(score.band).toBe("medium");
  });

  it("only auto-accepts an unambiguous immutable relation", () => {
    const candidate = createMappingCandidate({
      id: "map_1",
      fromEvidenceId: "ev_pr_1",
      toEvidenceId: "ev_commit_1",
      relationType: "merged-as",
      method: "provider-direct",
      signals: [{ kind: "provider-direct" }],
    });

    expect(canAutoAcceptMapping(candidate, { componentScopeMatches: true, leadOverNextCandidate: 10 })).toBe(true);
    expect(canAutoAcceptMapping(candidate, { componentScopeMatches: true, conflictingPrimaryOwner: true })).toBe(false);
  });

  it("surfaces multiple primary owners as a conflict and retains an auditable resolution", () => {
    const one = createMappingCandidate({
      id: "map_1",
      fromEvidenceId: "ev_pr_1",
      toEvidenceId: "ev_commit_1",
      relationType: "merged-as",
      method: "provider-direct",
      signals: [{ kind: "provider-direct" }],
    });
    const two = createMappingCandidate({
      id: "map_2",
      fromEvidenceId: "ev_pr_2",
      toEvidenceId: "ev_commit_1",
      relationType: "merged-as",
      method: "exact-sha",
      signals: [{ kind: "exact-sha" }],
    });

    expect(detectMappingConflicts([one, two])).toContainEqual(
      expect.objectContaining({ type: "multiple-primary-owners", candidateIds: ["map_1", "map_2"] }),
    );
    expect(resolveMappingCandidate(one, "accepted", "Verified provider association")).toMatchObject({
      status: "accepted",
      explanation: "Verified provider association",
    });
  });
});
