import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import {
  checkTagExists,
  createGitHubRelease,
  detectRemoteRepo,
  findReleaseByTag,
  updateGitHubRelease,
} from "@polyscribe/core";
import { EXIT_CONFIG, EXIT_GIT } from "../util/exit-codes.js";

export interface PublishCommandOptions {
  version?: string;
  notes?: string;
  title?: string;
  draft?: boolean;
  prerelease?: boolean;
  update?: boolean;
}

export function registerPublishCommand(program: Command): void {
  program
    .command("publish")
    .description("Create or update a GitHub Release for an existing tag")
    .requiredOption("--version <tag>", "tag name, e.g. v1.0.0")
    .option(
      "--notes <file>",
      "release notes markdown file (default: RELEASE.md)",
    )
    .option("--title <title>", "release title (default: version)")
    .option("--draft", "create as draft release")
    .option("--prerelease", "mark as prerelease")
    .option("--update", "update existing release instead of failing")
    .action(async (options: PublishCommandOptions) => {
      const cwd = process.cwd();
      const token = process.env.GITHUB_TOKEN;

      if (!token) {
        console.error(pc.red("GITHUB_TOKEN is required for publish"));
        process.exit(EXIT_CONFIG);
      }

      const remote = await detectRemoteRepo(cwd);
      if (!remote) {
        console.error(pc.red("Could not detect git remote origin"));
        process.exit(EXIT_CONFIG);
      }

      if (remote.host !== "github.com") {
        console.error(
          pc.red(`Publish only supports github.com remotes (found ${remote.host})`),
        );
        process.exit(EXIT_CONFIG);
      }

      const notesFile = options.notes ?? "RELEASE.md";
      const notesPath = resolve(cwd, notesFile);
      if (!existsSync(notesPath)) {
        console.error(
          pc.red(
            `Release notes file not found: ${notesFile}. Run: polyscribe draft --output RELEASE.md`,
          ),
        );
        process.exit(EXIT_CONFIG);
      }

      const body = readFileSync(notesPath, "utf8");
      const tag = options.version!;
      const title = options.title ?? tag;

      const tagPresent = await checkTagExists(token, remote.owner, remote.repo, tag);
      if (!tagPresent) {
        console.error(
          pc.yellow(
            `Tag ${tag} does not exist on ${remote.owner}/${remote.repo}. Create the tag first, then publish.`,
          ),
        );
        process.exit(EXIT_GIT);
      }

      const existing = await findReleaseByTag(
        token,
        remote.owner,
        remote.repo,
        tag,
      );

      if (existing && !options.update) {
        console.error(
          pc.red(
            `Release already exists for ${tag}. Use --update to update it.`,
          ),
        );
        process.exit(EXIT_CONFIG);
      }

      const releaseOptions = {
        token,
        owner: remote.owner,
        repo: remote.repo,
        tag,
        title,
        body,
        draft: options.draft,
        prerelease: options.prerelease,
      };

      const result = existing
        ? await updateGitHubRelease({
            ...releaseOptions,
            releaseId: existing.id,
          })
        : await createGitHubRelease(releaseOptions);

      const action = result.created ? "Created" : "Updated";
      console.log(pc.green(`${action} release: ${result.htmlUrl}`));
    });
}
