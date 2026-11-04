import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  loadCapabilityManifest,
  readSourceCommit,
  workflowRefPattern,
  type Capability,
  type CapabilityManifest,
  type FrameworkAssets,
} from "./capabilities.js";

export const DEPLOY_CALLER_MARKER = "# managed-by: @app-framework/dev-tools deploy-static";
const STANDARDS_SOURCE = "standards/cursor/rules";
const CONFIG_FILE = "framework.config.json";

export type SetupOptions = {
  cwd?: string;
  dryRun?: boolean;
  check?: boolean;
  list?: boolean;
};

export type SetupResult = {
  exitCode: number;
  lines: string[];
  wrote: boolean;
};

type DeploySettings = {
  nodeVersionFile: string;
  installCommand: string;
  buildCommand: string;
  outputDirectory: string;
  entryFile: string;
};

type ConsumerConfig = {
  profile: string;
  capabilities?: Record<string, boolean>;
  workflowRef?: string;
  deploy?: DeploySettings;
};

type ReportLine = {
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
  const command = capability.distribution.dependencyField === "devDependencies" ? "pnpm add -D" : "pnpm add";
  return {
    status: "manual",
    message: `${command} ${capability.distribution.packageName}@^${capability.version}. Setup leaves package.json unchanged.`,
  };
}

export function renderDeployCaller(input: {
  repository: string;
  workflowRef: string;
  deploy: DeploySettings;
}): string {
  const uses = `${input.repository}/.github/workflows/deploy-static.yml@${input.workflowRef}`;
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
    "      vps_host: \"${{ vars.VPS_HOST }}\"",
    "      vps_user: \"${{ vars.VPS_USER }}\"",
    "      deploy_root: \"${{ vars.DEPLOY_ROOT }}\"",
    "      rollback: \"${{ github.event_name == 'workflow_dispatch' && inputs.rollback }}\"",
    `      node_version_file: ${yamlQuote(input.deploy.nodeVersionFile)}`,
    `      install_command: ${yamlQuote(input.deploy.installCommand)}`,
    `      build_command: ${yamlQuote(input.deploy.buildCommand)}`,
    `      output_directory: ${yamlQuote(input.deploy.outputDirectory)}`,
    `      entry_file: ${yamlQuote(input.deploy.entryFile)}`,
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

  let loaded: ReturnType<typeof loadCapabilityManifest>;
  try {
    loaded = loadCapabilityManifest();
  } catch (error) {
    return fail(header, error instanceof Error ? error.message : "Could not load the capability manifest.");
  }
  if (options.list === true) return { exitCode: 0, wrote: false, lines: formatList(loaded.manifest) };

  const cwd = path.resolve(options.cwd ?? process.cwd());
  if (path.resolve(cwd) === path.resolve(loaded.assets.root)) {
    return fail(header, "Refusing to set up the framework repository.");
  }

  const configPath = path.join(cwd, CONFIG_FILE);
  if (!existsSync(configPath)) return fail(header, "Missing framework.config.json.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    return fail(header, "framework.config.json is not valid JSON.");
  }
  const configResult = parseConsumerConfig(parsed);
  if (!configResult.ok) return failAll(header, configResult.errors);

  const selection = selectCapabilities(loaded.manifest, configResult.config);
  const deployErrors = validateDeploySelection(loaded.manifest, configResult.config, selection.selected);
  const errors = [...selection.errors, ...deployErrors];
  if (errors.length > 0) return failAll(header, errors);

  const writing = options.dryRun !== true && options.check !== true;
  const lines: ReportLine[] = [];
  let wrote = false;
  const applicable = loaded.manifest.capabilities
    .filter((capability) => capability.compatibility.profiles.includes(configResult.config.profile))
    .sort((left, right) => left.id.localeCompare(right.id));

  for (const capability of applicable) {
    if (!selection.selected.has(capability.id)) {
      lines.push({ capabilityId: capability.id, status: "off", message: "" });
      continue;
    }
    const actionError = actionableError(capability);
    if (actionError !== undefined) return fail(header, actionError);
    if (capability.distribution.mechanism === "npm") {
      const status = packageSetupStatus(capability);
      lines.push({ capabilityId: capability.id, status: status.status, message: status.message });
      continue;
    }
    if (capability.distribution.mechanism === "file-sync") {
      const standards = planStandards(cwd, loaded.assets, capability.version);
      lines.push({
        capabilityId: capability.id,
        status: standards.status,
        message: standards.status === "write" ? `.cursor/rules/framework version ${capability.version}` : `version ${capability.version}`,
      });
      for (const name of standards.deletes) {
        lines.push({
          capabilityId: capability.id,
          status: "delete",
          message: `.cursor/rules/framework/${name}`,
        });
      }
      if (writing && standards.status === "write") {
        applyStandards(standards);
        wrote = true;
      }
      continue;
    }
    const deploy = configResult.config.deploy;
    const workflowRef = configResult.config.workflowRef;
    if (deploy === undefined || workflowRef === undefined) {
      return fail(header, "deploy-static requires workflowRef and deploy settings.");
    }
    const caller = planCaller(cwd, loaded.manifest.repository, workflowRef, deploy);
    lines.push({ capabilityId: capability.id, status: caller.status, message: caller.message });
    if (writing && caller.status === "write") {
      mkdirSync(path.dirname(caller.file), { recursive: true });
      writeFileSync(caller.file, caller.contents);
      wrote = true;
    }
  }

  return {
    exitCode: 0,
    wrote,
    lines: [header, `  profile  ${configResult.config.profile}`, ...lines.map(formatLine)],
  };
}

