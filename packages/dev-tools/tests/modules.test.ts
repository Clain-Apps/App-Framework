import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runAdopt } from "../src/adopt.js";
import { addModule, listModules } from "../src/modules.js";
import { runUpgrade } from "../src/upgrade.js";
import { runFrameworkCli } from "../src/framework-cli.js";
import { installArguments } from "../src/workspace.js";

function writeApp(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), "framework-modules-"));
  writeFileSync(
    path.join(cwd, "package.json"),
    `${JSON.stringify({ name: "sample-app", private: true, packageManager: "pnpm@12.15.0" }, null, 2)}\n`,
  );
  return cwd;
}

describe("framework modules", () => {
  it("lists implemented capabilities without claiming they are installed", () => {
    const result = listModules();
    expect(result.exitCode).toBe(0);
    expect(result.lines[0]).toBe("framework modules");
    expect(result.lines.join("\n")).toContain("  ui  core  default-enabled  unpublished  selectable  off");
    expect(result.lines.join("\n")).toContain("  package-release  standard  opt-in  available  not-selectable  off");
    expect(result.lines.join("\n")).not.toContain("billing");
  });

  it("blocks adding an unpublished package and leaves the application unchanged", async () => {
    const cwd = writeApp();
    try {
      expect(runAdopt({ cwd }).exitCode).toBe(0);
      const before = readFileSync(path.join(cwd, "package.json"), "utf8");
      const result = await addModule({ cwd, module: "ui" });
      expect(result.exitCode).toBe(1);
      expect(result.wrote).toBe(false);
      expect(result.lines.join("\n")).toContain("unpublished");
      expect(readFileSync(path.join(cwd, "package.json"), "utf8")).toBe(before);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("rejects an unimplemented module and deploy-static without a profile", async () => {
    const cwd = writeApp();
    try {
      expect(runAdopt({ cwd }).exitCode).toBe(0);
      const unknown = await addModule({ cwd, module: "billing" });
      expect(unknown.exitCode).toBe(1);
      expect(unknown.lines.join("\n")).toContain("not an implemented capability");
      const deploy = await addModule({ cwd, module: "deploy-static" });
      expect(deploy.exitCode).toBe(1);
      expect(deploy.lines.join("\n")).toContain("requires a deploy profile");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("adds an available file-sync module without rewriting application source", async () => {
    const cwd = writeApp();
    writeFileSync(
      path.join(cwd, "framework.config.json"),
      `${JSON.stringify({ capabilities: { "app-config": true, "cursor-standards": false, ui: false, "dev-tools": false } }, null, 2)}\n`,
    );
    try {
      const dryRun = await addModule({ cwd, module: "cursor-standards", dryRun: true });
      expect(dryRun.exitCode).toBe(0);
      expect(dryRun.wrote).toBe(false);
      expect(dryRun.lines.join("\n")).toContain("config  write");

      const added = await addModule({ cwd, module: "cursor-standards" });
      expect(added.exitCode).toBe(0);
      expect(added.wrote).toBe(true);
      const config = JSON.parse(readFileSync(path.join(cwd, "framework.config.json"), "utf8")) as {
        capabilities: Record<string, boolean>;
      };
      expect(config.capabilities["cursor-standards"]).toBe(true);
      expect(readFileSync(path.join(cwd, ".cursor", "framework-standards.json"), "utf8")).toContain("1.0.0");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("builds package-manager install arguments for an available module", () => {
    expect(installArguments("pnpm", "@app-framework/ui", "0.1.0", "dependencies")).toEqual([
      "add",
      "@app-framework/ui@^0.1.0",
    ]);
    expect(installArguments("pnpm", "@app-framework/dev-tools", "0.1.0", "devDependencies")).toEqual([
      "add",
      "-D",
      "@app-framework/dev-tools@^0.1.0",
    ]);
    expect(installArguments("npm", "@app-framework/ui", "0.1.0", "dependencies")).toEqual([
      "install",
      "@app-framework/ui@^0.1.0",
      "--save",
    ]);
    expect(installArguments("yarn", "@app-framework/dev-tools", "0.1.0", "devDependencies")).toEqual([
      "add",
      "--dev",
      "@app-framework/dev-tools@^0.1.0",
    ]);
  });

  it("plans a compatible upgrade without applying a major update", async () => {
    const cwd = writeApp();
    try {
      expect(runAdopt({ cwd }).exitCode).toBe(0);
      const dryRun = await runUpgrade({ cwd, dryRun: true, fetch: async () => new Response("missing", { status: 404 }) });
      expect(dryRun.exitCode).toBe(0);
      expect(dryRun.wrote).toBe(false);
      expect(dryRun.lines[0]).toBe("framework upgrade (dry-run)");
      expect(dryRun.lines.some((line) => line.includes("unpublished"))).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("routes the unified CLI to doctor, adopt, and modules", async () => {
    const logs: string[] = [];
    expect(await runFrameworkCli(["modules"], (line) => logs.push(line))).toBe(0);
    expect(logs.join("\n")).toContain("cursor-standards");

    const cwd = writeApp();
    try {
      const adoptLogs: string[] = [];
      expect(await runFrameworkCli(["adopt", "--cwd", cwd, "--dry-run"], (line) => adoptLogs.push(line))).toBe(0);
      expect(adoptLogs.join("\n")).toContain("framework adopt (dry-run)");
      expect(await runFrameworkCli(["nope"])).toBe(1);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
