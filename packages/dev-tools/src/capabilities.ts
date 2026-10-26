import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_DIRECTORIES: Record<string, string> = {
  "@app-framework/ui": "packages/ui",
  "@app-framework/app-config": "packages/config",
  "@app-framework/dev-tools": "packages/dev-tools",
};

export type CapabilityType = "core" | "optional" | "standard";
export type Enablement = "mandatory" | "default-enabled" | "opt-in";

export type NpmDistribution = {
  mechanism: "npm";
  status: "unpublished" | "available";
  packageName: string;
  dependencyField: "dependencies" | "devDependencies";
};

export type Distribution =
  | NpmDistribution
  | { mechanism: "file-sync"; status: "available" }
  | { mechanism: "workflow-call"; status: "available" }
  | { mechanism: "repository-workflow"; status: "available" };

export type Compatibility = {
  node?: string;
  profiles: string[];
  notes?: string;
};

export type Capability = {
  id: string;
  catalogue: string;
  purpose: string;
  location: string;
  type: CapabilityType;
  version: string;
  dependencies: string[];
  configurationSchema: Record<string, unknown> | null;
  integration: string;
  compatibility: Compatibility;
  enablement: Enablement;
  selectable: boolean;
  distribution: Distribution;
};

export type Profile = {
  id: string;
  purpose: string;
  limitations: string;
};

export type CapabilityManifest = {
  contractVersion: 1;
  repository: string;
  templateRepository: string;
  deployRoot: string;
  profiles: Profile[];
  capabilities: Capability[];
};

export type FrameworkAssets = {
  mode: "repository" | "package";
  root: string;
  manifestPath: string;
  standardsDir: string;
};

export type LoadedManifest = {
  assets: FrameworkAssets;
  manifest: CapabilityManifest;
};

