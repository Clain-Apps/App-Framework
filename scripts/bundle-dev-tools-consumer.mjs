import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const built = pathToFileURL(path.join(root, "packages/dev-tools/dist/capabilities.js")).href;
const { loadCapabilityManifest } = await import(built);
loadCapabilityManifest();

const commitResult = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
const commit = (commitResult.stdout ?? "").trim();
if (commitResult.status !== 0 || !/^[0-9a-f]{40}$/.test(commit)) {
  console.error("Could not read the framework commit.");
  process.exit(1);
}

const destination = path.join(root, "packages/dev-tools/dist/consumer");
rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
cpSync(path.join(root, "capabilities/manifest.json"), path.join(destination, "manifest.json"));
cpSync(path.join(root, "standards/cursor"), path.join(destination, "standards/cursor"), { recursive: true });
writeFileSync(path.join(destination, "source.json"), `${JSON.stringify({ commit }, null, 2)}\n`);
