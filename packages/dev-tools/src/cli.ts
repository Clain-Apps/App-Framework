#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkFrameworkPackages, type CheckOptions } from "./check.js";

const VALUE_FLAGS = new Set(["--cwd", "--timeout", "--cache-path", "--cache-ttl", "--registry"]);

type ParsedArgs = { ok: true; options: CheckOptions } | { ok: false; message: string };

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const options: CheckOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) continue;
    if (arg === "--no-cache") {
      options.noCache = true;
      continue;
    }
    if (!VALUE_FLAGS.has(arg)) return { ok: false, message: `Unknown argument: ${arg}` };

    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      return { ok: false, message: `Missing value for ${arg}.` };
    }
    index += 1;

    if (arg === "--cwd") options.cwd = value;
    if (arg === "--registry") options.registry = value;
    if (arg === "--cache-path") options.cachePath = value;
    if (arg === "--timeout") {
      const parsed = parsePositiveInteger(value);
      if (parsed === undefined) return { ok: false, message: `Invalid number for ${arg}.` };
      options.timeoutMs = parsed;
    }
    if (arg === "--cache-ttl") {
      const parsed = parseNonNegativeInteger(value);
      if (parsed === undefined) return { ok: false, message: `Invalid number for ${arg}.` };
      options.cacheTtlMs = parsed;
    }
  }

  return { ok: true, options };
}

export function formatReport(lines: readonly string[]): string | undefined {
  if (lines.length === 0) return undefined;
  return ["framework-check", ...lines.map((line) => `  ${line}`)].join("\n");
}

export async function runCli(
  argv: readonly string[],
  log: (message: string) => void = console.log,
): Promise<number> {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    log(parsed.message);
    return 1;
  }

  try {
    const result = await checkFrameworkPackages(parsed.options);
    const report = formatReport(result.lines);
    if (report !== undefined) log(report);
    return result.exitCode;
  } catch (error) {
    log(error instanceof Error ? error.message : "framework-check failed.");
    return 1;
  }
}

function parsePositiveInteger(value: string): number | undefined {
  const parsed = parseNonNegativeInteger(value);
  if (parsed === undefined || parsed === 0) return undefined;
  return parsed;
}

function parseNonNegativeInteger(value: string): number | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return undefined;
  return parsed;
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isDirectExecution()) {
  const code = await runCli(process.argv.slice(2));
  process.exit(code);
}
