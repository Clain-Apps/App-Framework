import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadCapabilityManifest, type LoadedManifest } from "./capabilities.js";
import {
  CONFIG_FILE,
  integrationDefaults,
  readConsumerConfig,
  renderConsumerConfig,
  selectCapabilities,
  selectedNpmPackages,
  validateDeploySelection,
  type ConsumerConfig,
} from "./config.js";
import { planFrameworkScript, planPackageInstall, writeFrameworkScript, type InstallPlan } from "./install.js";
import { applyCapabilities, formatLine, type ReportLine, type SetupResult } from "./setup.js";
import { readWorkspace, runPackageManager, type PackageManagerName, type RunCommand } from "./workspace.js";

export type AdoptOptions = {
  cwd?: string;
  dryRun?: boolean;
  runCommand?: RunCommand;
};

export function runAdopt(options: AdoptOptions = {}): SetupResult {
  const header = options.dryRun === true ? "framework adopt (dry-run)" : "framework adopt";
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
  const lines: string[] = [header];
  if (workspace.workspace.packageManager !== undefined) {
    lines.push(
      `  package-manager  ${workspace.workspace.packageManager.name}  ${workspace.workspace.packageManager.source}`,
    );
  } else {
    lines.push("  package-manager  undetected  lockfile and packageManager field are absent.");
  }
  for (const note of workspace.workspace.legacy) {
    lines.push(`  existing  ${note.message}`);
  }

  let config = integrationDefaults();
  let configStatus: "write" | "unchanged" | "conflict";
  if (configFile.status === "invalid") {
    return {
      exitCode: 1,
      wrote: false,
      lines: [
        ...lines,
        "  config  conflict  framework.config.json is application-owned or invalid and was left unchanged.",
        ...configFile.errors.map((message) => `  error  ${message}`),
      ],
    };
  }
  if (configFile.status === "missing") {
    configStatus = "write";
  } else {
    const selection = selectCapabilities(loaded.manifest, configFile.config);
    const errors = [
      ...selection.errors,
      ...validateDeploySelection(loaded.manifest, configFile.config, selection.selected),
    ];
    if (errors.length > 0) {
      return {
        exitCode: 1,
        wrote: false,
        lines: [
          ...lines,
          "  config  conflict  framework.config.json is invalid and was left unchanged.",
          ...errors.map((message) => `  error  ${message}`),
        ],
      };
    }
    config = configFile.config;
    configStatus = "unchanged";
  }
  const plans = planSelectedPackages(
    loaded,
    config,
    workspace.workspace.packageJson,
    workspace.workspace.packageManager?.name,
  );
  const writing = options.dryRun !== true;
  if (writing && plans.some((plan) => plan.status === "error")) {
    return {
      exitCode: 1,
      wrote: false,
      lines: [...lines, ...plans.filter((plan) => plan.status === "error").map(formatPlan)],
    };
  }
  lines.push(
    configStatus === "write"
      ? `  config  write  ${CONFIG_FILE}`
      : `  config  unchanged  ${CONFIG_FILE}`,
  );
  let wrote = false;
  if (writing && configStatus === "write") {
    writeFileSync(path.join(cwd, CONFIG_FILE), renderConsumerConfig(config));
    wrote = true;
  }

  const applied = applyCapabilities({ cwd, loaded, config, writing, reportPackages: false });
  if (applied.errors.length > 0) {
    return failAll(header, applied.errors);
  }
  const report: ReportLine[] = applied.lines;
  lines.push(...report.map(formatLine));
  wrote = wrote || applied.wrote;

  for (const plan of plans) {
    lines.push(formatPlan(plan));
    if (!writing || plan.status !== "install" || plan.command === undefined || plan.args === undefined) continue;
    const run = options.runCommand ?? runPackageManager;
    const result = run(plan.command, plan.args, cwd);
    if (result.status !== 0) {
      const message = result.stderr.trim() || result.stdout.trim() || `${plan.command} ${plan.args.join(" ")} failed.`;
      return { exitCode: 1, wrote, lines: [...lines, `  error  ${message}`] };
    }
    wrote = true;
  }

  const devToolsReady = plans.some((plan) => plan.id === "dev-tools" && (plan.status === "install" || plan.status === "unchanged"));
  const scriptPlan = planFrameworkScript(workspace.workspace.packageJson, devToolsReady);
  if (scriptPlan.status !== "skip") {
    if (!writing) {
      lines.push(`  script  ${scriptPlan.status}  ${scriptPlan.message}`);
    } else {
      const written = writeFrameworkScript(cwd);
      lines.push(`  script  ${written.status}  ${written.message}`);
      wrote = wrote || written.status === "write";
    }
  }

  const conflicts = report.some((line) => line.status === "conflict") || plans.some((plan) => plan.status === "error");
  return { exitCode: conflicts ? 1 : 0, wrote, lines };
}

function planSelectedPackages(
  loaded: LoadedManifest,
  config: ConsumerConfig,
  packageJson: Record<string, unknown>,
  manager: PackageManagerName | undefined,
): InstallPlan[] {
  const selection = selectCapabilities(loaded.manifest, config);
  return selectedNpmPackages(loaded.manifest, selection.selected).map((entry) => {
    const capability = loaded.manifest.capabilities.find((item) => item.id === entry.id);
    return planPackageInstall({
      id: entry.id,
      packageName: entry.packageName,
      version: entry.version,
      dependencyField: entry.dependencyField,
      distributionStatus: entry.status,
      dependencies: capability?.dependencies ?? [],
      packageJson,
      manager,
    });
  });
}

function formatPlan(plan: InstallPlan): string {
  return `  ${plan.id}  ${plan.status}  ${plan.message}`;
}

function fail(header: string, message: string): SetupResult {
  return { exitCode: 1, wrote: false, lines: [header, `  error  ${message}`] };
}

function failAll(header: string, errors: readonly string[]): SetupResult {
  return { exitCode: 1, wrote: false, lines: [header, ...errors.map((message) => `  error  ${message}`)] };
}
