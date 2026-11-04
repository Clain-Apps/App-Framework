import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadCapabilityManifest, readSourceCommit, type FrameworkAssets } from "./capabilities.js";

export const STANDARDS_SOURCE = "standards/cursor/rules";

export type StandardsPlan = {
  status: "write" | "unchanged";
  deletes: string[];
  sourceNames: string[];
  rulesDir: string;
  destDir: string;
  pinPath: string;
  pin: string;
};

export function planStandards(cwd: string, assets: FrameworkAssets, version: string): StandardsPlan {
  const rulesDir = path.join(assets.standardsDir, "rules");
  const sourceNames = readdirSync(rulesDir)
    .filter((name) => name.endsWith(".mdc"))
    .sort();
  if (sourceNames.length === 0) throw new Error("No standards rules to copy.");
  const destDir = path.join(cwd, ".cursor", "rules", "framework");
  const pinPath = path.join(cwd, ".cursor", "framework-standards.json");
  const pin = `${JSON.stringify({ version, source: STANDARDS_SOURCE, commit: readSourceCommit(assets) }, null, 2)}\n`;
  const deletes = existingFrameworkFiles(destDir).filter((name) => !sourceNames.includes(name));
  const rulesDiffer = sourceNames.some((name) => !sameFile(path.join(rulesDir, name), path.join(destDir, name)));
  const pinDiffers = !equivalentText(readOptional(pinPath), pin);
  return {
    status: rulesDiffer || pinDiffers || deletes.length > 0 ? "write" : "unchanged",
    deletes,
    sourceNames,
    rulesDir,
    destDir,
    pinPath,
    pin,
  };
}

export function applyStandards(plan: StandardsPlan): void {
  mkdirSync(plan.destDir, { recursive: true });
  for (const name of plan.sourceNames) {
    copyFileSync(path.join(plan.rulesDir, name), path.join(plan.destDir, name));
  }
  writeFileSync(plan.pinPath, plan.pin);
  for (const name of plan.deletes) rmSync(path.join(plan.destDir, name));
}

export function syncCursorStandards(cwd: string): StandardsPlan {
  const loaded = loadCapabilityManifest();
  if (path.resolve(cwd) === path.resolve(loaded.assets.root)) {
    throw new Error("Refusing to sync standards into the framework repository.");
  }
  const capability = loaded.manifest.capabilities.find((item) => item.id === "cursor-standards");
  if (capability === undefined) throw new Error("cursor-standards is missing from the capability manifest.");
  const planned = planStandards(cwd, loaded.assets, capability.version);
  if (planned.status === "write") applyStandards(planned);
  return planned;
}

function existingFrameworkFiles(destDir: string): string[] {
  if (!existsSync(destDir)) return [];
  if (!statSync(destDir).isDirectory()) return [];
  return readdirSync(destDir).filter((name) => statSync(path.join(destDir, name)).isFile());
}

function sameFile(source: string, target: string): boolean {
  if (!existsSync(target)) return false;
  return readFileSync(source).equals(readFileSync(target));
}

function equivalentText(current: string | undefined, next: string): boolean {
  if (current === undefined) return false;
  return current.replaceAll("\r\n", "\n") === next.replaceAll("\r\n", "\n");
}

function readOptional(file: string): string | undefined {
  if (!existsSync(file)) return undefined;
  return readFileSync(file, "utf8");
}
