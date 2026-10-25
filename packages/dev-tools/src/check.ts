import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import semver from "semver";

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_REGISTRY = "https://registry.npmjs.org";

export type CheckOptions = {
  cwd?: string;
  fetch?: typeof fetch;
  now?: number;
  cachePath?: string;
  cacheTtlMs?: number;
  timeoutMs?: number;
  registry?: string;
  noCache?: boolean;
  scope?: string;
};

export type CheckResult = {
  exitCode: number;
  lines: string[];
};

type ConsumerManifest = {
  dependencies?: unknown;
  devDependencies?: unknown;
  optionalDependencies?: unknown;
  appFramework?: {
    required?: unknown;
    scope?: unknown;
  };
};

type CacheFile = {
  checkedAt: number;
  entries: Record<string, { latest: string }>;
};

type ManifestResult = { ok: true; manifest: ConsumerManifest } | { ok: false; message: string };

export async function checkFrameworkPackages(options: CheckOptions = {}): Promise<CheckResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const manifestResult = await readManifest(cwd);
  if (!manifestResult.ok) return { exitCode: 1, lines: [manifestResult.message] };

  const dependencyResult = readDependencyNames(manifestResult.manifest);
  if (!dependencyResult.ok) return { exitCode: 1, lines: [dependencyResult.message] };

  const requiredResult = readRequired(manifestResult.manifest);
  if (!requiredResult.ok) return { exitCode: 1, lines: [requiredResult.message] };

  const scopeResult = resolveScope(options.scope, manifestResult.manifest);
  if (!scopeResult.ok) return { exitCode: 1, lines: [scopeResult.message] };
  const scope = scopeResult.scope ?? (await readOwnScope());

  const required = requiredResult.required;
  const names = new Set<string>();
  for (const name of dependencyResult.names) {
    if (isFrameworkName(name, scope, required)) names.add(name);
  }
  for (const name of required) names.add(name);

  const localLines: string[] = [];
  const installed = new Map<string, string>();

  for (const name of [...names].sort()) {
    const version = await readInstalledVersion(cwd, name);
    const isRequired = required.has(name);
    const declared = dependencyResult.names.has(name);
    if (version === undefined) {
      if (isRequired) localLines.push(`${name}  required package is not installed`);
      else if (declared) localLines.push(`${name}  is not installed`);
      continue;
    }
    if (semver.valid(version) === null) {
      localLines.push(`${name}  installed version "${version}" is not valid semver`);
      continue;
    }
    installed.set(name, version);
  }

  const lookupNames = [...installed.keys()].sort();
  const versionResult = await resolveLatestVersions(lookupNames, {
    now: options.now ?? Date.now(),
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    cacheTtlMs: options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
    noCache: options.noCache ?? false,
    cachePath: options.cachePath ?? path.join(cwd, "node_modules", ".cache", "framework-check.json"),
    registry: (options.registry ?? DEFAULT_REGISTRY).replace(/\/$/, ""),
    fetchImpl: options.fetch ?? fetch,
  });

  const lines = [...localLines];
  if (versionResult.registryFailed && !versionResult.usedCache) {
    lines.push("registry unavailable; version check skipped");
    return { exitCode: 0, lines };
  }

  for (const name of lookupNames) {
    const installedVersion = installed.get(name);
    const latestVersion = versionResult.latest.get(name);
    if (installedVersion === undefined) continue;
    if (latestVersion === undefined) {
      if (!versionResult.registryFailed) lines.push(`${name}  no stable version published`);
      continue;
    }
    if (semver.major(latestVersion) > semver.major(installedVersion)) {
      lines.push(`${name}  ${installedVersion} → ${latestVersion}  major update`);
    } else if (semver.gt(latestVersion, installedVersion)) {
      lines.push(`${name}  ${installedVersion} → ${latestVersion}  compatible update`);
    }
  }

  if (versionResult.registryFailed && versionResult.usedCache) {
    lines.push("registry unavailable; used cached versions");
  }

  return { exitCode: 0, lines };
}

async function resolveLatestVersions(
  names: readonly string[],
  options: {
    now: number;
    timeoutMs: number;
    cacheTtlMs: number;
    noCache: boolean;
    cachePath: string;
    registry: string;
    fetchImpl: typeof fetch;
  },
): Promise<{ latest: Map<string, string>; registryFailed: boolean; usedCache: boolean }> {
  if (names.length === 0) return { latest: new Map(), registryFailed: false, usedCache: false };

  const cache = options.noCache ? undefined : await readCache(options.cachePath);
  if (cache && isFresh(cache, names, options.now, options.cacheTtlMs)) {
    return { latest: entriesToMap(cache, names), registryFailed: false, usedCache: false };
  }

  try {
    const fetched = await fetchAll(names, options.registry, options.timeoutMs, options.fetchImpl);
    if (!options.noCache) await writeCache(options.cachePath, options.now, fetched);
    return { latest: fetched, registryFailed: false, usedCache: false };
  } catch {
    const cached = cache ? entriesToMap(cache, names) : new Map<string, string>();
    if (cached.size > 0) return { latest: cached, registryFailed: true, usedCache: true };
    return { latest: new Map(), registryFailed: true, usedCache: false };
  }
}

