import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runAdopt } from "../src/adopt.js";
import { runDoctor } from "../src/doctor.js";
import { runSetup } from "../src/setup.js";

function writeApp(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), "framework-doctor-"));
  writeFileSync(path.join(cwd, "package.json"), `${JSON.stringify({ name: "sample-app", private: true }, null, 2)}\n`);
  return cwd;
}

describe("framework doctor", () => {
  it("reports a directory that has not been adopted", async () => {
    const cwd = writeApp();
    try {
      const result = await runDoctor({ cwd, fetch: async () => new Response("missing", { status: 404 }) });
      expect(result.exitCode).toBe(1);
      expect(result.summary).toBe("not-integrated");
      expect(result.lines.join("\n")).toContain("framework.config.json is missing");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("does not treat unpublished selected packages as integrated", async () => {
    const cwd = writeApp();
    try {
      expect(runAdopt({ cwd }).exitCode).toBe(0);
      const result = await runDoctor({ cwd, fetch: async () => new Response("missing", { status: 404 }) });
      expect(result.exitCode).toBe(1);
      expect(result.summary).toBe("capability-unavailable");
      expect(result.lines.join("\n")).toContain("unpublished");
      expect(result.lines.join("\n")).toContain("cursor-standards 1.0.0");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports a legacy deploy caller as a conflict when deploy is selected", async () => {
    const cwd = writeApp();
    try {
      writeFileSync(
        path.join(cwd, "framework.config.json"),
        `${JSON.stringify({
          profile: "static-web",
          workflowRef: "main",
          deploy: {
            nodeVersionFile: ".nvmrc",
            installCommand: "pnpm install --frozen-lockfile",
            buildCommand: "pnpm check",
            outputDirectory: "out",
            entryFile: "index.html",
          },
        }, null, 2)}\n`,
      );
      mkdirSync(path.join(cwd, ".github", "workflows"), { recursive: true });
      writeFileSync(path.join(cwd, ".github", "workflows", "deploy.yml"), "name: Local\n");
      const result = await runDoctor({ cwd, fetch: async () => new Response("missing", { status: 404 }) });
      expect(result.exitCode).toBe(1);
      expect(result.summary).toBe("conflict");
      expect(result.lines.join("\n")).toContain("application-owned");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports configuration drift when selected standards are missing", async () => {
    const cwd = writeApp();
    try {
      writeFileSync(
        path.join(cwd, "framework.config.json"),
        `${JSON.stringify({ capabilities: { "app-config": true, "cursor-standards": true, ui: false, "dev-tools": false } }, null, 2)}\n`,
      );
      const result = await runDoctor({ cwd, fetch: async () => new Response("missing", { status: 404 }) });
      expect(result.exitCode).toBe(1);
      expect(result.summary).toBe("configuration-drift");
      expect(runSetup({ cwd }).wrote).toBe(true);
      const current = await runDoctor({ cwd, fetch: async () => new Response("missing", { status: 404 }) });
      expect(current.summary).toBe("capability-unavailable");
      expect(current.lines.join("\n")).toContain("integrated  cursor-standards 1.0.0");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
