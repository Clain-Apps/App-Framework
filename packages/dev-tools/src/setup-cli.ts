#!/usr/bin/env node
import { isDirectExecution } from "./direct-execution.js";
import { runSetup, type SetupOptions } from "./setup.js";

const USAGE = "Usage: framework-setup [--cwd <application>] [--dry-run | --check | --list]";

type ParsedArgs = { ok: true; options: SetupOptions } | { ok: false; message: string };

export function parseSetupArgs(argv: readonly string[]): ParsedArgs {
  const options: SetupOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) continue;
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--check") {
      options.check = true;
      continue;
    }
    if (arg === "--list") {
      options.list = true;
      continue;
    }
    if (arg === "--cwd") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) return { ok: false, message: `Missing value for --cwd.\n${USAGE}` };
      options.cwd = value;
      index += 1;
      continue;
    }
    return { ok: false, message: `Unknown argument: ${arg}\n${USAGE}` };
  }
  return { ok: true, options };
}

export function runSetupCli(argv: readonly string[], log: (message: string) => void = console.log): number {
  const parsed = parseSetupArgs(argv);
  if (!parsed.ok) {
    log(parsed.message);
    return 1;
  }
  try {
    const result = runSetup(parsed.options);
    for (const line of result.lines) log(line);
    return result.exitCode;
  } catch (error) {
    log(error instanceof Error ? error.message : "framework-setup failed.");
    return 1;
  }
}

if (isDirectExecution(import.meta.url)) {
  process.exit(runSetupCli(process.argv.slice(2)));
}