function planStandards(
  cwd: string,
  assets: FrameworkAssets,
  version: string,
): {
  status: "write" | "unchanged";
  deletes: string[];
  sourceNames: string[];
  rulesDir: string;
  destDir: string;
  pinPath: string;
  pin: string;
} {
  const rulesDir = path.join(assets.standardsDir, "rules");
  const sourceNames = readdirSync(rulesDir)
    .filter((name) => name.endsWith(".mdc"))
    .sort();
  if (sourceNames.length === 0) throw new Error("No standards rules to copy.");
  const destDir = path.join(cwd, ".cursor", "rules", "framework");
  const pinPath = path.join(cwd, ".cursor", "framework-standards.json");
  const pin = `${JSON.stringify({ version, source: STANDARDS_SOURCE, commit: readSourceCommit(assets) }, null, 2)}\n`;
  const deletes = existingFrameworkFiles(destDir).filter((name) => !sourceNames.includes(name));
  const rulesDiffer = sourceNames.some((name) => !sameFile(path.join(rulesDir, name), path.join(destDir, name)));
  const pinDiffers = !equivalentText(readOptional(pinPath), pin);
  return {
    status: rulesDiffer || pinDiffers || deletes.length > 0 ? "write" : "unchanged",
    deletes,
    sourceNames,
    rulesDir,
    destDir,
    pinPath,
    pin,
  };
}

function applyStandards(plan: ReturnType<typeof planStandards>): void {
  mkdirSync(plan.destDir, { recursive: true });
  for (const name of plan.sourceNames) {
    copyFileSync(path.join(plan.rulesDir, name), path.join(plan.destDir, name));
  }
  writeFileSync(plan.pinPath, plan.pin);
  for (const name of plan.deletes) rmSync(path.join(plan.destDir, name));
}

function planCaller(
  cwd: string,
  repository: string,
  workflowRef: string,
  deploy: DeploySettings,
): { status: "write" | "unchanged" | "preserved"; message: string; file: string; contents: string } {
  const file = path.join(cwd, ".github", "workflows", "deploy.yml");
  const contents = renderDeployCaller({ repository, workflowRef, deploy });
  const current = readOptional(file);
  const message = `.github/workflows/deploy.yml ref ${workflowRef}. Actions can call it after that ref is on GitHub.`;
  if (current === undefined) return { status: "write", message, file, contents };
  if (equivalentText(current, contents)) return { status: "unchanged", message, file, contents };
  if (current.startsWith(`${DEPLOY_CALLER_MARKER}\n`) || current.startsWith(`${DEPLOY_CALLER_MARKER}\r\n`)) {
    return { status: "write", message, file, contents };
  }
  return {
    status: "preserved",
    message: ".github/workflows/deploy.yml is application-owned and was left unchanged.",
    file,
    contents,
  };
}

