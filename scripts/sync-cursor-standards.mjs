import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = readTarget(process.argv.slice(2));

if (path.resolve(target) === root) {
  console.error("Refusing to sync standards into the framework repository.");
  process.exit(1);
}

const versionFile = JSON.parse(readFileSync(path.join(root, "standards/cursor/version.json"), "utf8"));
if (typeof versionFile.version !== "string" || !/^\d+\.\d+\.\d+$/.test(versionFile.version)) {
  console.error("standards/cursor/version.json must contain a numeric version.");
  process.exit(1);
}

const sourceDir = path.join(root, "standards/cursor/rules");
const sourceFiles = readdirSync(sourceDir)
  .filter((name) => name.endsWith(".mdc"))
  .sort();
if (sourceFiles.length === 0) {
  console.error("No standards rules to copy.");
  process.exit(1);
}

const destDir = path.join(target, ".cursor/rules/framework");
mkdirSync(destDir, { recursive: true });
for (const name of sourceFiles) {
  copyFileSync(path.join(sourceDir, name), path.join(destDir, name));
}
for (const name of readdirSync(destDir)) {
  const absolute = path.join(destDir, name);
  if (!sourceFiles.includes(name) && statSync(absolute).isFile()) rmSync(absolute);
}

const pin = {
  version: versionFile.version,
  source: "standards/cursor/rules",
  commit: gitCommit(),
};
writeFileSync(path.join(target, ".cursor/framework-standards.json"), `${JSON.stringify(pin, null, 2)}\n`);

function readTarget(args) {
  const index = args.indexOf("--target");
  const value = index === -1 ? undefined : args[index + 1];
  if (value === undefined || value.startsWith("-")) {
    console.error("Usage: node scripts/sync-cursor-standards.mjs --target <directory>");
    process.exit(1);
  }
  return path.resolve(value);
}

function gitCommit() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  const commit = (result.stdout ?? "").trim();
  if (result.status !== 0 || !/^[0-9a-f]{40}$/.test(commit)) {
    console.error("Could not read the framework commit.");
    process.exit(1);
  }
  return commit;
}
