import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadCapabilityManifest, type LoadedManifest } from "./capabilities.js";
import {
  DEPLOY_CAPABILITY_ID,
  isManagedDeployCaller,
  readConsumerConfig,
  selectCapabilities,
  validateDeploySelection,
} from "./config.js";
import { formatLine, planCaller, type SetupResult } from "./setup.js";

export type DeployEnableOptions = {
  cwd?: string;
  dryRun?: boolean;
  approveSwitch?: boolean;
};

const WORKFLOW_DIR = path.join(".github", "workflows");
const ARCHIVE_DIR = path.join(".github", "workflow-archive");

export function runDeployEnable(options: DeployEnableOptions = {}): SetupResult {
  const header = options.dryRun === true ? "framework deploy enable (dry-run)" : "framework deploy enable";
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

  const configFile = readConsumerConfig(cwd);
  if (configFile.status === "missing") return fail(header, "Missing framework.config.json.");
  if (configFile.status === "invalid") return failAll(header, configFile.errors);

  const selection = selectCapabilities(loaded.manifest, configFile.config);
  const errors = [...selection.errors, ...validateDeploySelection(loaded.manifest, configFile.config, selection.selected)];
  if (errors.length > 0) return failAll(header, errors);
  if (!selection.selected.has(DEPLOY_CAPABILITY_ID)) {
    return fail(header, "deploy is not selected. Set a deploy profile, workflowRef, and deploy settings first.");
  }

  const deploy = configFile.config.deploy;
  const workflowRef = configFile.config.workflowRef;
  const profile = configFile.config.profile;
  if (deploy === undefined || workflowRef === undefined || profile === undefined) {
    return fail(header, "deploy requires workflowRef, profile, and deploy settings.");
  }

  const caller = planCaller(cwd, loaded.manifest.repository, workflowRef, profile, deploy);
  const conflicts = findDeployConflicts(cwd, caller.file);
  const lines = [
    header,
    `  profile  ${profile}`,
    formatLine({ capabilityId: DEPLOY_CAPABILITY_ID, status: caller.status, message: caller.message }),
  ];

  if (conflicts.length > 0) {
    for (const conflict of conflicts) {
      lines.push(`  conflict  ${toPosix(conflict.relative)}  ${conflict.reason}`);
    }
    if (options.approveSwitch !== true) {
      lines.push("  error  A legacy deploy workflow is still active. Re-run with --approve-switch to archive it after reviewing this report.");
      return { exitCode: 1, wrote: false, lines };
    }
    for (const conflict of conflicts) {
      const archived = archivePath(cwd, conflict.relative);
      lines.push(`  archive  ${toPosix(conflict.relative)}  ${toPosix(path.relative(cwd, archived))}`);
    }
  }

  if (options.dryRun === true) {
    if (caller.status !== "unchanged") {
      lines.push(`  write  ${toPosix(path.relative(cwd, caller.file))} ref ${workflowRef}`);
    }
    return { exitCode: 0, wrote: false, lines };
  }

  if (options.approveSwitch === true) {
    for (const conflict of conflicts) {
      const archived = archivePath(cwd, conflict.relative);
      mkdirSync(path.dirname(archived), { recursive: true });
      renameSync(conflict.absolute, archived);
    }
  }

  const current = existsSync(caller.file) ? readFileSync(caller.file, "utf8") : undefined;
  if (current !== undefined && equivalentText(current, caller.contents)) {
    return { exitCode: 0, wrote: false, lines };
  }

  mkdirSync(path.dirname(caller.file), { recursive: true });
  writeFileSync(caller.file, caller.contents);
  lines.push(`  write  ${toPosix(path.relative(cwd, caller.file))} ref ${workflowRef}`);
  return { exitCode: 0, wrote: true, lines };
}

function findDeployConflicts(cwd: string, callerFile: string): Array<{ absolute: string; relative: string; reason: string }> {
  const workflowDir = path.join(cwd, WORKFLOW_DIR);
  if (!existsSync(workflowDir) || !statSync(workflowDir).isDirectory()) return [];
  const conflicts: Array<{ absolute: string; relative: string; reason: string }> = [];
  for (const name of readdirSync(workflowDir).sort()) {
    if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
    const absolute = path.join(workflowDir, name);
    if (!statSync(absolute).isFile()) continue;
    const relative = path.join(WORKFLOW_DIR, name);
    const text = readFileSync(absolute, "utf8");
    if (path.resolve(absolute) === path.resolve(callerFile) && isManagedDeployCaller(text)) continue;
    if (!looksLikeDeployWorkflow(name, text)) continue;
    const reason = isManagedDeployCaller(text)
      ? "another managed deploy caller would stay active"
      : "an application-owned or legacy deploy workflow is still active";
    conflicts.push({ absolute, relative, reason });
  }
  return conflicts;
}

function looksLikeDeployWorkflow(name: string, text: string): boolean {
  if (/deploy/i.test(name)) return true;
  if (text.includes("App-Framework/.github/workflows/deploy")) return true;
  if (text.includes("deploy-static.yml")) return true;
  if (text.includes("vars.DEPLOY_ROOT") && text.includes("rsync")) return true;
  return false;
}

function archivePath(cwd: string, relativeWorkflow: string): string {
  const base = path.join(cwd, ARCHIVE_DIR, path.basename(relativeWorkflow));
  if (!existsSync(base)) return base;
  let index = 2;
  while (existsSync(`${base}.${index}`)) index += 1;
  return `${base}.${index}`;
}

function equivalentText(current: string, next: string): boolean {
  return current.replaceAll("\r\n", "\n") === next.replaceAll("\r\n", "\n");
}

function toPosix(relative: string): string {
  return relative.replaceAll("\\", "/");
}

function fail(header: string, message: string): SetupResult {
  return { exitCode: 1, wrote: false, lines: [header, `  error  ${message}`] };
}

function failAll(header: string, errors: readonly string[]): SetupResult {
  return { exitCode: 1, wrote: false, lines: [header, ...errors.map((message) => `  error  ${message}`)] };
}
