import {
  type Audience,
  type AudienceEdition,
  type AudienceEditionBlock,
  type AudienceProfile,
  type CanonicalClaim,
  type ChangeCategory,
  type ChangeUnit,
  type ClaimKind,
  type InclusionDisposition,
} from "./domain.js";

export const BUILT_IN_AUDIENCE_PROFILES: Record<
  "developer" | "user" | "executive",
  AudienceProfile
> = {
  developer: {
    id: "developer",
    defaultVisibility: "workspace",
    allowedVisibilities: ["public", "workspace", "restricted"],
    includedDispositions: ["must-announce", "announce", "developer-note"],
    preferredClaimKinds: [
      "what",
      "why",
      "impact",
      "availability",
      "action",
      "migration",
      "deprecation",
      "security-note",
      "limitation",
      "metric",
    ],
    maximumDetail: "detailed",
  },
  user: {
    id: "user",
    defaultVisibility: "public",
    allowedVisibilities: ["public"],
    includedDispositions: ["must-announce", "announce"],
    preferredClaimKinds: [
      "what",
      "impact",
      "availability",
      "action",
      "migration",
      "security-note",
      "limitation",
    ],
    maximumDetail: "standard",
  },
  executive: {
    id: "executive",
    defaultVisibility: "workspace",
    allowedVisibilities: ["public", "workspace", "restricted"],
    includedDispositions: ["must-announce", "announce"],
    preferredClaimKinds: [
      "what",
      "why",
      "impact",
      "availability",
      "action",
      "migration",
      "security-note",
      "metric",
    ],
    maximumDetail: "compact",
  },
};

export interface CreateAudienceEditionInput {
  releaseId: string;
  baseChangeSetRevision: string;
  audience: Audience;
  changes: ChangeUnit[];
  profile?: AudienceProfile;
  editionId?: string;
  now?: () => Date;
}

export interface CreateAudienceEditionsInput
  extends Omit<CreateAudienceEditionInput, "audience" | "profile" | "editionId"> {
  audiences: Array<{ audience: Audience; profile?: AudienceProfile; editionId?: string }>;
}

export type AudienceEditionRevision = Omit<
  Partial<AudienceEdition>,
  "id" | "releaseId" | "audience" | "baseChangeSetRevision" | "revision" | "status" | "approval" | "createdAt" | "updatedAt"
> & {
  baseChangeSetRevision?: string;
};

export function getAudienceProfile(
  audience: Audience,
  customProfile?: AudienceProfile,
): AudienceProfile {
  if (customProfile) return customProfile;
  switch (audience) {
    case "developer":
      return BUILT_IN_AUDIENCE_PROFILES.developer;
    case "user":
      return BUILT_IN_AUDIENCE_PROFILES.user;
    case "executive":
      return BUILT_IN_AUDIENCE_PROFILES.executive;
  }
  throw new Error(`A custom audience requires an explicit profile: ${audience}`);
}

function sectionForCategory(category: ChangeCategory, audience: Audience): string {
  if (audience === "executive") {
    if (category === "security" || category === "deprecated" || category === "removed") {
      return "Risk and action";
    }
    return "Highlights";
  }
  if (audience === "user") {
    switch (category) {
      case "added":
        return "What's new";
      case "fixed":
      case "security":
        return "Improvements and fixes";
      case "deprecated":
      case "removed":
        return "Action required";
      default:
        return "Updates";
    }
  }
  switch (category) {
    case "added":
      return "Added";
    case "changed":
      return "Changed";
    case "fixed":
      return "Fixed";
    case "deprecated":
      return "Deprecated";
    case "removed":
      return "Removed";
    case "security":
      return "Security";
    case "performance":
      return "Performance";
    case "documentation":
      return "Documentation";
    case "operations":
      return "Operations";
    case "maintenance":
      return "Maintenance";
  }
}

