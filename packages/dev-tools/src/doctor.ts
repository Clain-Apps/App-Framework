import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { loadCapabilityManifest, type LoadedManifest } from "./capabilities.js";
import { installedPackageVersion, latestPackageVersions, type CheckOptions } from "./check.js";
import {
  DEPLOY_CAPABILITY_ID,
  readConsumerConfig,
  selectCapabilities,
  selectedNpmPackages,
  validateDeploySelection,
  type ConsumerConfig,
} from "./config.js";
import { planCaller } from "./setup.js";
import { planStandards } from "./standards.js";
import { readWorkspace } from "./workspace.js";

export type DoctorStatus =
  | "not-integrated"
  | "integrated"
  | "update-available"
  | "configuration-drift"
  | "conflict"
  | "capability-unavailable";

export type DoctorOptions = CheckOptions & {
  cwd?: string;
};

export type DoctorResult = {
  exitCode: number;
  summary: DoctorStatus;
  lines: string[];
};

const STATUS_RANK: Record<DoctorStatus, number> = {
  conflict: 0,
  "configuration-drift": 1,
  "not-integrated": 2,
  "capability-unavailable": 3,
  "update-available": 4,
  integrated: 5,
};

export async function runDoctor(options: DoctorOptions = {}): Promise<DoctorResult> {
  const header = "framework doctor";
  let loaded: LoadedManifest;
  try {
    loaded = loadCapabilityManifest();
  } catch (error) {
    return fail(header, error instanceof Error ? error.message : "Could not load the capability manifest.");
  }

  const cwd = path.resolve(options.cwd ?? process.cwd());
  if (path.resolve(cwd) === path.resolve(loaded.assets.root)) {
    return fail(header, "Refusing to inspect the framework repository.");
  }
  if (!existsSync(path.join(cwd, "package.json"))) {
    return summarized(header, "not-integrated", ["package.json is missing. This directory is not an application."]);
  }

  const configFile = readConsumerConfig(cwd);
  if (configFile.status === "missing") {
    return summarized(header, "not-integrated", ["framework.config.json is missing. Run framework adopt."]);
  }
  if (configFile.status === "invalid") {
    return summarized(header, "conflict", configFile.errors);
  }

  const selection = selectCapabilities(loaded.manifest, configFile.config);
  const errors = [...selection.errors, ...validateDeploySelection(loaded.manifest, configFile.config, selection.selected)];
  if (errors.length > 0) return summarized(header, "conflict", errors);

  const findings: Array<{ status: DoctorStatus; message: string }> = [];
  inspectDeployCompatibility(cwd, loaded, configFile.config, selection.selected, findings);
  await inspectSelection(cwd, loaded, configFile.config, selection.selected, options, findings);
  inspectLegacyRequired(cwd, loaded, selection.selected, findings);

  if (findings.length === 0) findings.push({ status: "integrated", message: "Framework configuration is current." });
  const summary = worstStatus(findings.map((finding) => finding.status));
  return {
    exitCode: summary === "integrated" || summary === "update-available" ? 0 : 1,
    summary,
    lines: [header, `  summary  ${summary}`, ...findings.map((finding) => `  ${finding.status}  ${finding.message}`)],
  };
}

async function inspectSelection(
  cwd: string,
  loaded: LoadedManifest,
  config: ConsumerConfig,
  selected: ReadonlySet<string>,
  options: DoctorOptions,
  findings: Array<{ status: DoctorStatus; message: string }>,
): Promise<void> {
  for (const capability of loaded.manifest.capabilities) {
    if (!selected.has(capability.id)) continue;
    if (capability.distribution.mechanism === "file-sync" && capability.id === "cursor-standards") {
      const destDir = path.join(cwd, ".cursor", "rules", "framework");
      if (existsSync(destDir) && !statSync(destDir).isDirectory()) {
        findings.push({ status: "conflict", message: ".cursor/rules/framework exists and is not a directory." });
        continue;
      }
      const planned = planStandards(cwd, loaded.assets, capability.version);
      if (planned.status === "write") {
        findings.push({
          status: "configuration-drift",
          message: `cursor-standards ${capability.version} differs from the copied rules.`,
        });
      } else {
        findings.push({ status: "integrated", message: `cursor-standards ${capability.version}` });
      }
      continue;
    }
    if (capability.distribution.mechanism === "workflow-call" && capability.id === DEPLOY_CAPABILITY_ID) {
      if (config.deploy === undefined || config.workflowRef === undefined || config.profile === undefined) continue;
      const caller = planCaller(cwd, loaded.manifest.repository, config.workflowRef, config.profile, config.deploy);
      if (caller.status === "conflict") {
        findings.push({ status: "conflict", message: caller.message });
      } else if (caller.status === "pending") {
        findings.push({
          status: "configuration-drift",
          message: caller.message,
        });
      } else {
        findings.push({ status: "integrated", message: `deploy ${config.profile} ${config.workflowRef}` });
      }
      continue;
    }
    if (capability.distribution.mechanism !== "npm") continue;
    if (capability.distribution.status === "unpublished") {
      findings.push({
        status: "capability-unavailable",
        message: `${capability.distribution.packageName}@${capability.version} is unpublished.`,
      });
      continue;
    }
    const installed = await installedPackageVersion(cwd, capability.distribution.packageName);
    if (installed === undefined) {
      findings.push({
        status: "configuration-drift",
        message: `${capability.distribution.packageName} is selected and available but not installed.`,
      });
    }
  }

  const names = selectedNpmPackages(loaded.manifest, selected)
    .filter((entry) => entry.status === "available")
    .map((entry) => entry.packageName);
  const installedNames: string[] = [];
  for (const name of names) {
    if ((await installedPackageVersion(cwd, name)) !== undefined) installedNames.push(name);
  }
  if (installedNames.length === 0) return;

  const versions = await latestPackageVersions(installedNames, { ...options, cwd });
  if (versions.registryFailed && versions.latest.size === 0) {
    findings.push({ status: "integrated", message: "registry unavailable; package update check skipped." });
    return;
  }
  for (const name of installedNames) {
    const installed = await installedPackageVersion(cwd, name);
    const latest = versions.latest.get(name);
    if (installed === undefined || latest === undefined || latest === installed) continue;
    findings.push({ status: "update-available", message: `${name}  ${installed} → ${latest}` });
  }
}

