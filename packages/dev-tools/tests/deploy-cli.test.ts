import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { runDeployEnable } from "../src/deploy.js";
import { runDoctor } from "../src/doctor.js";
import { runFrameworkCli } from "../src/framework-cli.js";
import { renderDeployCaller } from "../src/setup.js";

const deploy = {
  nodeVersionFile: ".nvmrc",
  installCommand: "pnpm install --frozen-lockfile",
  buildCommand: "pnpm check",
  outputDirectory: "out",
  entryFile: "index.html",
};

const serverDeploy = {
  nodeVersionFile: ".nvmrc",
  installCommand: "pnpm install --frozen-lockfile",
  buildCommand: "pnpm build",
  outputDirectory: ".next/standalone",
  entryFile: "server.js",
  appName: "allapps",
  systemdUnit: "allapps.service",
  healthcheckUrl: "http://127.0.0.1:3000/health",
};

function writeApp(config: unknown, extra?: { workflow?: string; workflowName?: string }): string {
  const cwd = mkdtempSync(path.join(tmpdir(), "framework-deploy-"));
  writeFileSync(path.join(cwd, "framework.config.json"), `${JSON.stringify(config, null, 2)}\n`);
  writeFileSync(
    path.join(cwd, "package.json"),
    `${JSON.stringify({ name: "sample-app", private: true, dependencies: { next: "16.0.0" } }, null, 2)}\n`,
  );
  if (extra?.workflow !== undefined) {
    mkdirSync(path.join(cwd, ".github", "workflows"), { recursive: true });
    writeFileSync(path.join(cwd, ".github", "workflows", extra.workflowName ?? "deploy.yml"), extra.workflow);
  }
  return cwd;
}

describe("framework deploy enable", () => {
  it("writes a profile-aware caller without deploying", () => {
    const cwd = writeApp({ profile: "static-web", workflowRef: "main", deploy });
    try {
      const dryRun = runDeployEnable({ cwd, dryRun: true });
      expect(dryRun.exitCode).toBe(0);
      expect(dryRun.wrote).toBe(false);
      expect(dryRun.lines[0]).toBe("framework deploy enable (dry-run)");
      expect(dryRun.lines.some((line) => line.includes("write  .github/workflows/deploy.yml"))).toBe(true);

      const enabled = runDeployEnable({ cwd });
      expect(enabled.exitCode).toBe(0);
      expect(enabled.wrote).toBe(true);
      const caller = readFileSync(path.join(cwd, ".github", "workflows", "deploy.yml"), "utf8");
      expect(caller.startsWith("# managed-by: @app-framework/dev-tools deploy\n")).toBe(true);
      expect(caller).toContain("uses: Clain-Apps/App-Framework/.github/workflows/deploy.yml@main");
      expect(caller).toContain("profile: static");
      expect(caller).not.toContain("rsync");
      expect(caller).not.toContain("/apps/");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports a legacy workflow and archives it only with --approve-switch", () => {
    const owned = "name: Local deploy\n";
    const cwd = writeApp({ profile: "static-web", workflowRef: "main", deploy }, { workflow: owned });
    try {
      const blocked = runDeployEnable({ cwd, dryRun: true });
      expect(blocked.exitCode).toBe(1);
      expect(blocked.wrote).toBe(false);
      expect(blocked.lines.join("\n")).toContain("an application-owned or legacy deploy workflow is still active");
      expect(readFileSync(path.join(cwd, ".github", "workflows", "deploy.yml"), "utf8")).toBe(owned);

      const switched = runDeployEnable({ cwd, approveSwitch: true });
      expect(switched.exitCode).toBe(0);
      expect(switched.wrote).toBe(true);
      expect(readFileSync(path.join(cwd, ".github", "workflow-archive", "deploy.yml"), "utf8")).toBe(owned);
      expect(readFileSync(path.join(cwd, ".github", "workflows", "deploy.yml"), "utf8")).toContain(
        "uses: Clain-Apps/App-Framework/.github/workflows/deploy.yml@main",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("renders Next.js standalone inputs including an explicit app name", () => {
    const rendered = renderDeployCaller({
      repository: "Clain-Apps/App-Framework",
      workflowRef: "deploy-v1",
      profile: "next-standalone",
      deploy: serverDeploy,
    });
    const parsed = parse(rendered) as {
      jobs: {
        deploy: {
          uses: string;
          with: Record<string, string>;
        };
      };
    };
    expect(parsed.jobs.deploy.uses).toBe("Clain-Apps/App-Framework/.github/workflows/deploy.yml@deploy-v1");
    expect(parsed.jobs.deploy.with.profile).toBe("next-standalone");
    expect(parsed.jobs.deploy.with.app_name).toBe("allapps");
    expect(parsed.jobs.deploy.with.systemd_unit).toBe("allapps.service");
    expect(parsed.jobs.deploy.with.healthcheck_url).toBe("http://127.0.0.1:3000/health");
    expect(parsed.jobs.deploy.with.output_directory).toBe(".next/standalone");
    expect(parsed.jobs.deploy.with.entry_file).toBe("server.js");
  });
});

describe("framework doctor deploy compatibility", () => {
  it("reports available profiles without treating a missing caller as integrated", async () => {
    const cwd = writeApp({ profile: "next-standalone", workflowRef: "main", deploy: serverDeploy });
    try {
      const result = await runDoctor({ cwd });
      expect(result.exitCode).toBe(1);
      expect(result.summary).toBe("configuration-drift");
      expect(result.lines.join("\n")).toContain("deploy profiles available: static-web, node-server, next-standalone.");
      expect(result.lines.join("\n")).toContain("Run framework deploy enable");
      expect(result.lines.join("\n")).toContain("Next.js is present");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("exposes deploy enable through the framework CLI", async () => {
    const logs: string[] = [];
    const code = await runFrameworkCli(["deploy"], (line) => logs.push(line));
    expect(code).toBe(1);
    expect(logs.join("\n")).toContain("framework deploy enable");
  });
});
