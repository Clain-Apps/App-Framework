import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isManagedDeployCaller } from "./config.js";

export type PackageManagerName = "pnpm" | "npm" | "yarn";

export type PackageManager = {
  name: PackageManagerName;
  source: string;
};

export type LegacyNote = {
  id: string;
  message: string;
};

export type Workspace = {
  cwd: string;
  packageJson: Record<string, unknown>;
  packageManager: PackageManager | undefined;
  dependencyNames: Set<string>;
  legacy: LegacyNote[];
};

export type CommandResult = { status: number | null; stdout: string; stderr: string };
export type RunCommand = (command: string, args: readonly string[], cwd: string) => CommandResult;

export function readWorkspace(cwd: string): { ok: true; workspace: Workspace } | { ok: false; message: string } {
  const manifestPath = path.join(cwd, "package.json");
  if (!existsSync(manifestPath)) {
    return { ok: false, message: "Missing package.json. Adoption needs an existing JavaScript application." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return { ok: false, message: "package.json is not valid JSON." };
  }
  if (!isRecord(parsed)) return { ok: false, message: "package.json must be a JSON object." };

  const dependencyNames = new Set<string>();
  for (const field of ["dependencies", "devDependencies", "optionalDependencies"] as const) {
    const value = parsed[field];
    if (value === undefined) continue;
    if (!isRecord(value)) return { ok: false, message: `${field} must be an object of package names to version ranges.` };
    for (const name of Object.keys(value)) dependencyNames.add(name);
  }

  const packageManager = detectPackageManager(cwd, parsed);
  return {
    ok: true,
    workspace: {
      cwd,
      packageJson: parsed,
      packageManager,
      dependencyNames,
      legacy: detectLegacy(cwd, dependencyNames),
    },
  };
}

export function detectPackageManager(cwd: string, packageJson?: Record<string, unknown>): PackageManager | undefined {
  const declared = packageJson?.packageManager;
  if (typeof declared === "string") {
    if (declared.startsWith("pnpm@")) return { name: "pnpm", source: "package.json packageManager" };
    if (declared.startsWith("npm@")) return { name: "npm", source: "package.json packageManager" };
    if (declared.startsWith("yarn@")) return { name: "yarn", source: "package.json packageManager" };
  }
  if (existsSync(path.join(cwd, "pnpm-lock.yaml"))) return { name: "pnpm", source: "pnpm-lock.yaml" };
  if (existsSync(path.join(cwd, "yarn.lock"))) return { name: "yarn", source: "yarn.lock" };
  if (existsSync(path.join(cwd, "package-lock.json"))) return { name: "npm", source: "package-lock.json" };
  return undefined;
}

export function installArguments(
  manager: PackageManagerName,
  packageName: string,
  version: string,
  dependencyField: "dependencies" | "devDependencies",
): string[] {
  const spec = `${packageName}@^${version}`;
  if (manager === "pnpm") return dependencyField === "devDependencies" ? ["add", "-D", spec] : ["add", spec];
  if (manager === "yarn") return dependencyField === "devDependencies" ? ["add", "--dev", spec] : ["add", spec];
  return dependencyField === "devDependencies" ? ["install", spec, "--save-dev"] : ["install", spec, "--save"];
}

function detectLegacy(cwd: string, dependencyNames: ReadonlySet<string>): LegacyNote[] {
  const notes: LegacyNote[] = [];
  if (dependencyNames.has("next")) {
    notes.push({ id: "next", message: "Next.js is present. Adoption does not replace it or change the frontend stack." });
  }
  if (dependencyNames.has("vite")) {
    notes.push({ id: "vite", message: "Vite is present. Adoption does not replace it or change the frontend stack." });
  }
  if (["express", "fastify", "koa"].some((name) => dependencyNames.has(name))) {
    notes.push({
      id: "node-server",
      message: "A Node.js server framework is present. Select node-server and run framework deploy enable; adoption does not deploy it.",
    });
  }
  if (["dotenv", "envalid", "@t3-oss/env-core", "@t3-oss/env-nextjs"].some((name) => dependencyNames.has(name))) {
    notes.push({
      id: "env",
      message: "An environment library is present. app-config can be added later without removing it.",
    });
  }
  const deployFile = path.join(cwd, ".github", "workflows", "deploy.yml");
  if (existsSync(deployFile)) {
    const text = readFileSync(deployFile, "utf8");
    if (!isManagedDeployCaller(text)) {
      notes.push({
        id: "deploy",
        message: ".github/workflows/deploy.yml is application-owned. framework deploy enable reports the conflict and does not replace it until --approve-switch.",
      });
    }
  }
  return notes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