function inspectDeployCompatibility(
  cwd: string,
  loaded: LoadedManifest,
  config: ConsumerConfig,
  selected: ReadonlySet<string>,
  findings: Array<{ status: DoctorStatus; message: string }>,
): void {
  const profiles = loaded.manifest.profiles.map((profile) => profile.id).join(", ");
  findings.push({
    status: "integrated",
    message: `deploy profiles available: ${profiles}.`,
  });
  if (config.profile !== undefined) {
    const profile = loaded.manifest.profiles.find((item) => item.id === config.profile);
    if (profile !== undefined) {
      findings.push({
        status: "integrated",
        message: `deploy profile ${profile.id}: ${profile.limitations}`,
      });
    }
  }
  if (!selected.has(DEPLOY_CAPABILITY_ID)) {
    findings.push({
      status: "integrated",
      message: "deploy is off. Adoption does not write a caller. Run framework deploy enable after configuring a profile.",
    });
  }

  const workspace = readWorkspace(cwd);
  if (!workspace.ok) return;
  const names = workspace.workspace.dependencyNames;
  if (names.has("next")) {
    findings.push({
      status: "integrated",
      message:
        config.profile === "next-standalone" || config.profile === "static-web"
          ? `Next.js is present and compatible with ${config.profile}.`
          : "Next.js is present. Select next-standalone or static-web before enabling deploy.",
    });
  }
  if (["express", "fastify", "koa"].some((name) => names.has(name))) {
    findings.push({
      status: "integrated",
      message:
        config.profile === "node-server"
          ? "A Node.js server framework is present and compatible with node-server."
          : "A Node.js server framework is present. Select node-server before enabling deploy.",
    });
  }
}

function inspectLegacyRequired(
  cwd: string,
  loaded: LoadedManifest,
  selected: ReadonlySet<string>,
  findings: Array<{ status: DoctorStatus; message: string }>,
): void {
  let required: unknown;
  try {
    const parsed = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8")) as {
      appFramework?: { required?: unknown };
    };
    required = parsed.appFramework?.required;
  } catch {
    return;
  }
  if (required === undefined) return;
  const selectedNames = selectedNpmPackages(loaded.manifest, selected)
    .map((entry) => entry.packageName)
    .sort();
  const listed = Array.isArray(required)
    ? required.filter((name): name is string => typeof name === "string").sort()
    : [];
  if (listed.join("\0") !== selectedNames.join("\0")) {
    findings.push({
      status: "configuration-drift",
      message: "package.json appFramework.required does not match framework.config.json.",
    });
  }
}

function worstStatus(statuses: readonly DoctorStatus[]): DoctorStatus {
  let worst: DoctorStatus = "integrated";
  for (const status of statuses) {
    if (STATUS_RANK[status] < STATUS_RANK[worst]) worst = status;
  }
  return worst;
}

function summarized(header: string, summary: DoctorStatus, messages: readonly string[]): DoctorResult {
  return {
    exitCode: summary === "integrated" || summary === "update-available" ? 0 : 1,
    summary,
    lines: [header, `  summary  ${summary}`, ...messages.map((message) => `  ${summary}  ${message}`)],
  };
}

function fail(header: string, message: string): DoctorResult {
  return { exitCode: 1, summary: "conflict", lines: [header, `  error  ${message}`] };
}
