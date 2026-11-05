import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("installed framework package", () => {
  it("runs the packed CLI in a clean application without the framework source", async () => {
    const outside = path.relative(root, tmpdir());
    expect(outside.startsWith("..") || path.isAbsolute(outside)).toBe(true);

    const scratch = mkdtempSync(path.join(tmpdir(), "framework-pack-"));
    const app = mkdtempSync(path.join(tmpdir(), "framework-consumer-"));
    const globalPrefix = mkdtempSync(path.join(tmpdir(), "framework-global-"));
    const execDir = mkdtempSync(path.join(tmpdir(), "framework-exec-"));
    expect(path.relative(root, app).startsWith("..") || path.isAbsolute(path.relative(root, app))).toBe(true);

    try {
      const devTools = await pack("packages/dev-tools", scratch);
      const ui = await pack("packages/ui", scratch);
      const config = await pack("packages/config", scratch);
      writeFileSync(
        path.join(app, "package.json"),
        `${JSON.stringify({ name: "clean-framework-consumer", private: true }, null, 2)}\n`,
      );

      const installed = await npm(["install", "--ignore-scripts", "--no-fund", "--no-audit", devTools, ui, config], app);
      expect(installed.code, installed.stderr).toBe(0);

      const bin = findBin([path.join(app, "node_modules", ".bin")], "framework");
      const modules = await runFile(bin, ["modules"], app);
      expect(modules.code, modules.stderr).toBe(0);
      expect(modules.stdout).toContain("cursor-standards");
      expect(modules.stdout.length).toBeGreaterThan(0);

      const usage = await runFile(bin, [], app);
      expect(usage.code).toBe(1);
      expect(usage.stdout).toContain("Usage: framework");

      const doctor = await runFile(bin, ["doctor"], app);
      expect(doctor.code).toBe(1);
      expect(doctor.stdout).toContain("not-integrated");
      expect(doctor.stdout.length).toBeGreaterThan(0);

      const beforeAdopt = readFileSync(path.join(app, "package.json"), "utf8");
      const adopted = await runFile(bin, ["adopt"], app);
      expect(adopted.code, adopted.stderr || adopted.stdout).toBe(0);
      expect(adopted.stdout).toContain("blocked");
      expect(existsSync(path.join(app, "framework.config.json"))).toBe(true);
      expect(existsSync(path.join(app, ".cursor", "rules", "framework"))).toBe(true);
      expect(readFileSync(path.join(app, "package.json"), "utf8")).toBe(beforeAdopt);

      const uiModule = (await import(pathToFileURL(path.join(app, "node_modules", "@app-framework", "ui", "dist", "index.js")).href)) as {
        defineAppElements: () => void;
      };
      expect(typeof uiModule.defineAppElements).toBe("function");
      expect(existsSync(path.join(app, "node_modules", "@app-framework", "ui", "styles.css"))).toBe(true);
      const configModule = (await import(
        pathToFileURL(path.join(app, "node_modules", "@app-framework", "app-config", "dist", "index.js")).href
      )) as { defineConfig: (definition: { public: { APP_NAME: { kind: "string" } } }) => unknown };
      expect(typeof configModule.defineConfig).toBe("function");

      const packageRoot = path.join(app, "node_modules", "@app-framework", "dev-tools");
      const linked = linkPackageEntries(packageRoot, app);
      const viaBinLink = await run(process.execPath, [linked.bin, "modules"], app, false);
      const viaCliLink = await run(process.execPath, [linked.cli, "modules"], app, false);
      expect(viaBinLink.code, viaBinLink.stderr).toBe(0);
      expect(viaBinLink.stdout).toContain("framework modules");
      expect(viaCliLink.code, viaCliLink.stderr).toBe(0);
      expect(viaCliLink.stdout).toContain("cursor-standards");

      const globalInstall = await npm(
        ["install", "--global", "--prefix", globalPrefix, "--ignore-scripts", "--no-fund", "--no-audit", devTools],
        scratch,
      );
      expect(globalInstall.code, globalInstall.stderr).toBe(0);
      const globalBin = findBin([globalPrefix, path.join(globalPrefix, "bin")], "framework");
      const globalRun = await runFile(globalBin, ["modules"], execDir);
      expect(globalRun.code, globalRun.stderr).toBe(0);
      expect(globalRun.stdout).toContain("cursor-standards");

      writeFileSync(path.join(execDir, "package.json"), `${JSON.stringify({ name: "exec-consumer", private: true })}\n`);
      const exec = await npm(["exec", "--yes", "--package", devTools, "--", "framework", "modules"], execDir);
      expect(exec.code, exec.stderr).toBe(0);
      expect(exec.stdout).toContain("cursor-standards");
    } finally {
      rmSync(scratch, { recursive: true, force: true });
      rmSync(app, { recursive: true, force: true });
      rmSync(globalPrefix, { recursive: true, force: true });
      rmSync(execDir, { recursive: true, force: true });
    }
  }, 180_000);
});

async function pack(packageDir: string, destination: string): Promise<string> {
  const result = await npm(["pack", "--json", "--pack-destination", destination], path.join(root, packageDir));
  if (result.code !== 0) throw new Error(result.stderr || result.stdout);
  const start = result.stdout.indexOf("[");
  const end = result.stdout.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error(result.stdout || result.stderr);
  const parsed = JSON.parse(result.stdout.slice(start, end + 1)) as Array<{ filename: string }>;
  const filename = parsed[0]?.filename;
  if (filename === undefined) throw new Error("npm pack did not return a filename");
  return path.join(destination, filename);
}

function linkPackageEntries(packageRoot: string, app: string): { bin: string; cli: string } {
  const bin = path.join(packageRoot, "dist", "bin", "framework.js");
  const cli = path.join(packageRoot, "dist", "framework-cli.js");
  const linkedBin = path.join(app, "linked-framework.js");
  const linkedCli = path.join(app, "linked-framework-cli.js");
  try {
    symlinkSync(bin, linkedBin, "file");
    symlinkSync(cli, linkedCli, "file");
    return { bin: linkedBin, cli: linkedCli };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code !== "EPERM") throw error;
    const linkDir = path.join(app, "linked-package");
    symlinkSync(packageRoot, linkDir, "junction");
    return {
      bin: path.join(linkDir, "dist", "bin", "framework.js"),
      cli: path.join(linkDir, "dist", "framework-cli.js"),
    };
  }
}

function findBin(directories: readonly string[], name: string): string {
  const candidates = directories.flatMap((directory) => [path.join(directory, `${name}.cmd`), path.join(directory, name)]);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not find ${name}. Looked at ${candidates.join(", ")}`);
}

function npm(args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  return run(command, args, cwd, true);
}

function runFile(file: string, args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  const shell = process.platform === "win32" && file.toLowerCase().endsWith(".cmd");
  return run(file, args, cwd, shell);
}

function run(
  command: string,
  args: string[],
  cwd: string,
  shell: boolean,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const commandLine = [command, ...args].map(quoteCommandPart).join(" ");
  return new Promise((resolve, reject) => {
    const child = shell
      ? spawn(commandLine, {
        cwd,
        shell: true,
        env: childEnv(),
      })
      : spawn(command, args, {
        cwd,
        shell: false,
        env: childEnv(),
      });
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

function childEnv(): NodeJS.ProcessEnv {
  return { ...process.env, npm_config_fund: "false", npm_config_audit: "false", npm_config_update_notifier: "false" };
}

function quoteCommandPart(value: string): string {
  if (!/[\s"]/.test(value)) return value;
  return `"${value.replaceAll('"', '\\"')}"`;
}
