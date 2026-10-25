import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ruleNames = [
  "naming.mdc",
  "separation.mdc",
  "typescript.mdc",
  "organisation.mdc",
  "testing.mdc",
  "maintainability.mdc",
];

describe("development conventions", () => {
  it("versions the shared rules outside this repository's project rules", () => {
    const projectRules = readdirSync(path.join(root, ".cursor/rules"));
    expect(projectRules).toEqual(["ui-elements.mdc"]);
    expect(readdirSync(path.join(root, "standards/cursor/rules")).sort()).toEqual([...ruleNames].sort());

    const version = JSON.parse(readFileSync(path.join(root, "standards/cursor/version.json"), "utf8")) as {
      version: string;
    };
    expect(version.version).toBe("1.0.0");
  });

  it("keeps the shared rules free of this repository's package layout", () => {
    for (const name of ruleNames) {
      const rule = readFileSync(path.join(root, "standards/cursor/rules", name), "utf8");
      expect(rule).not.toContain("packages/ui");
      expect(rule).not.toContain("App-Template");
      expect(rule.startsWith("---")).toBe(true);
    }
  });

  it("copies the pinned rules into a consumer without removing that consumer's other rules", () => {
    const target = mkdtempSync(path.join(tmpdir(), "framework-standards-"));
    try {
      mkdirSync(path.join(target, ".cursor/rules/framework"), { recursive: true });
      writeFileSync(path.join(target, ".cursor/rules/local.mdc"), "local\n");
      writeFileSync(path.join(target, ".cursor/rules/framework/stale.mdc"), "stale\n");

      const synced = spawnSync("node", ["scripts/sync-cursor-standards.mjs", "--target", target], {
        cwd: root,
        encoding: "utf8",
      });
      expect(synced.status).toBe(0);

      expect(readFileSync(path.join(target, ".cursor/rules/local.mdc"), "utf8")).toBe("local\n");
      expect(readdirSync(path.join(target, ".cursor/rules/framework")).sort()).toEqual([...ruleNames].sort());

      const pin = JSON.parse(readFileSync(path.join(target, ".cursor/framework-standards.json"), "utf8")) as {
        version: string;
        source: string;
        commit: string;
      };
      const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
      expect(pin).toEqual({
        version: "1.0.0",
        source: "standards/cursor/rules",
        commit: (head.stdout ?? "").trim(),
      });
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });
});