function selectCapabilities(
  manifest: CapabilityManifest,
  config: ConsumerConfig,
): { selected: Set<string>; errors: string[] } {
  const profile = manifest.profiles.find((item) => item.id === config.profile);
  if (profile === undefined) {
    const known = manifest.profiles.map((item) => `${item.id} (${item.limitations})`).join("; ");
    return { selected: new Set(), errors: [`Profile "${config.profile}" is not implemented. Implemented profiles: ${known}.`] };
  }
  const applicable = manifest.capabilities.filter((capability) => capability.compatibility.profiles.includes(profile.id));
  if (config.capabilities === undefined) {
    return {
      selected: new Set(
        applicable
          .filter((capability) => capability.selectable && (capability.enablement === "mandatory" || capability.enablement === "default-enabled"))
          .map((capability) => capability.id),
      ),
      errors: [],
    };
  }

  const errors: string[] = [];
  const selected = new Set<string>();
  for (const [id, enabled] of Object.entries(config.capabilities)) {
    const capability = manifest.capabilities.find((item) => item.id === id);
    if (capability === undefined) {
      errors.push(`${id} is not an implemented capability.`);
      continue;
    }
    if (!capability.selectable) {
      errors.push(`${id} is maintained in App-Framework and cannot be selected.`);
      continue;
    }
    if (!capability.compatibility.profiles.includes(profile.id)) {
      errors.push(`${id} is not compatible with profile ${profile.id}.`);
      continue;
    }
    if (enabled) selected.add(id);
  }
  for (const capability of applicable) {
    if (capability.enablement === "mandatory" && config.capabilities[capability.id] !== true) {
      errors.push(`${capability.id} is mandatory for profile ${profile.id}.`);
    }
  }
  return { selected, errors };
}

function validateDeploySelection(manifest: CapabilityManifest, config: ConsumerConfig, selected: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  if (!selected.has("deploy-static")) {
    if (config.workflowRef !== undefined) errors.push("workflowRef is set while deploy-static is off.");
    if (config.deploy !== undefined) errors.push("deploy settings are set while deploy-static is off.");
    return errors;
  }
  if (config.workflowRef === undefined) {
    errors.push('deploy-static requires workflowRef. Use "main" to follow the protected default branch, or "deploy-static-vN" to pin a caller contract.');
  } else if (!workflowRefPattern(manifest).test(config.workflowRef)) {
    errors.push(`workflowRef "${config.workflowRef}" is not a supported ref.`);
  }
  if (config.deploy === undefined) {
    errors.push("deploy-static requires deploy settings.");
    return errors;
  }
  if (!isRelativePath(config.deploy.nodeVersionFile)) errors.push("deploy.nodeVersionFile must be a relative path.");
  if (!isRelativePath(config.deploy.outputDirectory)) errors.push("deploy.outputDirectory must be a relative path.");
  if (!isRelativePath(config.deploy.entryFile)) errors.push("deploy.entryFile must be a relative path.");
  if (!isSingleLineCommand(config.deploy.installCommand)) errors.push("deploy.installCommand must be one line.");
  if (!isSingleLineCommand(config.deploy.buildCommand)) errors.push("deploy.buildCommand must be one line.");
  return errors;
}

