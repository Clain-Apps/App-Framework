// Compatibility shim. The copy lives in packages/dev-tools/src/standards.ts.
// Prefer: node packages/dev-tools/dist/framework-cli.js adopt --cwd <application>
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = readTarget(process.argv.slice(2));
const built = path.join(root, "packages/dev-tools/dist/standards.js");
if (!existsSync(built)) {
  console.error("Build @app-framework/dev-tools first (pnpm build), then rerun this script.");
  process.exit(1);
}

const { syncCursorStandards } = await import(pathToFileURL(built).href);
try {
  syncCursorStandards(target);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not sync Cursor standards.");
  process.exit(1);
}

function readTarget(args) {
  const index = args.indexOf("--target");
  const value = index === -1 ? undefined : args[index + 1];
  if (value === undefined || value.startsWith("-")) {
    console.error("Usage: node scripts/sync-cursor-standards.mjs --target <directory>");
    process.exit(1);
  }
  return path.resolve(value);
}
