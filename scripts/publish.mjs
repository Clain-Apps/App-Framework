import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const scope = readJson("framework.scope.json");
if (scope.scopeConfirmed !== true) {
  console.log("Skipping publish: npm scope is not confirmed (framework.scope.json scopeConfirmed is false).");
  process.exit(0);
}

const changeset = readJson(".changeset/config.json");
if (changeset.access !== "public") {
  console.error('Changesets access must be "public" before publishing scoped packages.');
  process.exit(1);
}

for (const packageDir of ["packages/config", "packages/dev-tools", "packages/ui"]) {
  const manifest = readJson(path.join(packageDir, "package.json"));
  if (manifest.private === true) {
    console.error(`${String(manifest.name)} is still private. Set private to false before publishing.`);
    process.exit(1);
  }
}

const publish = spawnSync("pnpm", ["exec", "changeset", "publish"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(publish.status ?? 1);

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`Could not read ${relativePath}: ${message}`);
    process.exit(1);
  }
}
