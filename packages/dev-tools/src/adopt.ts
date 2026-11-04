import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadCapabilityManifest, type LoadedManifest } from "./capabilities.js";
import {
  CONFIG_FILE,
  integrationDefaults,
  readConsumerConfig,
  renderConsumerConfig,
  selectCapabilities,
  validateDeploySelection,
} from "./config.js";
import { applyCapabilities, formatLine, type ReportLine, type SetupResult } from "./setup.js";
import { readWorkspace } from "./workspace.js";

export type AdoptOptions = {
  cwd?: string;
  dryRun?: boolean;
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
  lines.push(
    configStatus === "write"
      ? `  config  write  ${CONFIG_FILE}`
      : `  config  unchanged  ${CONFIG_FILE}`,
  );

  const writing = options.dryRun !== true;
  let wrote = false;
  if (writing && configStatus === "write") {
    writeFileSync(path.join(cwd, CONFIG_FILE), renderConsumerConfig(config));
    wrote = true;
  }

  const applied = applyCapabilities({ cwd, loaded, config, writing });
  if (applied.errors.length > 0) {
    if (writing && configStatus === "write" && existsSync(path.join(cwd, CONFIG_FILE)) && !applied.wrote) {
      // Keep the new config; the selection itself was valid. Surface apply errors.
    }
    return failAll(header, applied.errors);
  }
  const report: ReportLine[] = applied.lines;
  lines.push(...report.map(formatLine));
  wrote = wrote || applied.wrote;

  const conflicts = report.some((line) => line.status === "conflict");
  return { exitCode: conflicts ? 1 : 0, wrote, lines };
}

function fail(header: string, message: string): SetupResult {
  return { exitCode: 1, wrote: false, lines: [header, `  error  ${message}`] };
}

function failAll(header: string, errors: readonly string[]): SetupResult {
  return { exitCode: 1, wrote: false, lines: [header, ...errors.map((message) => `  error  ${message}`)] };
}