async function fetchAll(
  names: readonly string[],
  registry: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<Map<string, string>> {
  const results = await Promise.all(names.map((name) => fetchLatest(name, registry, timeoutMs, fetchImpl)));
  const latest = new Map<string, string>();
  for (const result of results) {
    if (result.latest !== undefined) latest.set(result.name, result.latest);
  }
  return latest;
}

async function fetchLatest(
  name: string,
  registry: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<{ name: string; latest: string | undefined }> {
  const response = await fetchImpl(`${registry}/${encodeURIComponent(name)}`, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "application/json" },
  });
  if (response.status === 404) return { name, latest: undefined };
  if (!response.ok) throw new Error(`Registry responded ${response.status} for ${name}.`);
  return { name, latest: selectLatestStable(await response.json()) };
}

function selectLatestStable(document: unknown): string | undefined {
  if (!isRecord(document)) return undefined;
  const distTags = document["dist-tags"];
  if (isRecord(distTags) && typeof distTags.latest === "string" && isStable(distTags.latest)) {
    return distTags.latest;
  }
  const versions = document.versions;
  if (!isRecord(versions)) return undefined;
  const stable = Object.keys(versions).filter((version) => isStable(version));
  return semver.rsort(stable)[0];
}

function isStable(version: string): boolean {
  return semver.valid(version) !== null && semver.prerelease(version) === null;
}

async function readManifest(cwd: string): Promise<ManifestResult> {
  let text: string;
  try {
    text = await readFile(path.join(cwd, "package.json"), "utf8");
  } catch {
    return { ok: false, message: `Could not read package.json in ${cwd}.` };
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) return { ok: false, message: `package.json in ${cwd} must be a JSON object.` };
    return { ok: true, manifest: parsed as ConsumerManifest };
  } catch {
    return { ok: false, message: `package.json in ${cwd} is not valid JSON.` };
  }
}

function readDependencyNames(
  manifest: ConsumerManifest,
): { ok: true; names: Set<string> } | { ok: false; message: string } {
  const names = new Set<string>();
  for (const field of ["dependencies", "devDependencies", "optionalDependencies"] as const) {
    const value = manifest[field];
    if (value === undefined) continue;
    if (!isStringRecord(value)) {
      return { ok: false, message: `${field} must be an object of package names to version ranges.` };
    }
    for (const name of Object.keys(value)) names.add(name);
  }
  return { ok: true, names };
}

function readRequired(manifest: ConsumerManifest): { ok: true; required: Set<string> } | { ok: false; message: string } {
  const required = manifest.appFramework?.required;
  if (required === undefined) return { ok: true, required: new Set() };
  if (!Array.isArray(required) || required.some((name) => typeof name !== "string" || name.length === 0)) {
    return { ok: false, message: "appFramework.required must be an array of package names." };
  }
  return { ok: true, required: new Set(required) };
}

function resolveScope(
  explicitScope: string | undefined,
  manifest: ConsumerManifest,
): { ok: true; scope: string | undefined } | { ok: false; message: string } {
  if (explicitScope !== undefined) return { ok: true, scope: explicitScope };
  const scope = manifest.appFramework?.scope;
  if (scope === undefined) return { ok: true, scope: undefined };
  if (typeof scope !== "string" || !/^@[^/]+$/.test(scope)) {
    return { ok: false, message: 'appFramework.scope must be an npm scope such as "@app-framework".' };
  }
  return { ok: true, scope };
}

function isFrameworkName(name: string, scope: string, required: ReadonlySet<string>): boolean {
  return name.startsWith(`${scope}/`) || required.has(name);
}

async function readInstalledVersion(cwd: string, name: string): Promise<string | undefined> {
  try {
    const parsed: unknown = JSON.parse(
      await readFile(path.join(cwd, "node_modules", ...name.split("/"), "package.json"), "utf8"),
    );
    if (!isRecord(parsed) || typeof parsed.version !== "string") return undefined;
    return parsed.version;
  } catch {
    return undefined;
  }
}

async function readOwnScope(): Promise<string> {
  let directory = path.dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 6; depth += 1) {
    const scope = await readScopeFromPackage(path.join(directory, "package.json"));
    if (scope !== undefined) return scope;
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error("Could not read the dev-tools package name.");
}

async function readScopeFromPackage(packageJsonPath: string): Promise<string | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(packageJsonPath, "utf8"));
    if (!isRecord(parsed) || typeof parsed.name !== "string" || !parsed.name.endsWith("/dev-tools")) return undefined;
    return /^(@[^/]+)\//.exec(parsed.name)?.[1];
  } catch {
    return undefined;
  }
}

async function readCache(cachePath: string): Promise<CacheFile | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(cachePath, "utf8"));
    return isCacheFile(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function writeCache(cachePath: string, checkedAt: number, latest: ReadonlyMap<string, string>): Promise<void> {
  const entries: CacheFile["entries"] = {};
  for (const [name, version] of latest) entries[name] = { latest: version };
  try {
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, `${JSON.stringify({ checkedAt, entries })}\n`, "utf8");
  } catch {
    // A cache miss must not stop the caller from starting the application.
  }
}

function isFresh(cache: CacheFile, names: readonly string[], now: number, ttlMs: number): boolean {
  if (now - cache.checkedAt >= ttlMs) return false;
  return names.every((name) => typeof cache.entries[name]?.latest === "string");
}

function entriesToMap(cache: CacheFile, names: readonly string[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const name of names) {
    const version = cache.entries[name]?.latest;
    if (typeof version === "string") latest.set(name, version);
  }
  return latest;
}

function isCacheFile(value: unknown): value is CacheFile {
  if (!isRecord(value) || typeof value.checkedAt !== "number" || !isRecord(value.entries)) return false;
  return Object.values(value.entries).every((entry) => isRecord(entry) && typeof entry.latest === "string");
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
