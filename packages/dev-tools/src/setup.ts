import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { loadCapabilityManifest, type Capability, type CapabilityManifest, type LoadedManifest } from "./capabilities.js";
import {
  DEPLOY_CALLER_MARKER,
  DEPLOY_CAPABILITY_ID,
  isManagedDeployCaller,
  readConsumerConfig,
  selectCapabilities,
  selectableCapabilities,
  validateDeploySelection,
  workflowProfile,
  type ConsumerConfig,
  type DeploySettings,
} from "./config.js";
import { applyStandards, planStandards } from "./standards.js";

export { DEPLOY_CALLER_MARKER };

export type SetupOptions = {
  cwd?: string;
  dryRun?: boolean;
  check?: boolean;
  list?: boolean;
  command?: string;
};

export type SetupResult = {
  exitCode: number;
  lines: string[];
  wrote: boolean;
};

export type ReportLine = {
  capabilityId: string;
  status: string;
  message: string;
};

export function packageSetupStatus(capability: Capability): { status: "blocked" | "manual"; message: string } {
  if (capability.distribution.mechanism !== "npm") {
    throw new Error(`${capability.id} is not an npm package.`);
  }
  const spec = `${capability.distribution.packageName}@${capability.version}`;
  if (capability.distribution.status === "unpublished") {
    const requires =
      capability.dependencies.length === 0 ? "" : ` and requires ${capability.dependencies.join(", ")}`;
    return { status: "blocked", message: `${spec} is unpublished${requires}. No dependency was added.` };
  }
  return {
    status: "manual",
    message: `${spec} is available. framework adopt installs it with the application's package manager. Setup leaves package.json unchanged.`,
  };
}

export function renderDeployCaller(input: {
  repository: string;
  workflowRef: string;
  profile: string;
  deploy: DeploySettings;
}): string {
  const workflowFile = input.workflowRef.startsWith("deploy-static-v") ? "deploy-static.yml" : "deploy.yml";
  const uses = `${input.repository}/.github/workflows/${workflowFile}@${input.workflowRef}`;
  const withLines = [
    "      vps_host: \"${{ vars.VPS_HOST }}\"",
    "      vps_user: \"${{ vars.VPS_USER }}\"",
    "      deploy_root: \"${{ vars.DEPLOY_ROOT }}\"",
    "      rollback: \"${{ github.event_name == 'workflow_dispatch' && inputs.rollback }}\"",
  ];
  if (!input.workflowRef.startsWith("deploy-static-v")) {
    const profile = workflowProfile(input.profile);
    if (profile === undefined) throw new Error(`Profile "${input.profile}" has no workflow mapping.`);
    withLines.splice(0, 0, `      profile: ${profile}`);
    if (input.deploy.appName !== undefined) {
      withLines.push(`      app_name: ${yamlQuote(input.deploy.appName)}`);
    }
    if (input.deploy.allowRoot === true) withLines.push("      allow_root: true");
    if (input.deploy.systemdUnit !== undefined) {
      withLines.push(`      systemd_unit: ${yamlQuote(input.deploy.systemdUnit)}`);
    }
    if (input.deploy.healthcheckUrl !== undefined) {
      withLines.push(`      healthcheck_url: ${yamlQuote(input.deploy.healthcheckUrl)}`);
    }
    if (input.deploy.healthcheckTimeout !== undefined) {
      withLines.push(`      healthcheck_timeout: ${yamlQuote(input.deploy.healthcheckTimeout)}`);
    }
  }
  withLines.push(
    `      node_version_file: ${yamlQuote(input.deploy.nodeVersionFile)}`,
    `      install_command: ${yamlQuote(input.deploy.installCommand)}`,
    `      build_command: ${yamlQuote(input.deploy.buildCommand)}`,
    `      output_directory: ${yamlQuote(input.deploy.outputDirectory)}`,
    `      entry_file: ${yamlQuote(input.deploy.entryFile)}`,
  );
  return [
    DEPLOY_CALLER_MARKER,
    "name: Deploy",
    "",
    "on:",
    "  push:",
    "    branches: [main]",
    "  workflow_dispatch:",
    "    inputs:",
    "      rollback:",
    "        description: Repoint current at the previous release",
    "        required: false",
    "        type: boolean",
    "        default: false",
    "",
    "permissions:",
    "  contents: read",
    "",
    "jobs:",
    "  deploy:",
    "    permissions:",
    "      contents: read",
    `    uses: ${uses}`,
    "    with:",
    ...withLines,
    "    secrets:",
    "      VPS_SSH_KEY: \"${{ secrets.VPS_SSH_KEY }}\"",
    "      VPS_KNOWN_HOSTS: \"${{ secrets.VPS_KNOWN_HOSTS }}\"",
    "",
  ].join("\n");
}

