import { ConfigError } from "./errors.js";
import type {
  ConfigDefinition,
  ConfigField,
  ConfigIssue,
  ConfigVisibility,
  EnvSource,
  LoadedConfig,
  LoadOptions,
  PublicConfig,
} from "./types.js";

const NUMBER_PATTERN = /^[+-]?\d+(?:\.\d+)?$/;

export function loadConfig<const T extends ConfigDefinition>(
  definition: T,
  env: EnvSource = process.env,
  options?: LoadOptions,
): LoadedConfig<T> {
  if (options?.runtime === "browser") {
    throw new ConfigError([
      {
        key: "*",
        visibility: "server",
        message: "Refusing to load server configuration in a browser runtime. Call loadPublicConfig instead.",
      },
    ]);
  }

  const issues: ConfigIssue[] = [];
  const server = loadSection(definition.server, "server", env, issues);
  const publicValues = loadSection(definition.public, "public", env, issues);
  if (issues.length > 0) {
    throw new ConfigError(issues);
  }

  return { server, public: publicValues } as LoadedConfig<T>;
}

export function loadPublicConfig<const T extends ConfigDefinition>(
  definition: T,
  env: EnvSource = process.env,
): PublicConfig<T> {
  const issues: ConfigIssue[] = [];
  const publicValues = loadSection(definition.public, "public", env, issues);
  if (issues.length > 0) {
    throw new ConfigError(issues);
  }

  return publicValues as PublicConfig<T>;
}

function loadSection(
  section: Readonly<Record<string, ConfigField>> | undefined,
  visibility: ConfigVisibility,
  env: EnvSource,
  issues: ConfigIssue[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(section ?? {})) {
    const raw = readRaw(env, key);
    if (raw.state === "invalid") {
      issues.push({ key, visibility, message: raw.message });
      continue;
    }

    if (raw.state === "missing") {
      if (field.default !== undefined) {
        result[key] = field.default;
        continue;
      }
      if (!isRequired(field)) {
        result[key] = undefined;
        continue;
      }
      issues.push({ key, visibility, message: "Required value is missing." });
      continue;
    }

    const parsed = parsePresent(field, raw.value, visibility);
    if (!parsed.ok) {
      issues.push({ key, visibility, message: parsed.message });
      continue;
    }
    result[key] = parsed.value;
  }

  return result;
}

function isRequired(field: ConfigField): boolean {
  if (field.default !== undefined) return false;
  if (field.required === false) return false;
  return true;
}

type RawRead = { state: "missing" } | { state: "present"; value: string } | { state: "invalid"; message: string };

function readRaw(env: EnvSource, key: string): RawRead {
  const value = env[key];
  if (value === undefined) return { state: "missing" };
  if (typeof value !== "string") return { state: "invalid", message: "Expected a string value." };
  const trimmed = value.trim();
  if (trimmed === "") return { state: "missing" };
  return { state: "present", value: trimmed };
}

type Parsed = { ok: true; value: string | number | boolean } | { ok: false; message: string };

function parsePresent(field: ConfigField, value: string, visibility: ConfigVisibility): Parsed {
  switch (field.kind) {
    case "string":
      return { ok: true, value };
    case "number":
      if (!NUMBER_PATTERN.test(value)) {
        return { ok: false, message: invalidMessage(visibility, "Expected a number", value) };
      }
      return { ok: true, value: Number(value) };
    case "boolean": {
      const normalized = value.toLowerCase();
      if (normalized === "true" || normalized === "1") return { ok: true, value: true };
      if (normalized === "false" || normalized === "0") return { ok: true, value: false };
      return {
        ok: false,
        message: invalidMessage(visibility, "Expected a boolean (true, false, 1, or 0)", value),
      };
    }
    case "url":
      if (!isAbsoluteUrl(value)) {
        return { ok: false, message: invalidMessage(visibility, "Expected a valid URL", value) };
      }
      return { ok: true, value };
    case "enum":
      if (!field.values.includes(value)) {
        return {
          ok: false,
          message: invalidMessage(visibility, `Expected one of: ${field.values.join(", ")}`, value),
        };
      }
      return { ok: true, value };
    default: {
      const unreachable: never = field;
      return unreachable;
    }
  }
}

function invalidMessage(visibility: ConfigVisibility, message: string, value: string): string {
  if (visibility === "server") return `${message}.`;
  return `${message}, received "${value}".`;
}

function isAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol.length > 0;
  } catch {
    return false;
  }
}