export function resolveFrameworkAssets(moduleUrl: string = import.meta.url): FrameworkAssets {
  const start = path.dirname(fileURLToPath(moduleUrl));
  let directory = start;
  for (let depth = 0; depth < 8; depth += 1) {
    if (isRepository(directory)) {
      return {
        mode: "repository",
        root: directory,
        manifestPath: path.join(directory, "capabilities", "manifest.json"),
        standardsDir: path.join(directory, "standards", "cursor"),
      };
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  const candidates = [path.join(start, "consumer"), path.resolve(start, "..", "dist", "consumer")];
  for (const candidate of candidates) {
    const manifestPath = path.join(candidate, "manifest.json");
    const standardsDir = path.join(candidate, "standards", "cursor");
    if (existsSync(manifestPath) && existsSync(path.join(standardsDir, "version.json"))) {
      return { mode: "package", root: candidate, manifestPath, standardsDir };
    }
  }

  throw new Error(
    "Could not find the capability manifest. Run this command from an App-Framework checkout or a published @app-framework/dev-tools package.",
  );
}

export function loadCapabilityManifest(moduleUrl: string = import.meta.url): LoadedManifest {
  const assets = resolveFrameworkAssets(moduleUrl);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(assets.manifestPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Could not read ${assets.manifestPath}: ${message}`, { cause: error });
  }
  const manifest = parseManifest(parsed);
  assertStandardsVersion(manifest, assets);
  if (assets.mode === "repository") {
    const scopePath = path.join(assets.root, "framework.scope.json");
    const scope = JSON.parse(readFileSync(scopePath, "utf8")) as unknown;
    assertScopeAgreement(manifest, scope);
    assertPackageVersions(manifest, assets.root);
  }
  return { assets, manifest };
}

export function assertScopeAgreement(manifest: CapabilityManifest, scope: unknown): void {
  if (!isRecord(scope)) throw new Error("framework.scope.json must be an object.");
  if (typeof scope.npmScope !== "string" || scope.npmScope.length === 0) {
    throw new Error("framework.scope.json npmScope must be a string.");
  }
  if (typeof scope.scopeConfirmed !== "boolean") {
    throw new Error("framework.scope.json scopeConfirmed must be a boolean.");
  }
  if (scope.repository !== manifest.repository) {
    throw new Error("framework.scope.json repository must match the capability manifest.");
  }
  if (scope.templateRepository !== manifest.templateRepository) {
    throw new Error("framework.scope.json templateRepository must match the capability manifest.");
  }
  for (const capability of manifest.capabilities) {
    if (capability.distribution.mechanism !== "npm") continue;
    if (!capability.distribution.packageName.startsWith(`${scope.npmScope}/`)) {
      throw new Error(`${capability.id} must use the npm scope ${scope.npmScope}.`);
    }
    if (scope.scopeConfirmed !== true && capability.distribution.status !== "unpublished") {
      throw new Error(`${capability.id} is marked ${capability.distribution.status} while the npm scope is not confirmed.`);
    }
  }
}

export function readSourceCommit(assets: FrameworkAssets): string {
  if (assets.mode === "repository") {
    const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: assets.root, encoding: "utf8" });
    const commit = (result.stdout ?? "").trim();
    if (result.status !== 0 || !/^[0-9a-f]{40}$/.test(commit)) {
      throw new Error("Could not read the framework commit.");
    }
    return commit;
  }
  const sourcePath = path.join(assets.root, "source.json");
  const source = JSON.parse(readFileSync(sourcePath, "utf8")) as { commit?: unknown };
  if (typeof source.commit !== "string" || !/^[0-9a-f]{40}$/.test(source.commit)) {
    throw new Error("Packaged standards are missing a commit pin.");
  }
  return source.commit;
}

export function workflowRefPattern(manifest: CapabilityManifest): RegExp {
  const capability = manifest.capabilities.find((item) => item.id === "deploy-static");
  if (capability === undefined) throw new Error("deploy-static is missing from the capability manifest.");
  const schema = capability.configurationSchema;
  if (schema === null) throw new Error("deploy-static is missing a configuration schema.");
  const properties = schema.properties;
  if (!isRecord(properties)) throw new Error("deploy-static configuration schema is missing properties.");
  const workflowRef = properties.workflowRef;
  if (!isRecord(workflowRef) || typeof workflowRef.pattern !== "string") {
    throw new Error("deploy-static configuration schema is missing workflowRef.pattern.");
  }
  return new RegExp(workflowRef.pattern);
}

function assertStandardsVersion(manifest: CapabilityManifest, assets: FrameworkAssets): void {
  const capability = manifest.capabilities.find((item) => item.id === "cursor-standards");
  if (capability === undefined) throw new Error("cursor-standards is missing from the capability manifest.");
  const versionFile = JSON.parse(readFileSync(path.join(assets.standardsDir, "version.json"), "utf8")) as {
    version?: unknown;
  };
  if (typeof versionFile.version !== "string" || capability.version !== versionFile.version) {
    throw new Error("cursor-standards version does not match standards/cursor/version.json.");
  }
}

function assertPackageVersions(manifest: CapabilityManifest, root: string): void {
  for (const capability of manifest.capabilities) {
    if (capability.distribution.mechanism !== "npm") continue;
    const relative = PACKAGE_DIRECTORIES[capability.distribution.packageName];
    if (relative === undefined) {
      throw new Error(`No package directory is recorded for ${capability.distribution.packageName}.`);
    }
    const pkg = JSON.parse(readFileSync(path.join(root, relative, "package.json"), "utf8")) as {
      name?: unknown;
      version?: unknown;
      dependencies?: unknown;
    };
    if (pkg.name !== capability.distribution.packageName || pkg.version !== capability.version) {
      throw new Error(`${capability.id} version does not match ${relative}/package.json.`);
    }
    const declared =
      pkg.dependencies === undefined ? [] : Object.keys(pkg.dependencies as Record<string, unknown>).sort();
    const expected = [...capability.dependencies].sort();
    if (declared.join("\0") !== expected.join("\0")) {
      throw new Error(`${capability.id} dependencies do not match ${relative}/package.json.`);
    }
  }
}

function parseManifest(value: unknown): CapabilityManifest {
  const errors: string[] = [];
  if (!isRecord(value)) throw new Error("Capability manifest must be an object.");
  if (value.contractVersion !== 1) errors.push("contractVersion must be 1.");
  const repository = readRepository(value.repository, "repository", errors);
  const templateRepository = readRepository(value.templateRepository, "templateRepository", errors);
  const deployRoot = typeof value.deployRoot === "string" ? value.deployRoot : "";
  if (!/^\/[A-Za-z0-9._-]+$/.test(deployRoot)) errors.push("deployRoot must be one absolute path segment.");
  const profiles = parseProfiles(value.profiles, errors);
  const capabilities = parseCapabilities(value.capabilities, profiles, errors);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    contractVersion: 1,
    repository,
    templateRepository,
    deployRoot,
    profiles,
    capabilities,
  };
}

function parseProfiles(value: unknown, errors: string[]): Profile[] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("profiles must list at least one profile.");
    return [];
  }
  const profiles: Profile[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) {
      errors.push("Each profile must be an object.");
      continue;
    }
    const id = typeof entry.id === "string" ? entry.id : "";
    if (!/^[a-z][a-z0-9-]*$/.test(id)) errors.push(`Profile id "${id}" is not a lowercase identifier.`);
    if (seen.has(id)) errors.push(`Profile ${id} is duplicated.`);
    seen.add(id);
    if (typeof entry.purpose !== "string" || entry.purpose.length === 0) errors.push(`Profile ${id} needs a purpose.`);
    if (typeof entry.limitations !== "string" || entry.limitations.length === 0) {
      errors.push(`Profile ${id} needs limitations.`);
    }
    if (typeof entry.purpose === "string" && typeof entry.limitations === "string" && id.length > 0) {
      profiles.push({ id, purpose: entry.purpose, limitations: entry.limitations });
    }
  }
  return profiles;
}

function parseCapabilities(value: unknown, profiles: readonly Profile[], errors: string[]): Capability[] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("capabilities must list at least one capability.");
    return [];
  }
  const capabilities: Capability[] = [];
  const seenIds = new Set<string>();
  const seenCatalogues = new Set<string>();
  const profileIds = new Set(profiles.map((profile) => profile.id));
  for (const entry of value) {
    const capability = parseCapability(entry, profileIds, errors);
    if (capability === undefined) continue;
    if (seenIds.has(capability.id)) errors.push(`Capability ${capability.id} is duplicated.`);
    if (seenCatalogues.has(capability.catalogue)) errors.push(`Catalogue entry ${capability.catalogue} is duplicated.`);
    seenIds.add(capability.id);
    seenCatalogues.add(capability.catalogue);
    capabilities.push(capability);
  }
  return capabilities;
}

function parseCapability(value: unknown, profileIds: ReadonlySet<string>, errors: string[]): Capability | undefined {
  if (!isRecord(value)) {
    errors.push("Each capability must be an object.");
    return undefined;
  }
  const id = typeof value.id === "string" ? value.id : "";
  const label = id.length > 0 ? id : "capability";
  if (!/^[a-z][a-z0-9-]*$/.test(id)) errors.push(`Capability id "${id}" is not a lowercase identifier.`);
  const catalogue = readText(value.catalogue, `${label}.catalogue`, errors);
  const purpose = readText(value.purpose, `${label}.purpose`, errors);
  const location = readText(value.location, `${label}.location`, errors);
  const integration = readText(value.integration, `${label}.integration`, errors);
  const version = readText(value.version, `${label}.version`, errors);
  const type = readEnum(value.type, ["core", "optional", "standard"] as const, `${label}.type`, errors);
  const enablement = readEnum(
    value.enablement,
    ["mandatory", "default-enabled", "opt-in"] as const,
    `${label}.enablement`,
    errors,
  );
  if (typeof value.selectable !== "boolean") errors.push(`${label}.selectable must be a boolean.`);
  const dependencies = readStringList(value.dependencies, `${label}.dependencies`, errors);
  const configurationSchema = readSchema(value.configurationSchema, `${label}.configurationSchema`, errors);
  const compatibility = readCompatibility(value.compatibility, profileIds, label, errors);
  const distribution = readDistribution(value.distribution, label, errors);
  if (
    type === undefined ||
    enablement === undefined ||
    compatibility === undefined ||
    distribution === undefined ||
    typeof value.selectable !== "boolean"
  ) {
    return undefined;
  }
  return {
    id,
    catalogue,
    purpose,
    location,
    type,
    version,
    dependencies,
    configurationSchema,
    integration,
    compatibility,
    enablement,
    selectable: value.selectable,
    distribution,
  };
}

function readCompatibility(
  value: unknown,
  profileIds: ReadonlySet<string>,
  label: string,
  errors: string[],
): Compatibility | undefined {
  if (!isRecord(value) || !Array.isArray(value.profiles)) {
    errors.push(`${label}.compatibility.profiles must be a list.`);
    return undefined;
  }
  const profiles: string[] = [];
  for (const profile of value.profiles) {
    if (typeof profile !== "string" || !profileIds.has(profile)) {
      errors.push(`${label} references an unknown profile.`);
      return undefined;
    }
    profiles.push(profile);
  }
  const compatibility: Compatibility = { profiles };
  if (value.node !== undefined) {
    if (typeof value.node !== "string" || value.node.length === 0) {
      errors.push(`${label}.compatibility.node must be a string.`);
      return undefined;
    }
    compatibility.node = value.node;
  }
  if (value.notes !== undefined) {
    if (typeof value.notes !== "string") {
      errors.push(`${label}.compatibility.notes must be a string.`);
      return undefined;
    }
    compatibility.notes = value.notes;
  }
  return compatibility;
}

function readDistribution(value: unknown, label: string, errors: string[]): Distribution | undefined {
  if (!isRecord(value)) {
    errors.push(`${label}.distribution must be an object.`);
    return undefined;
  }
  if (value.mechanism === "npm") {
    if (value.status !== "unpublished" && value.status !== "available") {
      errors.push(`${label}.distribution.status must be unpublished or available.`);
      return undefined;
    }
    if (typeof value.packageName !== "string" || !value.packageName.includes("/")) {
      errors.push(`${label}.distribution.packageName must be a scoped package name.`);
      return undefined;
    }
    if (value.dependencyField !== "dependencies" && value.dependencyField !== "devDependencies") {
      errors.push(`${label}.distribution.dependencyField must be dependencies or devDependencies.`);
      return undefined;
    }
    return {
      mechanism: "npm",
      status: value.status,
      packageName: value.packageName,
      dependencyField: value.dependencyField,
    };
  }
  if (
    value.mechanism === "file-sync" ||
    value.mechanism === "workflow-call" ||
    value.mechanism === "repository-workflow"
  ) {
    if (value.status !== "available") {
      errors.push(`${label}.distribution.status must be available for ${value.mechanism}.`);
      return undefined;
    }
    return { mechanism: value.mechanism, status: "available" };
  }
  errors.push(`${label}.distribution.mechanism is not supported.`);
  return undefined;
}

function readSchema(value: unknown, label: string, errors: string[]): Record<string, unknown> | null {
  if (value === null) return null;
  if (!isRecord(value)) {
    errors.push(`${label} must be an object or null.`);
    return null;
  }
  return value;
}

function readStringList(value: unknown, label: string, errors: string[]): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    errors.push(`${label} must be a list of strings.`);
    return [];
  }
  return value as string[];
}

function readText(value: unknown, label: string, errors: string[]): string {
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${label} must be a non-empty string.`);
    return "";
  }
  return value;
}

function readRepository(value: unknown, label: string, errors: string[]): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    errors.push(`${label} must be an owner/name repository.`);
    return "";
  }
  return value;
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], label: string, errors: string[]): T | undefined {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    errors.push(`${label} must be ${allowed.join(", ")}.`);
    return undefined;
  }
  return value as T;
}

function isRepository(directory: string): boolean {
  return (
    existsSync(path.join(directory, "capabilities", "manifest.json")) &&
    existsSync(path.join(directory, "framework.scope.json")) &&
    existsSync(path.join(directory, "standards", "cursor", "version.json")) &&
    existsSync(path.join(directory, "packages", "dev-tools", "package.json"))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
