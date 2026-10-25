import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { defineConfig, loadPublicConfig } from "../packages/config/src/index.js";
import { checkFrameworkPackages } from "../packages/dev-tools/src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as Record<string, unknown>;
}

describe("package boundaries", () => {
  it("keeps package names aligned with the scope manifest", () => {
    const scope = readJson("framework.scope.json");
    const config = readJson("packages/config/package.json");
    const tools = readJson("packages/dev-tools/package.json");
    const ui = readJson("packages/ui/package.json");
    const changesets = readJson(".changeset/config.json");
    const npmScope = scope.npmScope;

    expect(npmScope).toEqual(expect.any(String));
    expect(config.name).toBe(`${String(npmScope)}/app-config`);
    expect(tools.name).toBe(`${String(npmScope)}/dev-tools`);
    expect(ui.name).toBe(`${String(npmScope)}/ui`);
    expect(Object.keys(config.exports as object)).toEqual(["."]);
    expect(Object.keys(tools.exports as object)).toEqual(["."]);
    expect(ui.exports).toEqual({
      ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
      "./styles.css": "./styles.css",
    });
    expect(tools.bin).toEqual({ "framework-check": "./dist/cli.js" });
    expect(config.dependencies).toBeUndefined();
    expect(ui.dependencies).toBeUndefined();
    expect(tools.dependencies).toEqual({ semver: expect.any(String) });
    expect(Object.keys((tools.dependencies as object) ?? {})).not.toContain(config.name);
    expect(Object.keys((tools.dependencies as object) ?? {})).not.toContain(ui.name);
    expect(changesets.fixed).toEqual([]);
    expect(changesets.linked).toEqual([]);
    expect(changesets.updateInternalDependencies).toBe("patch");
    expect(changesets.privatePackages).toEqual({ version: true, tag: false });
    expect(changesets.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH).toEqual({
      updateInternalDependents: "always",
    });

    if (scope.scopeConfirmed !== true) {
      expect(config.private).toBe(true);
      expect(tools.private).toBe(true);
      expect(ui.private).toBe(true);
      expect(changesets.access).toBe("restricted");
    }
  });

  it("imports each package from its own public entry", () => {
    const config = defineConfig({ public: { APP_NAME: { kind: "string" } } });
    expect(loadPublicConfig(config, { APP_NAME: "Demo" })).toEqual({ APP_NAME: "Demo" });
    expect(checkFrameworkPackages).toEqual(expect.any(Function));
  });
});