function selectClaims(
  change: ChangeUnit,
  profile: AudienceProfile,
): CanonicalClaim[] {
  const visible = change.claims.filter(
    (claim) =>
      profile.allowedVisibilities.includes(claim.visibility),
  );
  const preferred = visible.filter((claim) => profile.preferredClaimKinds.includes(claim.kind));
  const selected = preferred.length > 0 ? [...preferred] : [...visible];

  // Required migration/action guidance may never be shortened away by a
  // compact or custom audience profile when its visibility permits rendering.
  if (change.migration.state === "required") {
    for (const claim of visible) {
      if (
        (claim.kind === "migration" || claim.kind === "action") &&
        !selected.some((entry) => entry.id === claim.id)
      ) {
        selected.push(claim);
      }
    }
  }
  return selected;
}

function renderClaims(claims: CanonicalClaim[], maximumDetail: AudienceProfile["maximumDetail"]): string {
  const rendered = maximumDetail === "compact" ? claims.slice(0, 2) : claims;
  return rendered.map((claim) => `- ${claim.statement.trim()}`).join("\n");
}

/**
 * Deterministically projects shared canonical claims into one audience edition.
 * It never creates a new factual claim or broadens source visibility.
 */
export function createAudienceEdition(input: CreateAudienceEditionInput): AudienceEdition {
  const profile = getAudienceProfile(input.audience, input.profile);
  const groups = new Map<
    string,
    { changeIds: string[]; claimIds: string[]; markdown: string[] }
  >();

  for (const change of input.changes) {
    if (!profile.includedDispositions.includes(change.inclusion)) continue;
    const claims = selectClaims(change, profile);
    if (claims.length === 0) continue;
    const section = sectionForCategory(change.categories[0] ?? "changed", input.audience);
    const group = groups.get(section) ?? { changeIds: [], claimIds: [], markdown: [] };
    group.changeIds.push(change.id);
    group.claimIds.push(...claims.map((claim) => claim.id));
    const markdown = renderClaims(claims, profile.maximumDetail);
    if (markdown) group.markdown.push(markdown);
    groups.set(section, group);
  }

  const blocks: AudienceEditionBlock[] = [...groups.entries()].map(([section, group], index) => ({
    id: `blk_${input.releaseId}_${input.audience}_${index + 1}`,
    section,
    changeIds: group.changeIds,
    claimIds: group.claimIds,
    markdown: group.markdown.join("\n"),
  }));
  const now = input.now?.() ?? new Date();

  return {
    id: input.editionId ?? `ed_${input.releaseId}_${input.audience}`,
    releaseId: input.releaseId,
    audience: input.audience,
    baseChangeSetRevision: input.baseChangeSetRevision,
    revision: 1,
    status: "draft",
    visibility: profile.defaultVisibility,
    blocks,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/** Creates linked developer, user, executive, or custom editions from one change set. */
export function createAudienceEditions(
  input: CreateAudienceEditionsInput,
): AudienceEdition[] {
  return input.audiences.map(({ audience, profile, editionId }) =>
    createAudienceEdition({
      ...input,
      audience,
      profile,
      editionId,
    }),
  );
}

/**
 * Advances an audience revision after an editorial change. Approval is always
 * invalidated because it is bound to the exact edition revision.
 */
export function reviseAudienceEdition(
  previous: AudienceEdition,
  revision: AudienceEditionRevision,
  now: () => Date = () => new Date(),
): AudienceEdition {
  return {
    ...previous,
    ...revision,
    revision: previous.revision + 1,
    status: "draft",
    approval: undefined,
    updatedAt: now().toISOString(),
  };
}

export function renderAudienceEditionMarkdown(edition: AudienceEdition): string {
  return edition.blocks
    .filter((block) => block.markdown.trim().length > 0)
    .map((block) => `## ${block.section}\n${block.markdown.trim()}`)
    .join("\n\n")
    .trim();
}

export function editionClaimKinds(
  edition: AudienceEdition,
  changes: ChangeUnit[],
): ClaimKind[] {
  const claimIds = new Set(edition.blocks.flatMap((block) => block.claimIds));
  return changes
    .flatMap((change) => change.claims)
    .filter((claim) => claimIds.has(claim.id))
    .map((claim) => claim.kind);
}

export function editionIncludesDisposition(
  profile: AudienceProfile,
  inclusion: InclusionDisposition,
): boolean {
  return profile.includedDispositions.includes(inclusion);
}
