import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import semver from "semver";
import { installArguments, type PackageManagerName } from "./workspace.js";

export type InstallPlan = {
  id: string;
  status: "blocked" | "install" | "unchanged" | "major" | "error";
  message: string;
  command?: string;
  args?: string[];
};

export function planPackageInstall(input: {
  id: string;
  packageName: string;
  version: string;
  dependencyField: "dependencies" | "devDependencies";
  distributionStatus: "unpublished" | "available";
  dependencies: readonly string[];
  packageJson: Record<string, unknown>;
  manager: PackageManagerName | undefined;
}): InstallPlan {
  const spec = `${input.packageName}@${input.version}`;
  if (input.distributionStatus === "unpublished") {
    const requires = input.dependencies.length === 0 ? "" : ` and requires ${input.dependencies.join(", ")}`;
    return {
      id: input.id,
      status: "blocked",
      message: `${spec} is unpublished${requires}. No dependency was added.`,
    };
  }

  const declared = declaredRange(input.packageJson, input.packageName);
  if (declared !== undefined && !isRegistryRange(declared.range)) {
    return {
      id: input.id,
      status: "unchanged",
      message: `${input.packageName} uses ${declared.range} and was left unchanged.`,
    };
  }
  if (declared !== undefined && rangeAccepts(declared.range, input.version)) {
    return {
      id: input.id,
      status: "unchanged",
      message: `${spec} already matches the manifest.`,
    };
  }
  if (declared !== undefined && isMajorJump(declared.range, input.version)) {
    return {
      id: input.id,
      status: "major",
      message: `${input.packageName}  ${declared.range} → ${input.version}  major update was not applied.`,
    };
  }
  if (declared !== undefined && isAhead(declared.range, input.version)) {
    return {
      id: input.id,
      status: "unchanged",
      message: `${input.packageName}@${declared.range} is newer than the manifest version ${input.version} and was left unchanged.`,
    };
  }
  if (input.manager === undefined) {
    return {
      id: input.id,
      status: "error",
      message: "Could not detect the application's package manager. Add a lockfile or packageManager field.",
    };
  }

  const args = installArguments(input.manager, input.packageName, input.version, input.dependencyField);
  return {
    id: input.id,
    status: "install",
    message: `${input.manager} ${args.join(" ")}`,
    command: input.manager,
    args,
  };
}

export function planFrameworkScript(
  packageJson: Record<string, unknown>,
  devToolsReady: boolean,
): { status: "write" | "unchanged" | "conflict" | "skip"; message: string } {
  if (!devToolsReady) return { status: "skip", message: "" };
  const scripts = packageJson.scripts;
  if (scripts === undefined) return { status: "write", message: "package.json scripts.framework" };
  if (!isRecord(scripts)) {
    return { status: "conflict", message: "scripts is not an object and was left unchanged." };
  }
  if (scripts.framework === undefined) return { status: "write", message: "package.json scripts.framework" };
  if (scripts.framework === "framework") return { status: "unchanged", message: "framework" };
  return {
    status: "conflict",
    message: "an application script is already named framework and was left unchanged.",
  };
}

export function writeFrameworkScript(cwd: string): { status: "write" | "unchanged" | "conflict"; message: string } {
  const manifestPath = path.join(cwd, "package.json");
  const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!isRecord(parsed)) return { status: "conflict", message: "package.json must be an object." };
  const decision = planFrameworkScript(parsed, true);
  if (decision.status === "skip") return { status: "unchanged", message: decision.message };
  if (decision.status === "write") {
    const scripts = isRecord(parsed.scripts) ? parsed.scripts : {};
    scripts.framework = "framework";
    parsed.scripts = scripts;
    writeFileSync(manifestPath, `${JSON.stringify(parsed, null, 2)}\n`);
  }
  return { status: decision.status, message: decision.message };
}

function declaredRange(
  packageJson: Record<string, unknown>,
  packageName: string,
): { range: string } | undefined {
  for (const field of ["dependencies", "devDependencies", "optionalDependencies"] as const) {
    const value = packageJson[field];
    if (!isRecord(value)) continue;
    const range = value[packageName];
    if (typeof range === "string" && range.length > 0) return { range };
  }
  return undefined;
}

function isRegistryRange(range: string): boolean {
  return !/^(workspace:|file:|link:|portal:|git\+|github:|http:|https:|npm:)/.test(range);
}

function rangeAccepts(range: string, version: string): boolean {
  if (semver.validRange(range) === null) return false;
  return semver.satisfies(version, range, { includePrerelease: true });
}

function isMajorJump(range: string, version: string): boolean {
  const minimum = semver.minVersion(range);
  if (minimum === null) return false;
  return semver.major(version) > semver.major(minimum) && !rangeAccepts(range, version);
}

function isAhead(range: string, version: string): boolean {
  const minimum = semver.minVersion(range);
  if (minimum === null) return false;
  return semver.gt(minimum, version);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
