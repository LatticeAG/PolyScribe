import { Octokit } from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import type { RemoteRepo } from "../types.js";
import { tryGit } from "../git/exec.js";

const OctokitWithPlugins = Octokit.plugin(retry, throttling) as typeof Octokit;

export function parseRemoteUrl(url: string): RemoteRepo | null {
  const sshMatch = url.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return {
      host: sshMatch[1]!,
      owner: sshMatch[2]!,
      repo: sshMatch[3]!.replace(/\.git$/, ""),
    };
  }

  const httpsMatch = url.match(/^https?:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    return {
      host: httpsMatch[1]!,
      owner: httpsMatch[2]!,
      repo: httpsMatch[3]!.replace(/\.git$/, ""),
    };
  }

  return null;
}

export async function detectRemoteRepo(cwd: string): Promise<RemoteRepo | null> {
  const result = await tryGit(cwd, ["remote", "get-url", "origin"]);
  if (!result.ok) return null;
  return parseRemoteUrl(result.stdout.trim());
}

export async function getCommitDate(
  cwd: string,
  sha: string,
): Promise<string | null> {
  const result = await tryGit(cwd, ["show", "-s", "--format=%aI", sha]);
  return result.ok ? result.stdout.trim() : null;
}

export function createOctokit(token?: string): Octokit | null {
  if (!token) return null;

  return new OctokitWithPlugins({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(
          `Rate limit hit for ${options.method} ${options.url}; retrying after ${retryAfter}s`,
        );
        return retryCount < 2;
      },
      onSecondaryRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(
          `Secondary rate limit for ${options.method} ${options.url}; retrying after ${retryAfter}s`,
        );
        return retryCount < 2;
      },
    },
    retry: {
      doNotRetry: [400, 401, 404, 422],
    },
  });
}
