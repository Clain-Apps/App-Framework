import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { workflowRefPattern, type Capability, type CapabilityManifest } from "./capabilities.js";

export const CONFIG_FILE = "framework.config.json";
export const DEPLOY_CALLER_MARKER = "# managed-by: @app-framework/dev-tools deploy";
export const LEGACY_DEPLOY_CALLER_MARKER = "# managed-by: @app-framework/dev-tools deploy-static";
export const DEPLOY_CAPABILITY_ID = "deploy";
export const LEGACY_DEPLOY_CAPABILITY_ID = "deploy-static";

export const WORKFLOW_PROFILES = {
  "static-web": "static",
  "node-server": "node",
  "next-standalone": "next-standalone",
} as const;

export type WorkflowProfile = (typeof WORKFLOW_PROFILES)[keyof typeof WORKFLOW_PROFILES];

export type DeploySettings = {
  nodeVersionFile: string;
  installCommand: string;
  buildCommand: string;
  outputDirectory: string;
  entryFile: string;
  appName?: string;
  allowRoot?: boolean;
  systemdUnit?: string;
  healthcheckUrl?: string;
  healthcheckTimeout?: string;
};

export type ConsumerConfig = {
  profile?: string;
  capabilities?: Record<string, boolean>;
  workflowRef?: string;
  deploy?: DeploySettings;
};

export type ConfigReadResult =
  | { status: "missing" }
  | { status: "invalid"; errors: string[] }
  | { status: "ok"; config: ConsumerConfig; text: string };

export function readConsumerConfig(cwd: string): ConfigReadResult {
  const file = path.join(cwd, CONFIG_FILE);
  if (!existsSync(file)) return { status: "missing" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { status: "invalid", errors: ["framework.config.json is not valid JSON."] };
  }
  const result = parseConsumerConfig(parsed);
  if (!result.ok) return { status: "invalid", errors: result.errors };
  return { status: "ok", config: result.config, text: readFileSync(file, "utf8") };
}

export function parseConsumerConfig(value: unknown): { ok: true; config: ConsumerConfig } | { ok: false; errors: string[] } {
  if (!isRecord(value)) return { ok: false, errors: ["framework.config.json must be an object."] };
  const errors: string[] = [];
  for (const key of Object.keys(value)) {
    if (!["profile", "capabilities", "workflowRef", "deploy"].includes(key)) {
      errors.push(`${key} is not a framework setting.`);
    }
  }
  let profile: string | undefined;
  if (value.profile !== undefined) {
    if (typeof value.profile !== "string" || value.profile.length === 0) errors.push("profile must be a string.");
    else profile = value.profile;
  }
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
  if (errors.length > 0) return { ok: false, errors };
  const config: ConsumerConfig = {};
  if (profile !== undefined) config.profile = profile;
  if (capabilities !== undefined) config.capabilities = capabilities;
  if (workflowRef !== undefined) config.workflowRef = workflowRef;
  if (deploy !== undefined) config.deploy = deploy;
  return { ok: true, config };
}

export function integrationDefaults(): ConsumerConfig {
  return {
    capabilities: {
      "app-config": true,
      "cursor-standards": true,
      "dev-tools": true,
      ui: true,
    },
  };
}

export function renderConsumerConfig(config: ConsumerConfig): string {
  const body: Record<string, unknown> = {};
  if (config.profile !== undefined) body.profile = config.profile;
  if (config.capabilities !== undefined) {
    body.capabilities = Object.fromEntries(
      Object.entries(config.capabilities).sort(([left], [right]) => left.localeCompare(right)),
    );
  }
  if (config.workflowRef !== undefined) body.workflowRef = config.workflowRef;
  if (config.deploy !== undefined) body.deploy = config.deploy;
  return `${JSON.stringify(body, null, 2)}\n`;
}

export function canonicalCapabilityId(id: string): string {
  return id === LEGACY_DEPLOY_CAPABILITY_ID ? DEPLOY_CAPABILITY_ID : id;
}

export function isManagedDeployCaller(text: string): boolean {
  const normalized = text.replaceAll("\r\n", "\n");
  return (
    normalized.startsWith(`${DEPLOY_CALLER_MARKER}\n`) ||
    normalized.startsWith(`${LEGACY_DEPLOY_CALLER_MARKER}\n`)
  );
}

export function workflowProfile(profile: string): WorkflowProfile | undefined {
  if (profile === "static-web" || profile === "node-server" || profile === "next-standalone") {
    return WORKFLOW_PROFILES[profile];
  }
  return undefined;
}

export function isCapabilityCompatible(capability: Capability, profile: string | undefined): boolean {
  if (capability.compatibility.profiles.length === 0) return true;
  return profile !== undefined && capability.compatibility.profiles.includes(profile);
}

