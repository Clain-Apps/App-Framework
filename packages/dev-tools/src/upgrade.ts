import path from "node:path";
import { spawnSync } from "node:child_process";
import semver from "semver";
import { loadCapabilityManifest, type LoadedManifest } from "./capabilities.js";
import { installedPackageVersion, latestPackageVersions, type CheckOptions } from "./check.js";
import { readConsumerConfig, selectCapabilities, selectedNpmPackages, validateDeploySelection } from "./config.js";
import { applyCapabilities, formatLine, type SetupResult } from "./setup.js";
import { detectPackageManager, installArguments, readWorkspace, type RunCommand } from "./workspace.js";

export type UpgradeOptions = CheckOptions & {
  cwd?: string;
  dryRun?: boolean;
  check?: boolean;
  runCommand?: RunCommand;
};

export async function runUpgrade(options: UpgradeOptions = {}): Promise<SetupResult> {
  const header = headerFor(options);
  if (options.dryRun === true && options.check === true) {
    return fail(header, "Use either --dry-run or --check.");
  }

  let loaded: LoadedManifest;
  try {
    loaded = loadCapabilityManifest();
  } catch (error) {
    return fail(header, error instanceof Error ? error.message : "Could not load the capability manifest.");
  }

  const cwd = path.resolve(options.cwd ?? process.cwd());
  if (path.resolve(cwd) === path.resolve(loaded.assets.root)) {
    return fail(header, "Refusing to set up the framework repository.");
  }

  const workspace = readWorkspace(cwd);
  if (!workspace.ok) return fail(header, workspace.message);

  const configFile = readConsumerConfig(cwd);
  if (configFile.status === "missing") return fail(header, "Missing framework.config.json. Run framework adopt first.");
  if (configFile.status === "invalid") return failAll(header, configFile.errors);

  const selection = selectCapabilities(loaded.manifest, configFile.config);
  const errors = [...selection.errors, ...validateDeploySelection(loaded.manifest, configFile.config, selection.selected)];
  if (errors.length > 0) return failAll(header, errors);

  const writing = options.dryRun !== true && options.check !== true;
  const applied = applyCapabilities({ cwd, loaded, config: configFile.config, writing });
  if (applied.errors.length > 0) return failAll(header, applied.errors);

  const lines = [header, `  profile  ${configFile.config.profile ?? "none"}`, ...applied.lines.map(formatLine)];
  let wrote = applied.wrote;

  const packages = selectedNpmPackages(loaded.manifest, selection.selected);
  for (const entry of packages) {
    if (entry.status === "unpublished") {
      lines.push(
        `  ${entry.id}  blocked  ${entry.packageName}@${entry.version} is unpublished. No dependency was updated.`,
      );
      continue;
    }
    const installed = await installedPackageVersion(cwd, entry.packageName);
    if (installed === undefined) {
      lines.push(`  ${entry.id}  missing  ${entry.packageName} is selected and available but not installed.`);
      continue;
    }
    const latest = await latestPackageVersions([entry.packageName], { ...options, cwd });
    if (latest.registryFailed && latest.latest.size === 0) {
      lines.push(`  ${entry.id}  skipped  registry unavailable; package update check skipped.`);
      continue;
    }
    const published = latest.latest.get(entry.packageName);
    if (published === undefined || !semver.gt(published, installed)) {
      lines.push(`  ${entry.id}  unchanged  ${entry.packageName}@${installed}`);
      continue;
    }
    if (semver.major(published) > semver.major(installed)) {
      lines.push(`  ${entry.id}  blocked  ${entry.packageName}  ${installed} → ${published}  major update was not applied.`);
      continue;
    }
    const manager = workspace.workspace.packageManager ?? detectPackageManager(cwd, workspace.workspace.packageJson);
    if (manager === undefined) {
      return fail(header, "Could not detect the application's package manager. Add a lockfile or packageManager field.");
    }
    const args = installArguments(manager.name, entry.packageName, published, entry.dependencyField);
    lines.push(`  ${entry.id}  update  ${manager.name} ${args.join(" ")}`);
    if (writing) {
      const run = options.runCommand ?? defaultRunCommand;
      const result = run(manager.name, args, cwd);
      if (result.status !== 0) {
        return fail(header, result.stderr.trim() || result.stdout.trim() || `${manager.name} ${args.join(" ")} failed.`);
      }
      wrote = true;
    }
  }

  const conflicts = applied.lines.some((line) => line.status === "conflict");
  return { exitCode: conflicts ? 1 : 0, wrote, lines };
}

function headerFor(options: UpgradeOptions): string {
  if (options.dryRun === true) return "framework upgrade (dry-run)";
  if (options.check === true) return "framework upgrade (check)";
  return "framework upgrade";
}

function defaultRunCommand(command: string, args: readonly string[], cwd: string) {
  const result = spawnSync(command, [...args], { cwd, encoding: "utf8", shell: process.platform === "win32" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function fail(header: string, message: string): SetupResult {
  return { exitCode: 1, wrote: false, lines: [header, `  error  ${message}`] };
}

function failAll(header: string, errors: readonly string[]): SetupResult {
  return { exitCode: 1, wrote: false, lines: [header, ...errors.map((message) => `  error  ${message}`)] };
}
