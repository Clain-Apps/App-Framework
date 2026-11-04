#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runAdopt } from "./adopt.js";
import { checkFrameworkPackages, type CheckOptions } from "./check.js";
import { runDeployEnable } from "./deploy.js";
import { runDoctor } from "./doctor.js";
import { addModule, listModules } from "./modules.js";
import { runSetup } from "./setup.js";
import { runUpgrade } from "./upgrade.js";

const USAGE = [
  "Usage: framework <command> [--cwd <application>] [options]",
  "Commands:",
  "  doctor",
  "  adopt [--dry-run]",
  "  modules",
  "  add <module> [--dry-run]",
  "  upgrade [--dry-run | --check]",
  "  deploy enable [--dry-run] [--approve-switch]",
  "Aliases:",
  "  framework-setup  applies the current framework.config.json",
  "  framework-check  compares installed package versions",
].join("\n");

type GlobalFlags = {
  cwd?: string;
  dryRun: boolean;
  check: boolean;
  list: boolean;
  approveSwitch: boolean;
  rest: string[];
  checkOptions: CheckOptions;
};

export async function runFrameworkCli(
  argv: readonly string[],
  log: (message: string) => void = console.log,
): Promise<number> {
  const command = argv[0];
  if (command === undefined || command === "--help" || command === "-h") {
    log(USAGE);
    return command === undefined ? 1 : 0;
  }
  if (command.startsWith("--")) {
    log(`Unknown argument: ${command}\n${USAGE}`);
    return 1;
  }

  const parsed = parseFlags(argv.slice(1));
  if (!parsed.ok) {
    log(parsed.message);
    return 1;
  }

  const cwd = parsed.flags.cwd === undefined ? {} : { cwd: parsed.flags.cwd };

  try {
    if (command === "doctor") {
      if (parsed.flags.dryRun || parsed.flags.check || parsed.flags.list || parsed.flags.rest.length > 0) {
        log(`Unknown argument for doctor.\n${USAGE}`);
        return 1;
      }
      const result = await runDoctor({ ...cwd, ...parsed.flags.checkOptions });
      for (const line of result.lines) log(line);
      return result.exitCode;
    }
    if (command === "adopt") {
      if (parsed.flags.check || parsed.flags.list || parsed.flags.rest.length > 0) {
        log(`Unknown argument for adopt.\n${USAGE}`);
        return 1;
      }
      const result = runAdopt({ ...cwd, dryRun: parsed.flags.dryRun });
      for (const line of result.lines) log(line);
      return result.exitCode;
    }
    if (command === "modules") {
      if (parsed.flags.dryRun || parsed.flags.check || parsed.flags.rest.length > 0) {
        log(`Unknown argument for modules.\n${USAGE}`);
        return 1;
      }
      const result = listModules(cwd);
      for (const line of result.lines) log(line);
      return result.exitCode;
    }
    if (command === "add") {
      const moduleName = parsed.flags.rest[0];
      if (moduleName === undefined || parsed.flags.rest.length !== 1 || parsed.flags.check || parsed.flags.list) {
        log(`Usage: framework add <module> [--cwd <application>] [--dry-run]`);
        return 1;
      }
      const result = await addModule({ ...cwd, module: moduleName, dryRun: parsed.flags.dryRun });
      for (const line of result.lines) log(line);
      return result.exitCode;
    }
    if (command === "deploy") {
      const action = parsed.flags.rest[0];
      if (action !== "enable" || parsed.flags.rest.length !== 1 || parsed.flags.check || parsed.flags.list) {
        log(`Usage: framework deploy enable [--cwd <application>] [--dry-run] [--approve-switch]`);
        return 1;
      }
      const result = runDeployEnable({
        ...cwd,
        dryRun: parsed.flags.dryRun,
        approveSwitch: parsed.flags.approveSwitch,
      });
      for (const line of result.lines) log(line);
      return result.exitCode;
    }
    if (command === "upgrade") {
      if (parsed.flags.list || parsed.flags.rest.length > 0) {
        log(`Unknown argument for upgrade.\n${USAGE}`);
        return 1;
      }
      const result = await runUpgrade({
        ...cwd,
        dryRun: parsed.flags.dryRun,
        check: parsed.flags.check,
        ...parsed.flags.checkOptions,
      });
      for (const line of result.lines) log(line);
      return result.exitCode;
    }
    if (command === "setup") {
      const result = runSetup({
        ...cwd,
        dryRun: parsed.flags.dryRun,
        check: parsed.flags.check,
        list: parsed.flags.list,
      });
      for (const line of result.lines) log(line);
      return result.exitCode;
    }
    if (command === "check") {
      const result = await checkFrameworkPackages({ ...cwd, ...parsed.flags.checkOptions });
      if (result.lines.length > 0) log(["framework-check", ...result.lines.map((line) => `  ${line}`)].join("\n"));
      return result.exitCode;
    }
    log(`Unknown command: ${command}\n${USAGE}`);
    return 1;
  } catch (error) {
    log(error instanceof Error ? error.message : "framework failed.");
    return 1;
  }
}

function parseFlags(argv: readonly string[]): { ok: true; flags: GlobalFlags } | { ok: false; message: string } {
  const flags: GlobalFlags = {
    dryRun: false,
    check: false,
    list: false,
    approveSwitch: false,
    rest: [],
    checkOptions: {},
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) continue;
    if (arg === "--dry-run") {
      flags.dryRun = true;
      continue;
    }
    if (arg === "--check") {
      flags.check = true;
      continue;
    }
    if (arg === "--list") {
      flags.list = true;
      continue;
    }
    if (arg === "--no-cache") {
      flags.checkOptions.noCache = true;
      continue;
    }
    if (arg === "--approve-switch") {
      flags.approveSwitch = true;
      continue;
    }
    if (arg === "--cwd" || arg === "--timeout" || arg === "--cache-path" || arg === "--cache-ttl" || arg === "--registry") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) return { ok: false, message: `Missing value for ${arg}.\n${USAGE}` };
      index += 1;
      if (arg === "--cwd") flags.cwd = value;
      if (arg === "--registry") flags.checkOptions.registry = value;
      if (arg === "--cache-path") flags.checkOptions.cachePath = value;
      if (arg === "--timeout") {
        const parsed = Number(value);
        if (!/^\d+$/.test(value) || parsed === 0) return { ok: false, message: `Invalid number for ${arg}.\n${USAGE}` };
        flags.checkOptions.timeoutMs = parsed;
      }
      if (arg === "--cache-ttl") {
        const parsed = Number(value);
        if (!/^\d+$/.test(value)) return { ok: false, message: `Invalid number for ${arg}.\n${USAGE}` };
        flags.checkOptions.cacheTtlMs = parsed;
      }
      continue;
    }
    if (arg.startsWith("--")) return { ok: false, message: `Unknown argument: ${arg}\n${USAGE}` };
    flags.rest.push(arg);
  }
  return { ok: true, flags };
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isDirectExecution()) {
  const code = await runFrameworkCli(process.argv.slice(2));
  process.exit(code);
}
