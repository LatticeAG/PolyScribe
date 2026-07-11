#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(join(packageRoot, "../package.json"), "utf8"),
) as { version: string };

console.log(`polyscribe v${version}`);