function parseConsumerConfig(value: unknown): { ok: true; config: ConsumerConfig } | { ok: false; errors: string[] } {
  if (!isRecord(value)) return { ok: false, errors: ["framework.config.json must be an object."] };
  const errors: string[] = [];
  for (const key of Object.keys(value)) {
    if (!["profile", "capabilities", "workflowRef", "deploy"].includes(key)) {
      errors.push(`${key} is not a framework setting.`);
    }
  }
  if (typeof value.profile !== "string" || value.profile.length === 0) errors.push("profile must be a string.");
  let capabilities: Record<string, boolean> | undefined;
  if (value.capabilities !== undefined) {
    if (!isRecord(value.capabilities)) errors.push("capabilities must be an object.");
    else {
      capabilities = {};
      for (const [key, entry] of Object.entries(value.capabilities)) {
        if (typeof entry !== "boolean") errors.push(`capabilities.${key} must be a boolean.`);
        else capabilities[key] = entry;
      }
    }
  }
  let workflowRef: string | undefined;
  if (value.workflowRef !== undefined) {
    if (typeof value.workflowRef !== "string") errors.push("workflowRef must be a string.");
    else workflowRef = value.workflowRef;
  }
  const deploy = parseDeploy(value.deploy, errors);
  if (errors.length > 0 || typeof value.profile !== "string") return { ok: false, errors };
  const config: ConsumerConfig = { profile: value.profile };
  if (capabilities !== undefined) config.capabilities = capabilities;
  if (workflowRef !== undefined) config.workflowRef = workflowRef;
  if (deploy !== undefined) config.deploy = deploy;
  return { ok: true, config };
}

function parseDeploy(value: unknown, errors: string[]): DeploySettings | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    errors.push("deploy must be an object.");
    return undefined;
  }
  const allowed = ["nodeVersionFile", "installCommand", "buildCommand", "outputDirectory", "entryFile"];
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`deploy.${key} is not a deploy setting.`);
  }
  const settings: Partial<DeploySettings> = {};
  for (const key of allowed) {
    const entry = value[key];
    if (typeof entry !== "string") errors.push(`deploy.${key} must be a string.`);
    else settings[key as keyof DeploySettings] = entry;
  }
  if (allowed.some((key) => typeof settings[key as keyof DeploySettings] !== "string")) return undefined;
  return settings as DeploySettings;
}

function actionableError(capability: Capability): string | undefined {
  if (capability.distribution.mechanism === "npm") return undefined;
  if (capability.distribution.mechanism === "file-sync" && capability.id === "cursor-standards") return undefined;
  if (capability.distribution.mechanism === "workflow-call" && capability.id === "deploy-static") return undefined;
  return `${capability.id} has no setup action.`;
}

function formatList(manifest: CapabilityManifest): string[] {
  const lines = ["framework-setup"];
  for (const capability of [...manifest.capabilities].sort((left, right) => left.id.localeCompare(right.id))) {
    const selectable = capability.selectable ? "selectable" : "not-selectable";
    lines.push(
      `  ${capability.id}  ${capability.type}  ${capability.enablement}  ${capability.distribution.status}  ${selectable}  ${capability.purpose}`,
    );
  }
  return lines;
}

function formatLine(line: ReportLine): string {
  return line.message.length === 0
    ? `  ${line.capabilityId}  ${line.status}`
    : `  ${line.capabilityId}  ${line.status}  ${line.message}`;
}

function headerFor(options: SetupOptions): string {
  if (options.dryRun === true) return "framework-setup (dry-run)";
  if (options.check === true) return "framework-setup (check)";
  return "framework-setup";
}

function fail(header: string, message: string): SetupResult {
  return { exitCode: 1, wrote: false, lines: [header, `  error  ${message}`] };
}

function failAll(header: string, errors: readonly string[]): SetupResult {
  return { exitCode: 1, wrote: false, lines: [header, ...errors.map((message) => `  error  ${message}`)] };
}

function existingFrameworkFiles(destDir: string): string[] {
  if (!existsSync(destDir)) return [];
  return readdirSync(destDir).filter((name) => statSync(path.join(destDir, name)).isFile());
}

function sameFile(source: string, target: string): boolean {
  if (!existsSync(target)) return false;
  return readFileSync(source).equals(readFileSync(target));
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

function isRelativePath(value: string): boolean {
  return (
    /^[A-Za-z0-9._/-]+$/.test(value) &&
    !value.includes("..") &&
    !value.startsWith("/") &&
    value !== "." &&
    !value.endsWith("/")
  );
}

function isSingleLineCommand(value: string): boolean {
  return value.length > 0 && !value.includes("\n") && !value.includes("\r") && !value.includes("${{") && !value.includes("\0");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
