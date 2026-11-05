import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { loadCapabilityManifest, readSourceCommit } from "../src/capabilities.js";
import { packageSetupStatus, renderDeployCaller, runSetup } from "../src/setup.js";
import { runSetupCli } from "../src/setup-cli.js";
import { syncCursorStandards } from "../src/standards.js";

const root = path.resolve(import.meta.dirname, "../../..");

const deploy = {
  nodeVersionFile: ".nvmrc",
  installCommand: "pnpm install --frozen-lockfile",
  buildCommand: "pnpm check",
  outputDirectory: "out",
  entryFile: "index.html",
};

function writeApp(config: unknown): string {
  const cwd = mkdtempSync(path.join(tmpdir(), "framework-setup-"));
  writeFileSync(path.join(cwd, "framework.config.json"), `${JSON.stringify(config, null, 2)}\n`);
  writeFileSync(
    path.join(cwd, "package.json"),
    `${JSON.stringify({ name: "sample-app", private: true, scripts: { dev: "echo app" }, dependencies: { react: "19.0.0" } }, null, 2)}\n`,
  );
  mkdirSync(path.join(cwd, "src"), { recursive: true });
  writeFileSync(path.join(cwd, "src", "app.ts"), "export const value = 1;\n");
  mkdirSync(path.join(cwd, ".cursor", "rules"), { recursive: true });
  writeFileSync(path.join(cwd, ".cursor", "rules", "product.mdc"), "product\n");
  writeFileSync(path.join(cwd, "README.md"), "sample\n");
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

function ruleNames(): string[] {
  return readdirSync(path.join(root, "standards/cursor/rules"))
    .filter((name) => name.endsWith(".mdc"))
    .sort();
}

describe("framework-setup", () => {
  it("lists implemented capabilities without reading an application", () => {
    const logs: string[] = [];
    expect(runSetupCli(["--list"], (line) => logs.push(line))).toBe(0);
    const report = logs.join("\n");
    expect(report).toContain("  ui  core  default-enabled  unpublished  selectable");
    expect(report).toContain("  app-config  core  mandatory  unpublished  selectable");
    expect(report).toContain("  package-release  standard  opt-in  available  not-selectable");
    expect(report).not.toContain("billing");
  });

  it("sets up a static-web application without copying package source or editing its manifest", () => {
    const cwd = writeApp({ profile: "static-web", workflowRef: "main", deploy });
    const manifestBefore = readFileSync(path.join(cwd, "package.json"), "utf8");
    const sourceBefore = readFileSync(path.join(cwd, "src", "app.ts"), "utf8");
    try {
      const dryRun = runSetup({ cwd, dryRun: true });
      expect(dryRun.exitCode).toBe(0);
      expect(dryRun.wrote).toBe(false);
      expect(dryRun.lines[0]).toBe("framework-setup (dry-run)");
      expect(listFiles(cwd)).toEqual([".cursor/rules/product.mdc", "README.md", "framework.config.json", "package.json", "src/app.ts"]);

      const applied = runSetup({ cwd });
      expect(applied.exitCode).toBe(0);
      expect(applied.wrote).toBe(true);
      expect(applied.lines).toEqual([
        "framework-setup",
        "  profile  static-web",
        "  app-config  blocked  @app-framework/app-config@0.1.0 is unpublished. No dependency was added.",
        "  cursor-standards  write  .cursor/rules/framework version 1.0.0",
        "  deploy  pending  Run framework deploy enable to write .github/workflows/deploy.yml. Adoption does not deploy.",
        "  dev-tools  blocked  @app-framework/dev-tools@0.1.0 is unpublished and requires semver. No dependency was added.",
        "  ui  blocked  @app-framework/ui@0.1.0 is unpublished. No dependency was added.",
      ]);

      const rules = ruleNames().map((name) => `.cursor/rules/framework/${name}`);
      expect(listFiles(cwd)).toEqual(
        [".cursor/framework-standards.json", ...rules, ".cursor/rules/product.mdc", "README.md", "framework.config.json", "package.json", "src/app.ts"].sort(),
      );
      expect(readFileSync(path.join(cwd, "package.json"), "utf8")).toBe(manifestBefore);
      expect(readFileSync(path.join(cwd, "src", "app.ts"), "utf8")).toBe(sourceBefore);
      expect(readFileSync(path.join(cwd, ".cursor", "rules", "product.mdc"), "utf8")).toBe("product\n");
      expect(listFiles(cwd).some((file) => file.startsWith("packages/"))).toBe(false);

      expect(existsDirectory(path.join(cwd, ".github"))).toBe(false);
      const pin = JSON.parse(readFileSync(path.join(cwd, ".cursor", "framework-standards.json"), "utf8")) as {
        version: string;
        source: string;
        commit: string;
      };
      expect(pin.version).toBe("1.0.0");
      expect(pin.source).toBe("standards/cursor/rules");
      expect(pin.commit).toMatch(/^[0-9a-f]{40}$/);

      const again = runSetup({ cwd });
      expect(again.exitCode).toBe(0);
      expect(again.wrote).toBe(false);
      expect(again.lines).toContain("  cursor-standards  unchanged  version 1.0.0");
      expect(again.lines).toContain(
        "  deploy  pending  Run framework deploy enable to write .github/workflows/deploy.yml. Adoption does not deploy.",
      );
      expect(again.lines.some((line) => line.includes("  write  ") || line.includes("  delete  "))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("copies the same standards as the shared sync function", () => {
    const left = writeApp({
      capabilities: {
        "app-config": true,
        ui: false,
        "dev-tools": false,
        "cursor-standards": true,
      },
    });
    const right = mkdtempSync(path.join(tmpdir(), "framework-sync-"));
    try {
      expect(runSetup({ cwd: left }).exitCode).toBe(0);
      syncCursorStandards(right);
      for (const name of ruleNames()) {
        expect(readFileSync(path.join(left, ".cursor", "rules", "framework", name))).toEqual(
          readFileSync(path.join(right, ".cursor", "rules", "framework", name)),
        );
      }
      expect(readFileSync(path.join(left, ".cursor", "framework-standards.json"), "utf8")).toBe(
        readFileSync(path.join(right, ".cursor", "framework-standards.json"), "utf8"),
      );
      expect(existsDirectory(path.join(left, ".github"))).toBe(false);
    } finally {
      rmSync(left, { recursive: true, force: true });
      rmSync(right, { recursive: true, force: true });
    }
  });

  it("reports a stale framework rule in the plan and removes only that file when applied", () => {
    const cwd = writeApp({
      profile: "static-web",
      capabilities: { "app-config": true, "cursor-standards": true, ui: false, "dev-tools": false, deploy: false },
    });
    try {
      mkdirSync(path.join(cwd, ".cursor", "rules", "framework", "notes"), { recursive: true });
      writeFileSync(path.join(cwd, ".cursor", "rules", "framework", "stale.mdc"), "stale\n");
      writeFileSync(path.join(cwd, ".cursor", "rules", "framework", "notes", "keep.txt"), "keep\n");

      const planned = runSetup({ cwd, dryRun: true });
      expect(planned.lines).toContain("  cursor-standards  delete  .cursor/rules/framework/stale.mdc");
      expect(readFileSync(path.join(cwd, ".cursor", "rules", "framework", "stale.mdc"), "utf8")).toBe("stale\n");

      expect(runSetup({ cwd }).exitCode).toBe(0);
      expect(existsFile(path.join(cwd, ".cursor", "rules", "framework", "stale.mdc"))).toBe(false);
      expect(readFileSync(path.join(cwd, ".cursor", "rules", "framework", "notes", "keep.txt"), "utf8")).toBe("keep\n");
      expect(readFileSync(path.join(cwd, ".cursor", "rules", "product.mdc"), "utf8")).toBe("product\n");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("leaves an application-owned deploy workflow in place", () => {
    const cwd = writeApp({ profile: "static-web", workflowRef: "deploy-static-v1", deploy });
    const owned = "name: Local\n";
    try {
      mkdirSync(path.join(cwd, ".github", "workflows"), { recursive: true });
      writeFileSync(path.join(cwd, ".github", "workflows", "deploy.yml"), owned);
      const result = runSetup({ cwd });
      expect(result.exitCode).toBe(1);
      expect(result.lines).toContain(
        "  deploy  conflict  .github/workflows/deploy.yml is application-owned. Run framework deploy enable --dry-run.",
      );
      expect(readFileSync(path.join(cwd, ".github", "workflows", "deploy.yml"), "utf8")).toBe(owned);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("rejects unknown, incompatible, and unsafe configuration", () => {
    const cases: Array<{ config: unknown; message: string }> = [
      { config: { profile: "container" }, message: 'Profile "container" is not implemented' },
      {
        config: { profile: "static-web", capabilities: { "app-config": true, billing: true } },
        message: "billing is not an implemented capability.",
      },
      {
        config: { capabilities: { "app-config": false } },
        message: "app-config is mandatory.",
      },
      {
        config: { profile: "static-web", capabilities: { "app-config": false } },
        message: "app-config is mandatory for profile static-web.",
      },
      {
        config: { profile: "static-web", capabilities: { "app-config": true, "package-release": true } },
        message: "package-release is maintained in App-Framework and cannot be selected.",
      },
      {
        config: { profile: "static-web", workflowRef: "main;rm", deploy },
        message: 'workflowRef "main;rm" is not a supported ref.',
      },
      {
        config: { profile: "static-web", workflowRef: "main", deploy: { ...deploy, outputDirectory: "../out" } },
        message: "deploy.outputDirectory must be a relative path.",
      },
      {
        config: { profile: "static-web", workflowRef: "main", deploy: { ...deploy, installCommand: "echo ${{ secrets.X }}" } },
        message: "deploy.installCommand must be one line.",
      },
      {
        config: { profile: "node-server", workflowRef: "main", deploy },
        message: "deploy.systemdUnit must be a single .service name.",
      },
      {
        config: {
          profile: "next-standalone",
          workflowRef: "deploy-static-v1",
          deploy: {
            ...deploy,
            outputDirectory: ".next/standalone",
            entryFile: "server.js",
            systemdUnit: "allapps.service",
            healthcheckUrl: "http://127.0.0.1:3000/health",
          },
        },
        message: "deploy-static-vN pins the frozen static workflow and cannot deploy a server profile.",
      },
    ];

    for (const entry of cases) {
      const cwd = writeApp(entry.config);
      try {
        const result = runSetup({ cwd });
        expect(result.exitCode, entry.message).toBe(1);
        expect(result.wrote, entry.message).toBe(false);
        expect(result.lines.join("\n"), entry.message).toContain(entry.message);
        expect(listFiles(cwd).some((file) => file.startsWith(".github/"))).toBe(false);
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    }
  });

  it("refuses the framework repository and a missing configuration file", () => {
    expect(runSetup({ cwd: root }).lines.join("\n")).toContain("Refusing to set up the framework repository.");
    const cwd = mkdtempSync(path.join(tmpdir(), "framework-setup-empty-"));
    try {
      expect(runSetup({ cwd }).lines.join("\n")).toContain("Missing framework.config.json.");
      writeFileSync(path.join(cwd, "framework.config.json"), "{");
      expect(runSetup({ cwd }).lines.join("\n")).toContain("framework.config.json is not valid JSON.");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("checks for a standards update without writing", () => {
    const cwd = writeApp({ profile: "static-web", workflowRef: "main", deploy });
    try {
      const checked = runSetup({ cwd, check: true });
      expect(checked.exitCode).toBe(0);
      expect(checked.wrote).toBe(false);
      expect(checked.lines[0]).toBe("framework-setup (check)");
      expect(checked.lines).toContain("  cursor-standards  write  .cursor/rules/framework version 1.0.0");
      expect(existsFile(path.join(cwd, ".cursor", "framework-standards.json"))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("quotes caller inputs and names a published package without installing it", () => {
    const rendered = renderDeployCaller({
      repository: "Clain-Apps/App-Framework",
      workflowRef: "deploy-static-v1",
      profile: "static-web",
      deploy: { ...deploy, installCommand: 'echo "hi"' },
    });
    const parsed = parse(rendered) as {
      jobs: {
        deploy: {
          uses: string;
          with: { install_command: string; vps_host: string; vps_user: string; deploy_root: string };
          secrets: Record<string, string>;
        };
      };
    };
    expect(parsed.jobs.deploy.uses).toBe(
      "Clain-Apps/App-Framework/.github/workflows/deploy-static.yml@deploy-static-v1",
    );
    expect(parsed.jobs.deploy.with.install_command).toBe('echo "hi"');
    expect(parsed.jobs.deploy.with.vps_host).toBe("${{ vars.VPS_HOST }}");
    expect(parsed.jobs.deploy.with.vps_user).toBe("${{ vars.VPS_USER }}");
    expect(parsed.jobs.deploy.with.deploy_root).toBe("${{ vars.DEPLOY_ROOT }}");
    expect(parsed.jobs.deploy.secrets).toEqual({
      VPS_SSH_KEY: "${{ secrets.VPS_SSH_KEY }}",
      VPS_KNOWN_HOSTS: "${{ secrets.VPS_KNOWN_HOSTS }}",
    });
    expect(rendered).not.toContain("secrets.VPS_HOST");
    expect(rendered).not.toContain("secrets.VPS_USER");

    const { manifest } = loadCapabilityManifest();
    const ui = manifest.capabilities.find((capability) => capability.id === "ui");
    if (ui?.distribution.mechanism !== "npm") throw new Error("ui is not an npm capability");
    const manual = packageSetupStatus({ ...ui, distribution: { ...ui.distribution, status: "available" } });
    expect(manual).toEqual({
      status: "manual",
      message:
        "@app-framework/ui@0.1.0 is available. framework adopt installs it with the application's package manager. Setup leaves package.json unchanged.",
    });
  });

  it("loads standards shipped inside the dev-tools package", () => {
    const packed = mkdtempSync(path.join(tmpdir(), "framework-packed-"));
    try {
      const consumer = path.join(packed, "dist", "consumer");
      mkdirSync(path.join(consumer, "standards", "cursor"), { recursive: true });
      cpSync(path.join(root, "capabilities", "manifest.json"), path.join(consumer, "manifest.json"));
      cpSync(path.join(root, "standards", "cursor"), path.join(consumer, "standards", "cursor"), { recursive: true });
      const commit = "a".repeat(40);
      writeFileSync(path.join(consumer, "source.json"), `${JSON.stringify({ commit }, null, 2)}\n`);
      const modulePath = path.join(packed, "dist", "fake.js");
      writeFileSync(modulePath, "");
      const loaded = loadCapabilityManifest(pathToFileURL(modulePath).href);
      expect(loaded.assets.mode).toBe("package");
      expect(readSourceCommit(loaded.assets)).toBe(commit);
      expect(loaded.manifest.deployRoot).toBe("/apps");
    } finally {
      rmSync(packed, { recursive: true, force: true });
    }
  });

  it("applies integration defaults without writing a deploy caller", () => {
    const cwd = writeApp({});
    try {
      const result = runSetup({ cwd });
      expect(result.exitCode).toBe(0);
      expect(result.lines).toContain("  profile  none");
      expect(result.lines.some((line) => line.includes("  deploy  "))).toBe(false);
      expect(existsDirectory(path.join(cwd, ".github"))).toBe(false);
      expect(existsFile(path.join(cwd, ".cursor", "framework-standards.json"))).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("rejects combining plan flags", () => {
    const logs: string[] = [];
    expect(runSetupCli(["--dry-run", "--check"], (line) => logs.push(line))).toBe(1);
    expect(logs.join("\n")).toContain("Use either --dry-run or --check.");
    const usage: string[] = [];
    expect(runSetupCli(["--nope"], (line) => usage.push(line))).toBe(1);
    expect(usage.join("\n")).toContain("Usage: framework-setup");
  });
});

function existsFile(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function existsDirectory(directory: string): boolean {
  try {
    return statSync(directory).isDirectory();
  } catch {
    return false;
  }
}
