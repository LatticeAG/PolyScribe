export { git, tryGit } from "../git/exec.js";
export { resolveRef, getLatestTag, resolveRange } from "../git/refs.js";
export { getCommitsInRange } from "../git/log.js";
export { getFileChanges } from "../git/diff.js";

export {
  createOctokit,
  detectRemoteRepo,
  getCommitDate,
  parseRemoteUrl,
} from "../github/client.js";
export { fetchMergedPrsInRange, mapPrToSourceItem } from "../github/prs.js";
export {
  checkTagExists,
  createGitHubRelease,
  findReleaseByTag,
  getReleaseByTag,
  tagExists,
  updateGitHubRelease,
} from "../github/releases.js";

export { applyIgnoreGlobs, shouldIgnorePath } from "../ingest/filter.js";
export { collectSources } from "../ingest/collect.js";
