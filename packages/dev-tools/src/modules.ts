import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadCapabilityManifest, type LoadedManifest } from "./capabilities.js";
import {
  CONFIG_FILE,
  canonicalCapabilityId,
  enableCapability,
  readConsumerConfig,
  renderConsumerConfig,
  selectCapabilities,
  validateDeploySelection,
} from "./config.js";
import { planFrameworkScript, planPackageInstall, writeFrameworkScript } from "./install.js";
import { applyCapabilities, formatLine, type SetupResult } from "./setup.js";
import { detectPackageManager, readWorkspace, runPackageManager, type RunCommand } from "./workspace.js";

export type ModulesOptions = {
  cwd?: string;
};

export type AddOptions = {
  cwd?: string;
  module: string;
  dryRun?: boolean;
  runCommand?: RunCommand;
};

export function listModules(options: ModulesOptions = {}): SetupResult {
  let loaded: LoadedManifest;
  try {
    loaded = loadCapabilityManifest();
  } catch (error) {
    return fail("framework modules", error instanceof Error ? error.message : "Could not load the capability manifest.");
  }

  const cwd = options.cwd === undefined ? undefined : path.resolve(options.cwd);
  const lines = ["framework modules"];
  const configFile = cwd === undefined ? { status: "missing" as const } : readConsumerConfig(cwd);
  const selected = selectedIds(loaded, cwd, configFile);

  for (const capability of [...loaded.manifest.capabilities].sort((left, right) => left.id.localeCompare(right.id))) {
    const selectable = capability.selectable ? "selectable" : "not-selectable";
    const enabled = selected?.has(capability.id) === true ? "on" : "off";
    lines.push(
      `  ${capability.id}  ${capability.type}  ${capability.enablement}  ${capability.distribution.status}  ${selectable}  ${enabled}  ${capability.purpose}`,
    );
  }
  return { exitCode: 0, wrote: false, lines };
}

export async function addModule(options: AddOptions): Promise<SetupResult> {
  const header = options.dryRun === true ? "framework add (dry-run)" : "framework add";
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

  const requested = canonicalCapabilityId(options.module);
  const capability = loaded.manifest.capabilities.find((item) => item.id === requested);
  if (capability === undefined) {
    return fail(header, `${options.module} is not an implemented capability.`);
  }
  if (!capability.selectable) {
    return fail(header, `${capability.id} is maintained in App-Framework and cannot be selected.`);
  }

  const configFile = readConsumerConfig(cwd);
  if (configFile.status === "missing") return fail(header, "Missing framework.config.json. Run framework adopt first.");
  if (configFile.status === "invalid") return failAll(header, configFile.errors);

  const nextConfig = enableCapability(loaded.manifest, configFile.config, capability.id);
  const selection = selectCapabilities(loaded.manifest, nextConfig);
  const errors = [...selection.errors, ...validateDeploySelection(loaded.manifest, nextConfig, selection.selected)];
  if (errors.length > 0) return failAll(header, errors);

  const writing = options.dryRun !== true;
  const lines = [header, `  module  ${capability.id}`];
  let wrote = false;

  if (capability.distribution.mechanism === "npm") {
    const manager = workspace.workspace.packageManager ?? detectPackageManager(cwd, workspace.workspace.packageJson);
    const plan = planPackageInstall({
      id: capability.id,
      packageName: capability.distribution.packageName,
      version: capability.version,
      dependencyField: capability.distribution.dependencyField,
      distributionStatus: capability.distribution.status,
      dependencies: capability.dependencies,
      packageJson: workspace.workspace.packageJson,
      manager: manager?.name,
    });
    lines.push(`  ${plan.id}  ${plan.status}  ${plan.message}`);
    if (plan.status === "blocked" || plan.status === "error" || plan.status === "major") {
      return { exitCode: 1, wrote: false, lines };
    }
    if (writing && plan.status === "install" && plan.command !== undefined && plan.args !== undefined) {
      const run = options.runCommand ?? runPackageManager;
      const result = run(plan.command, plan.args, cwd);
      if (result.status !== 0) {
        return fail(header, result.stderr.trim() || result.stdout.trim() || `${plan.command} ${plan.args.join(" ")} failed.`);
      }
      wrote = true;
    }
    if (capability.id === "dev-tools" && (plan.status === "install" || plan.status === "unchanged")) {
      const scriptPlan = planFrameworkScript(workspace.workspace.packageJson, true);
      if (!writing) {
        if (scriptPlan.status !== "skip") lines.push(`  script  ${scriptPlan.status}  ${scriptPlan.message}`);
      } else {
        const written = writeFrameworkScript(cwd);
        lines.push(`  script  ${written.status}  ${written.message}`);
        wrote = wrote || written.status === "write";
      }
    }
  }

  if (writing) {
    writeFileSync(path.join(cwd, CONFIG_FILE), renderConsumerConfig(nextConfig));
    wrote = true;
  } else {
    lines.push(`  config  write  ${CONFIG_FILE}`);
  }

  const applied = applyCapabilities({ cwd, loaded, config: nextConfig, writing, reportPackages: false });
  if (applied.errors.length > 0) return failAll(header, applied.errors);
  lines.push(...applied.lines.map(formatLine));
  wrote = wrote || applied.wrote;
  const conflicts = applied.lines.some((line) => line.status === "conflict");
  return { exitCode: conflicts ? 1 : 0, wrote, lines };
}

function selectedIds(
  loaded: LoadedManifest,
  cwd: string | undefined,
  configFile: ReturnType<typeof readConsumerConfig> | { status: "missing" },
): Set<string> | undefined {
  if (cwd === undefined || configFile.status !== "ok") return undefined;
  const selection = selectCapabilities(loaded.manifest, configFile.config);
  if (selection.errors.length > 0) return undefined;
  return selection.selected;
}

function fail(header: string, message: string): SetupResult {
  return { exitCode: 1, wrote: false, lines: [header, `  error  ${message}`] };
}

function failAll(header: string, errors: readonly string[]): SetupResult {
  return { exitCode: 1, wrote: false, lines: [header, ...errors.map((message) => `  error  ${message}`)] };
}
