import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = path.join(root, ".github", "workflows", "deploy.yml");

const procedure = [
  "deploy-v1 is the production pin for .github/workflows/deploy.yml.",
  "This script does not create or move a tag.",
  "Create the tag only from a commit on the default branch that already contains that file:",
  "  git fetch origin main",
  "  git rev-parse origin/main:.github/workflows/deploy.yml",
  "  git tag -a deploy-v1 origin/main -m \"Application deployment workflow deploy-v1\"",
  "  git push origin deploy-v1",
  "Do not move the frozen tag deploy-static-v1.",
  "Until deploy-v1 exists on Clain-Apps/App-Framework, production callers cannot use that ref.",
].join("\n");

if (!existsSync(workflow)) {
  console.error("Missing .github/workflows/deploy.yml. Refusing to describe a deploy-v1 tag.");
  process.exit(1);
}

console.log(procedure);