export function selectCapabilities(
  manifest: CapabilityManifest,
  config: ConsumerConfig,
): { selected: Set<string>; errors: string[] } {
  if (config.profile !== undefined) {
    const profile = manifest.profiles.find((item) => item.id === config.profile);
    if (profile === undefined) {
      const known = manifest.profiles.map((item) => `${item.id} (${item.limitations})`).join("; ");
      return { selected: new Set(), errors: [`Profile "${config.profile}" is not implemented. Implemented profiles: ${known}.`] };
    }
  }

  const applicable = selectableCapabilities(manifest, config.profile);
  if (config.capabilities === undefined) {
    const selected = new Set(
      applicable
        .filter((capability) => capability.enablement === "mandatory" || capability.enablement === "default-enabled")
        .map((capability) => capability.id),
    );
    if (deploySettingsPresent(config) && applicable.some((capability) => capability.id === DEPLOY_CAPABILITY_ID)) {
      selected.add(DEPLOY_CAPABILITY_ID);
    }
    return { selected, errors: [] };
  }

  const errors: string[] = [];
  const declared = canonicalizeCapabilityFlags(config.capabilities, errors);
  const selected = new Set<string>();
  for (const [id, enabled] of Object.entries(declared)) {
    const capability = manifest.capabilities.find((item) => item.id === id);
    if (capability === undefined) {
      errors.push(`${id} is not an implemented capability.`);
      continue;
    }
    if (!capability.selectable) {
      errors.push(`${id} is maintained in App-Framework and cannot be selected.`);
      continue;
    }
    if (!isCapabilityCompatible(capability, config.profile)) {
      if (!enabled) continue;
      if (capability.compatibility.profiles.length > 0 && config.profile === undefined) {
        errors.push(`${id} requires a deploy profile (${capability.compatibility.profiles.join(", ")}).`);
        continue;
      }
      errors.push(`${id} is not compatible with profile ${config.profile}.`);
      continue;
    }
    if (enabled) selected.add(id);
  }
  if (
    declared[DEPLOY_CAPABILITY_ID] === undefined &&
    deploySettingsPresent(config) &&
    applicable.some((capability) => capability.id === DEPLOY_CAPABILITY_ID)
  ) {
    selected.add(DEPLOY_CAPABILITY_ID);
  }
  for (const capability of applicable) {
    if (capability.enablement === "mandatory" && declared[capability.id] !== true) {
      errors.push(
        config.profile === undefined
          ? `${capability.id} is mandatory.`
          : `${capability.id} is mandatory for profile ${config.profile}.`,
      );
    }
  }
  return { selected, errors };
}

export function selectableCapabilities(manifest: CapabilityManifest, profile: string | undefined): Capability[] {
  return manifest.capabilities.filter(
    (capability) => capability.selectable && isCapabilityCompatible(capability, profile),
  );
}

export function validateDeploySelection(
  manifest: CapabilityManifest,
  config: ConsumerConfig,
  selected: ReadonlySet<string>,
): string[] {
  const errors: string[] = [];
  if (!selected.has(DEPLOY_CAPABILITY_ID)) {
    if (config.workflowRef !== undefined) errors.push("workflowRef is set while deploy is off.");
    if (config.deploy !== undefined) errors.push("deploy settings are set while deploy is off.");
    return errors;
  }
  const profile = workflowProfile(config.profile ?? "");
  if (profile === undefined) {
    errors.push('deploy requires profile "static-web", "node-server", or "next-standalone".');
  }
  if (config.workflowRef === undefined) {
    errors.push(
      'deploy requires workflowRef. Use "main" to follow the protected default branch, "deploy-vN" to pin the current contract, or "deploy-static-vN" only for a frozen static caller.',
    );
  } else if (!workflowRefPattern(manifest).test(config.workflowRef)) {
    errors.push(`workflowRef "${config.workflowRef}" is not a supported ref.`);
  } else if (config.workflowRef.startsWith("deploy-static-v") && profile !== "static") {
    errors.push("deploy-static-vN pins the frozen static workflow and cannot deploy a server profile.");
  }
  if (config.deploy === undefined) {
    errors.push("deploy requires deploy settings.");
    return errors;
  }
  if (!isRelativePath(config.deploy.nodeVersionFile)) errors.push("deploy.nodeVersionFile must be a relative path.");
  if (!isRelativePath(config.deploy.outputDirectory)) errors.push("deploy.outputDirectory must be a relative path.");
  if (!isRelativePath(config.deploy.entryFile)) errors.push("deploy.entryFile must be a relative path.");
  if (!isSingleLineCommand(config.deploy.installCommand)) errors.push("deploy.installCommand must be one line.");
  if (!isSingleLineCommand(config.deploy.buildCommand)) errors.push("deploy.buildCommand must be one line.");
  if (config.deploy.appName !== undefined && !isAppName(config.deploy.appName)) {
    errors.push("deploy.appName must be one safe path segment and cannot be a reserved directory.");
  }
  if (profile === "node" || profile === "next-standalone") {
    if (config.deploy.systemdUnit === undefined || !isSystemdUnit(config.deploy.systemdUnit)) {
      errors.push("deploy.systemdUnit must be a single .service name.");
    }
    if (config.deploy.healthcheckUrl === undefined || !isHealthcheckUrl(config.deploy.healthcheckUrl)) {
      errors.push("deploy.healthcheckUrl must be an http or https URL.");
    }
  } else {
    if (config.deploy.systemdUnit !== undefined) errors.push("deploy.systemdUnit is only used by server profiles.");
    if (config.deploy.healthcheckUrl !== undefined) errors.push("deploy.healthcheckUrl is only used by server profiles.");
    if (config.deploy.healthcheckTimeout !== undefined) {
      errors.push("deploy.healthcheckTimeout is only used by server profiles.");
    }
  }
  if (config.deploy.healthcheckTimeout !== undefined && !isHealthcheckTimeout(config.deploy.healthcheckTimeout)) {
    errors.push("deploy.healthcheckTimeout must be seconds.");
  }
  return errors;
}

