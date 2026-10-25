import type { ConfigDefinition, ConfigField, ConfigVisibility } from "./types.js";

export function defineConfig<const T extends ConfigDefinition>(definition: T): T {
  const problems: string[] = [];
  const serverKeys = new Set(Object.keys(definition.server ?? {}));

  for (const key of Object.keys(definition.public ?? {})) {
    if (serverKeys.has(key)) {
      problems.push(`Key "${key}" is declared in both server and public.`);
    }
  }

  validateSection("server", definition.server, problems);
  validateSection("public", definition.public, problems);

  if (problems.length > 0) {
    throw new Error(
      `Invalid configuration definition:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
    );
  }

  return definition;
}

function validateSection(
  visibility: ConfigVisibility,
  section: Readonly<Record<string, ConfigField>> | undefined,
  problems: string[],
): void {
  for (const [key, field] of Object.entries(section ?? {})) {
    if (field.kind === "enum") {
      if (field.values.length === 0) {
        problems.push(`Key "${key}" (${visibility}) must list at least one enum value.`);
      }
      if (field.default !== undefined && !field.values.includes(field.default)) {
        problems.push(`Key "${key}" (${visibility}) default is not an enum value.`);
      }
    }

    if (field.kind === "url" && field.default !== undefined && !isAbsoluteUrl(field.default)) {
      problems.push(`Key "${key}" (${visibility}) default is not a valid URL.`);
    }

    if (field.kind === "number" && field.default !== undefined && !Number.isFinite(field.default)) {
      problems.push(`Key "${key}" (${visibility}) default is not a finite number.`);
    }
  }
}

function isAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol.length > 0;
  } catch {
    return false;
  }
}
