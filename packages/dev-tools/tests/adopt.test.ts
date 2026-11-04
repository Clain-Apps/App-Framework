import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runAdopt } from "../src/adopt.js";
import { runSetup } from "../src/setup.js";

const root = path.resolve(import.meta.dirname, "../../..");

function writeApp(extra: Record<string, string> = {}): string {
  const cwd = mkdtempSync(path.join(tmpdir(), "framework-adopt-"));
  writeFileSync(
    path.join(cwd, "package.json"),
    `${JSON.stringify({ name: "sample-app", private: true, packageManager: "pnpm@12.15.0", dependencies: { vite: "6.0.0", dotenv: "16.0.0" } }, null, 2)}\n`,
  );
  writeFileSync(path.join(cwd, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  mkdirSync(path.join(cwd, "src"), { recursive: true });
  writeFileSync(path.join(cwd, "src", "app.ts"), "export const value = 1;\n");
  mkdirSync(path.join(cwd, ".cursor", "rules"), { recursive: true });
  writeFileSync(path.join(cwd, ".cursor", "rules", "product.mdc"), "product\n");
  for (const [relative, contents] of Object.entries(extra)) {
    const file = path.join(cwd, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
  }
  return cwd;
}

function listFiles(directory: string): string[] {
  const files: string[] = [];
  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      const absolute = path.join(current, name);
      if (statSync(absolute).isDirectory()) walk(absolute);
      else files.push(path.relative(directory, absolute).replaceAll("\\", "/"));
    }
  };
  walk(directory);
  return files.sort();
}

describe("framework adopt", () => {
  it("initialises an existing application without enabling deploy or rewriting source", () => {
    const cwd = writeApp();
    const sourceBefore = readFileSync(path.join(cwd, "src", "app.ts"), "utf8");
    const manifestBefore = readFileSync(path.join(cwd, "package.json"), "utf8");
    try {
      const dryRun = runAdopt({ cwd, dryRun: true });
      expect(dryRun.exitCode).toBe(0);
      expect(dryRun.wrote).toBe(false);
      expect(dryRun.lines[0]).toBe("framework adopt (dry-run)");
      expect(dryRun.lines).toContain("  config  write  framework.config.json");
      expect(listFiles(cwd).includes("framework.config.json")).toBe(false);

      const applied = runAdopt({ cwd });
      expect(applied.exitCode).toBe(0);
      expect(applied.wrote).toBe(true);
      expect(applied.lines).toContain("  package-manager  pnpm  package.json packageManager");
      expect(applied.lines.some((line) => line.includes("Vite is present"))).toBe(true);
      expect(applied.lines.some((line) => line.includes("app-config can be added later"))).toBe(true);
      expect(applied.lines.some((line) => line.includes("deploy-static"))).toBe(false);

      const config = JSON.parse(readFileSync(path.join(cwd, "framework.config.json"), "utf8")) as {
        profile?: string;
        capabilities: Record<string, boolean>;
      };
      expect(config.profile).toBeUndefined();
      expect(config.capabilities).toEqual({
        "app-config": true,
        "cursor-standards": true,
        "dev-tools": true,
        ui: true,
      });
      expect(readFileSync(path.join(cwd, "src", "app.ts"), "utf8")).toBe(sourceBefore);
      expect(readFileSync(path.join(cwd, "package.json"), "utf8")).toBe(manifestBefore);
      expect(readFileSync(path.join(cwd, ".cursor", "rules", "product.mdc"), "utf8")).toBe("product\n");
      expect(listFiles(cwd).some((file) => file.startsWith(".github/"))).toBe(false);

      const again = runAdopt({ cwd });
      expect(again.exitCode).toBe(0);
      expect(again.wrote).toBe(false);
      expect(again.lines).toContain("  config  unchanged  framework.config.json");
      expect(again.lines).toContain("  cursor-standards  unchanged  version 1.0.0");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("keeps an existing valid configuration and reports a legacy deploy workflow", () => {
    const cwd = writeApp({
      "framework.config.json": `${JSON.stringify({ capabilities: { "app-config": true, "cursor-standards": true, ui: false, "dev-tools": false } }, null, 2)}\n`,
      ".github/workflows/deploy.yml": "name: Local\n",
    });
    try {
      const result = runAdopt({ cwd });
      expect(result.exitCode).toBe(0);
      expect(result.lines).toContain("  config  unchanged  framework.config.json");
      expect(result.lines.some((line) => line.includes("application-owned"))).toBe(true);
      expect(readFileSync(path.join(cwd, ".github", "workflows", "deploy.yml"), "utf8")).toBe("name: Local\n");
      expect(JSON.parse(readFileSync(path.join(cwd, "framework.config.json"), "utf8"))).toEqual({
        capabilities: { "app-config": true, "cursor-standards": true, ui: false, "dev-tools": false },
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports a conflict when framework.config.json is invalid", () => {
    const cwd = writeApp({ "framework.config.json": "{" });
    try {
      const result = runAdopt({ cwd });
      expect(result.exitCode).toBe(1);
      expect(result.wrote).toBe(false);
      expect(result.lines.join("\n")).toContain("conflict");
      expect(readFileSync(path.join(cwd, "framework.config.json"), "utf8")).toBe("{");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("refuses the framework repository and a directory without package.json", () => {
    expect(runAdopt({ cwd: root }).lines.join("\n")).toContain("Refusing to set up the framework repository.");
    const cwd = mkdtempSync(path.join(tmpdir(), "framework-adopt-empty-"));
    try {
      expect(runAdopt({ cwd }).lines.join("\n")).toContain("Missing package.json");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("uses the same consumer contract as setup after adoption", () => {
    const cwd = writeApp();
    try {
      expect(runAdopt({ cwd }).exitCode).toBe(0);
      const setup = runSetup({ cwd });
      expect(setup.exitCode).toBe(0);
      expect(setup.wrote).toBe(false);
      expect(setup.lines).toContain("  profile  none");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
