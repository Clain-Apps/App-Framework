import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function isDirectExecution(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (entry === undefined || entry.length === 0) return false;

  let entryPath: string;
  let modulePath: string;
  try {
    entryPath = realpathSync(entry);
    modulePath = realpathSync(fileURLToPath(moduleUrl));
  } catch (error) {
    if (path.basename(entry) !== path.basename(fileURLToPath(moduleUrl))) return false;
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`framework could not resolve its entry point (${entry}): ${message}`);
    process.exit(1);
  }

  if (process.platform === "win32") return entryPath.toLowerCase() === modulePath.toLowerCase();
  return entryPath === modulePath;
}