export function selectedNpmPackages(
  manifest: CapabilityManifest,
  selected: ReadonlySet<string>,
): Array<{ id: string; packageName: string; version: string; dependencyField: "dependencies" | "devDependencies"; status: "unpublished" | "available" }> {
  const packages: Array<{
    id: string;
    packageName: string;
    version: string;
    dependencyField: "dependencies" | "devDependencies";
    status: "unpublished" | "available";
  }> = [];
  for (const capability of manifest.capabilities) {
    if (!selected.has(capability.id) || capability.distribution.mechanism !== "npm") continue;
    packages.push({
      id: capability.id,
      packageName: capability.distribution.packageName,
      version: capability.version,
      dependencyField: capability.distribution.dependencyField,
      status: capability.distribution.status,
    });
  }
  return packages;
}

export function enableCapability(
  manifest: CapabilityManifest,
  config: ConsumerConfig,
  id: string,
): ConsumerConfig {
  const requested = canonicalCapabilityId(id);
  const capabilities: Record<string, boolean> = { ...(config.capabilities ?? {}) };
  if (config.capabilities === undefined) {
    for (const selected of selectCapabilities(manifest, config).selected) capabilities[selected] = true;
  }
  delete capabilities[LEGACY_DEPLOY_CAPABILITY_ID];
  capabilities[requested] = true;
  return { ...config, capabilities };
}

function canonicalizeCapabilityFlags(
  capabilities: Record<string, boolean>,
  errors: string[],
): Record<string, boolean> {
  const declared: Record<string, boolean> = {};
  for (const [id, enabled] of Object.entries(capabilities)) {
    const canonical = canonicalCapabilityId(id);
    const existing = declared[canonical];
    if (existing !== undefined && existing !== enabled) {
      errors.push("deploy-static is an alias of deploy and cannot disagree with it.");
      continue;
    }
    declared[canonical] = enabled;
  }
  return declared;
}

function deploySettingsPresent(config: ConsumerConfig): boolean {
  return config.workflowRef !== undefined || config.deploy !== undefined;
}

function parseDeploy(value: unknown, errors: string[]): DeploySettings | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    errors.push("deploy must be an object.");
    return undefined;
  }
  const required = ["nodeVersionFile", "installCommand", "buildCommand", "outputDirectory", "entryFile"] as const;
  const optional = ["appName", "systemdUnit", "healthcheckUrl", "healthcheckTimeout"] as const;
  for (const key of Object.keys(value)) {
    if (![...required, ...optional, "allowRoot"].includes(key)) errors.push(`deploy.${key} is not a deploy setting.`);
  }
  const settings: Partial<DeploySettings> = {};
  for (const key of required) {
    const entry = value[key];
    if (typeof entry !== "string") errors.push(`deploy.${key} must be a string.`);
    else settings[key] = entry;
  }
  for (const key of optional) {
    const entry = value[key];
    if (entry === undefined) continue;
    if (typeof entry !== "string") errors.push(`deploy.${key} must be a string.`);
    else settings[key] = entry;
  }
  if (value.allowRoot !== undefined) {
    if (typeof value.allowRoot !== "boolean") errors.push("deploy.allowRoot must be a boolean.");
    else settings.allowRoot = value.allowRoot;
  }
  if (required.some((key) => typeof settings[key] !== "string")) return undefined;
  return settings as DeploySettings;
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

function isAppName(value: string): boolean {
  if (!/^[A-Za-z0-9_][A-Za-z0-9._-]{0,99}$/.test(value)) return false;
  return !["releases", "current", "previous", "shared"].includes(value);
}

function isSystemdUnit(value: string): boolean {
  return /^[A-Za-z0-9:_.-]+\.service$/.test(value);
}

function isHealthcheckUrl(value: string): boolean {
  return /^https?:\/\/[A-Za-z0-9._~:/%?#@=-]+$/.test(value);
}

function isHealthcheckTimeout(value: string): boolean {
  return /^[1-9][0-9]{0,2}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
