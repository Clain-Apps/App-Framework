import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("published build artifacts", () => {
  it("ships config type declarations and a working public entry", async () => {
    const packageDir = path.join(root, "packages/config");
    const declaration = await readFile(path.join(packageDir, "dist/index.d.ts"), "utf8");
    for (const name of ["defineConfig", "loadConfig", "loadPublicConfig", "ConfigError"]) {
      expect(declaration).toContain(name);
    }

    const packed = await packFiles(packageDir);
    expect(packed).toContain("dist/index.js");
    expect(packed).toContain("dist/index.d.ts");
    expect(packed.some((file) => file.startsWith("src/") || file.startsWith("tests/"))).toBe(false);

    const mod = (await import(pathToFileURL(path.join(packageDir, "dist/index.js")).href)) as {
      defineConfig: (definition: {
        public: { APP_NAME: { kind: "string" } };
      }) => { public: { APP_NAME: { kind: "string" } } };
      loadPublicConfig: (
        definition: { public: { APP_NAME: { kind: "string" } } },
        env: Record<string, string>,
      ) => { APP_NAME: string };
    };
    const definition = mod.defineConfig({ public: { APP_NAME: { kind: "string" } } });
    expect(mod.loadPublicConfig(definition, { APP_NAME: "Demo" })).toEqual({ APP_NAME: "Demo" });
  });

  it("ships the framework-check bin and distinguishes a major update from the built module", async () => {
    const packageDir = path.join(root, "packages/dev-tools");
    const cli = await readFile(path.join(packageDir, "dist/cli.js"), "utf8");
    expect(cli.startsWith("#!/usr/bin/env node")).toBe(true);
    const declaration = await readFile(path.join(packageDir, "dist/index.d.ts"), "utf8");
    expect(declaration).toContain("checkFrameworkPackages");

    const packed = await packFiles(packageDir);
    expect(packed).toContain("dist/cli.js");
    expect(packed).toContain("dist/index.d.ts");
    expect(packed.some((file) => file.startsWith("src/") || file.startsWith("tests/"))).toBe(false);

    const cwd = await mkdtemp(path.join(tmpdir(), "framework-artifact-"));
    await writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify({ dependencies: { "@app-framework/app-config": "^1.0.0" } }),
    );
    const installed = path.join(cwd, "node_modules", "@app-framework", "app-config");
    await mkdir(installed, { recursive: true });
    await writeFile(
      path.join(installed, "package.json"),
      JSON.stringify({ name: "@app-framework/app-config", version: "1.0.0" }),
    );

    const mod = (await import(pathToFileURL(path.join(packageDir, "dist/index.js")).href)) as {
      checkFrameworkPackages: (options: {
        cwd: string;
        cachePath: string;
        scope: string;
        fetch: typeof fetch;
      }) => Promise<{ exitCode: number; lines: string[] }>;
    };
    const result = await mod.checkFrameworkPackages({
      cwd,
      cachePath: path.join(cwd, "cache.json"),
      scope: "@app-framework",
      fetch: async () =>
        new Response(JSON.stringify({ "dist-tags": { latest: "2.0.0" }, versions: { "2.0.0": {} } }), {
          status: 200,
        }),
    });
    expect(result.exitCode).toBe(0);
    expect(result.lines).toEqual(["@app-framework/app-config  1.0.0 → 2.0.0  major update"]);

    const offline = await runNode([
      path.join(packageDir, "dist/cli.js"),
      "--cwd",
      cwd,
      "--registry",
      "http://127.0.0.1:9",
      "--timeout",
      "500",
      "--no-cache",
    ]);
    expect(offline.code).toBe(0);
    expect(offline.stdout).toContain("registry unavailable; version check skipped");
  });

  it("ships the ui entry and tag stylesheet", async () => {
    const packageDir = path.join(root, "packages/ui");
    const declaration = await readFile(path.join(packageDir, "dist/index.d.ts"), "utf8");
    const entry = await readFile(path.join(packageDir, "dist/index.js"), "utf8");
    expect(declaration).toContain("defineAppElements");
    expect(entry).toContain("defineAppElements");

    const packed = await packFiles(packageDir);
    expect(packed).toContain("dist/index.js");
    expect(packed).toContain("dist/index.d.ts");
    expect(packed).toContain("styles.css");
    expect(packed.some((file) => file.startsWith("src/") || file.startsWith("tests/"))).toBe(false);
  });
});

async function packFiles(cwd: string): Promise<string[]> {
  const npmCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  const result = await run(process.execPath, [npmCli, "pack", "--dry-run", "--json"], cwd);
  const start = result.stdout.indexOf("[");
  const end = result.stdout.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error(result.stdout || result.stderr);
  const parsed: unknown = JSON.parse(result.stdout.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("npm pack did not return a package list");
  const first = parsed[0] as { files?: Array<{ path: string }> };
  return (first.files ?? []).map((file) => file.path.replaceAll("\\", "/"));
}

function run(command: string, args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return runCommand(command, args, cwd);
}

function runNode(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return runCommand(process.execPath, args, root);
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