export function runSetup(options: SetupOptions = {}): SetupResult {
  const header = headerFor(options);
  if (options.list === true && (options.dryRun === true || options.check === true)) {
    return fail(header, "Use only one of --dry-run, --check, or --list.");
  }
  if (options.dryRun === true && options.check === true) {
    return fail(header, "Use either --dry-run or --check.");
  }

  let loaded: LoadedManifest;
  try {
    loaded = loadCapabilityManifest();
  } catch (error) {
    return fail(header, error instanceof Error ? error.message : "Could not load the capability manifest.");
  }
  if (options.list === true) return { exitCode: 0, wrote: false, lines: formatList(loaded.manifest, header) };

  const cwd = path.resolve(options.cwd ?? process.cwd());
  if (path.resolve(cwd) === path.resolve(loaded.assets.root)) {
    return fail(header, "Refusing to set up the framework repository.");
  }

  const configFile = readConsumerConfig(cwd);
  if (configFile.status === "missing") return fail(header, "Missing framework.config.json.");
  if (configFile.status === "invalid") return failAll(header, configFile.errors);

  const applied = applyCapabilities({
    cwd,
    loaded,
    config: configFile.config,
    writing: options.dryRun !== true && options.check !== true,
  });
  if (applied.errors.length > 0) return failAll(header, applied.errors);

  return {
    exitCode: applied.lines.some((line) => line.status === "conflict") ? 1 : 0,
    wrote: applied.wrote,
    lines: [header, `  profile  ${configFile.config.profile ?? "none"}`, ...applied.lines.map(formatLine)],
  };
}

export function applyCapabilities(input: {
  cwd: string;
  loaded: LoadedManifest;
  config: ConsumerConfig;
  writing: boolean;
  reportPackages?: boolean;
}): { lines: ReportLine[]; wrote: boolean; errors: string[] } {
  const selection = selectCapabilities(input.loaded.manifest, input.config);
  const errors = [
    ...selection.errors,
    ...validateDeploySelection(input.loaded.manifest, input.config, selection.selected),
  ];
  if (errors.length > 0) return { lines: [], wrote: false, errors };

  const lines: ReportLine[] = [];
  let wrote = false;
  const applicable = selectableCapabilities(input.loaded.manifest, input.config.profile).sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  for (const capability of applicable) {
    if (!selection.selected.has(capability.id)) {
      lines.push({ capabilityId: capability.id, status: "off", message: "" });
      continue;
    }
    const actionError = actionableError(capability);
    if (actionError !== undefined) return { lines, wrote, errors: [actionError] };
    if (capability.distribution.mechanism === "npm") {
      if (input.reportPackages === false) continue;
      const status = packageSetupStatus(capability);
      lines.push({ capabilityId: capability.id, status: status.status, message: status.message });
      continue;
    }
    if (capability.distribution.mechanism === "file-sync") {
      const destDir = path.join(input.cwd, ".cursor", "rules", "framework");
      if (existsSync(destDir) && !directoryReady(destDir)) {
        lines.push({
          capabilityId: capability.id,
          status: "conflict",
          message: ".cursor/rules/framework exists and is not a directory.",
        });
        continue;
      }
      const standards = planStandards(input.cwd, input.loaded.assets, capability.version);
      lines.push({
        capabilityId: capability.id,
        status: standards.status,
        message:
          standards.status === "write"
            ? `.cursor/rules/framework version ${capability.version}`
            : `version ${capability.version}`,
      });
      for (const name of standards.deletes) {
        lines.push({
          capabilityId: capability.id,
          status: "delete",
          message: `.cursor/rules/framework/${name}`,
        });
      }
      if (input.writing && standards.status === "write") {
        applyStandards(standards);
        wrote = true;
      }
      continue;
    }
    if (capability.distribution.mechanism !== "workflow-call" || capability.id !== DEPLOY_CAPABILITY_ID) {
      return { lines, wrote, errors: [`${capability.id} has no setup action.`] };
    }
    const deploy = input.config.deploy;
    const workflowRef = input.config.workflowRef;
    const profile = input.config.profile;
    if (deploy === undefined || workflowRef === undefined || profile === undefined) {
      return { lines, wrote, errors: ["deploy requires workflowRef, profile, and deploy settings."] };
    }
    const caller = planCaller(input.cwd, input.loaded.manifest.repository, workflowRef, profile, deploy);
    lines.push({ capabilityId: capability.id, status: caller.status, message: caller.message });
  }

  return { lines, wrote, errors: [] };
}

