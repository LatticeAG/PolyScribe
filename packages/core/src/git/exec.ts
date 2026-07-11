import { execa } from "execa";

export async function git(
  cwd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  const result = await execa("git", args, { cwd });
  return { stdout: result.stdout, stderr: result.stderr };
}

export async function tryGit(
  cwd: string,
  args: string[],
): Promise<{ ok: true; stdout: string } | { ok: false; error: Error }> {
  try {
    const result = await git(cwd, args);
    return { ok: true, stdout: result.stdout };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