export function planCaller(
  cwd: string,
  repository: string,
  workflowRef: string,
  profile: string,
  deploy: DeploySettings,
): { status: "pending" | "unchanged" | "conflict"; message: string; file: string; contents: string } {
  const file = path.join(cwd, ".github", "workflows", "deploy.yml");
  const contents = renderDeployCaller({ repository, workflowRef, profile, deploy });
  const current = readOptional(file);
  if (current === undefined) {
    return {
      status: "pending",
      message: "Run framework deploy enable to write .github/workflows/deploy.yml. Adoption does not deploy.",
      file,
      contents,
    };
  }
  if (equivalentText(current, contents)) {
    return {
      status: "unchanged",
      message: `.github/workflows/deploy.yml ref ${workflowRef}.`,
      file,
      contents,
    };
  }
  if (isManagedDeployCaller(current)) {
    return {
      status: "pending",
      message: "The managed deploy caller differs. Run framework deploy enable to update it.",
      file,
      contents,
    };
  }
  return {
    status: "conflict",
    message: ".github/workflows/deploy.yml is application-owned. Run framework deploy enable --dry-run.",
    file,
    contents,
  };
}

function actionableError(capability: Capability): string | undefined {
  if (capability.distribution.mechanism === "npm") return undefined;
  if (capability.distribution.mechanism === "file-sync" && capability.id === "cursor-standards") return undefined;
  if (capability.distribution.mechanism === "workflow-call" && capability.id === DEPLOY_CAPABILITY_ID) return undefined;
  return `${capability.id} has no setup action.`;
}

function formatList(manifest: CapabilityManifest, header: string): string[] {
  const lines = [header];
  for (const capability of [...manifest.capabilities].sort((left, right) => left.id.localeCompare(right.id))) {
    const selectable = capability.selectable ? "selectable" : "not-selectable";
    lines.push(
      `  ${capability.id}  ${capability.type}  ${capability.enablement}  ${capability.distribution.status}  ${selectable}  ${capability.purpose}`,
    );
  }
  return lines;
}

export function formatLine(line: ReportLine): string {
  return line.message.length === 0
    ? `  ${line.capabilityId}  ${line.status}`
    : `  ${line.capabilityId}  ${line.status}  ${line.message}`;
}

function headerFor(options: SetupOptions): string {
  const command = options.command ?? "framework-setup";
  if (options.dryRun === true) return `${command} (dry-run)`;
  if (options.check === true) return `${command} (check)`;
  return command;
}

function fail(header: string, message: string): SetupResult {
  return { exitCode: 1, wrote: false, lines: [header, `  error  ${message}`] };
}

function failAll(header: string, errors: readonly string[]): SetupResult {
  return { exitCode: 1, wrote: false, lines: [header, ...errors.map((message) => `  error  ${message}`)] };
}

function directoryReady(destDir: string): boolean {
  try {
    return statSync(destDir).isDirectory();
  } catch {
    return false;
  }
}

function equivalentText(current: string | undefined, next: string): boolean {
  if (current === undefined) return false;
  return current.replaceAll("\r\n", "\n") === next.replaceAll("\r\n", "\n");
}

function readOptional(file: string): string | undefined {
  if (!existsSync(file)) return undefined;
  return readFileSync(file, "utf8");
}

function yamlQuote(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
