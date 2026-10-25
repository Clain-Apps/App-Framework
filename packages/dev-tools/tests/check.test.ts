import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkFrameworkPackages } from "../src/index.js";
import { formatReport, parseArgs, runCli } from "../src/cli.js";

const SCOPE = "@app-framework";

async function writeConsumer(
  manifest: Record<string, unknown>,
  installed: Record<string, string> = {},
): Promise<{ cwd: string; cachePath: string; manifestPath: string }> {
  const cwd = await mkdtemp(path.join(tmpdir(), "framework-check-"));
  const manifestPath = path.join(cwd, "package.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  for (const [name, version] of Object.entries(installed)) {
    const packageDir = path.join(cwd, "node_modules", ...name.split("/"));
    await mkdir(packageDir, { recursive: true });
    await writeFile(path.join(packageDir, "package.json"), JSON.stringify({ name, version }));
  }
  return { cwd, cachePath: path.join(cwd, "cache.json"), manifestPath };
}

function registry(versions: Record<string, { latest: string; versions?: string[] } | "missing">): typeof fetch {
  return async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const name = decodeURIComponent(url.split("/").at(-1) ?? "");
    const entry = versions[name];
    if (entry === undefined || entry === "missing") return new Response("missing", { status: 404 });
    const published = entry.versions ?? [entry.latest];
    const body = {
      "dist-tags": { latest: entry.latest },
      versions: Object.fromEntries(published.map((version) => [version, {}])),
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
}

describe("checkFrameworkPackages", () => {
  it("warns about a compatible update and a major update differently", async () => {
    const fixture = await writeConsumer(
      {
        dependencies: {
          "@app-framework/app-config": "^1.0.0",
          "@app-framework/dev-tools": "^1.0.0",
        },
      },
      {
        "@app-framework/app-config": "1.0.0",
        "@app-framework/dev-tools": "1.4.2",
      },
    );

    const result = await checkFrameworkPackages({
      cwd: fixture.cwd,
      cachePath: fixture.cachePath,
      scope: SCOPE,
      fetch: registry({
        "@app-framework/app-config": { latest: "1.2.0" },
        "@app-framework/dev-tools": { latest: "2.0.0" },
      }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.lines).toEqual([
      "@app-framework/app-config  1.0.0 → 1.2.0  compatible update",
      "@app-framework/dev-tools  1.4.2 → 2.0.0  major update",
    ]);
  });

  it("stays quiet when installed versions are current or ahead", async () => {
    const fixture = await writeConsumer(
      { dependencies: { "@app-framework/app-config": "^1.2.0" } },
      { "@app-framework/app-config": "1.3.0" },
    );
    const result = await checkFrameworkPackages({
      cwd: fixture.cwd,
      cachePath: fixture.cachePath,
      scope: SCOPE,
      fetch: registry({ "@app-framework/app-config": { latest: "1.2.0" } }),
    });
    expect(result).toEqual({ exitCode: 0, lines: [] });
  });

  it("ignores third-party dependencies", async () => {
    const fixture = await writeConsumer(
      {
        dependencies: { react: "^19.0.0", "@app-framework/app-config": "^1.0.0" },
      },
      { react: "18.0.0", "@app-framework/app-config": "1.0.0" },
    );
    const result = await checkFrameworkPackages({
      cwd: fixture.cwd,
      cachePath: fixture.cachePath,
      scope: SCOPE,
      fetch: async (input) => {
        const url = String(input);
        if (url.includes("react")) throw new Error("third-party package was queried");
        return registry({ "@app-framework/app-config": { latest: "1.0.1" } })(input);
      },
    });
    expect(result.lines).toEqual(["@app-framework/app-config  1.0.0 → 1.0.1  compatible update"]);
  });

  it("reports a required package that was never installed", async () => {
    const fixture = await writeConsumer({
      dependencies: { react: "^19.0.0" },
      appFramework: { required: ["@app-framework/app-config"] },
    });
    const before = await readFile(fixture.manifestPath, "utf8");
    const result = await checkFrameworkPackages({
      cwd: fixture.cwd,
      cachePath: fixture.cachePath,
      scope: SCOPE,
      fetch: registry({}),
    });
    expect(result.exitCode).toBe(0);
    expect(result.lines).toEqual(["@app-framework/app-config  required package is not installed"]);
    expect(await readFile(fixture.manifestPath, "utf8")).toBe(before);
  });

  it("reports a declared framework package that is not installed", async () => {
    const fixture = await writeConsumer({
      devDependencies: { "@app-framework/dev-tools": "^0.1.0" },
    });
    const result = await checkFrameworkPackages({
      cwd: fixture.cwd,
      cachePath: fixture.cachePath,
      scope: SCOPE,
      fetch: registry({}),
    });
    expect(result.lines).toEqual(["@app-framework/dev-tools  is not installed"]);
  });

  it("chooses the highest stable version when the latest tag is a prerelease", async () => {
    const fixture = await writeConsumer(
      { dependencies: { "@app-framework/app-config": "^1.0.0" } },
      { "@app-framework/app-config": "1.0.0" },
    );
    const result = await checkFrameworkPackages({
      cwd: fixture.cwd,
      cachePath: fixture.cachePath,
      scope: SCOPE,
      fetch: registry({
        "@app-framework/app-config": { latest: "2.0.0-beta.1", versions: ["1.4.0", "2.0.0-beta.1"] },
      }),
    });
    expect(result.lines).toEqual(["@app-framework/app-config  1.0.0 → 1.4.0  compatible update"]);
  });

  it("exits 0 when the registry times out and there is no cache", async () => {
    const fixture = await writeConsumer(
      { dependencies: { "@app-framework/app-config": "^1.0.0" } },
      { "@app-framework/app-config": "1.0.0" },
    );
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        const abort = () => reject(init?.signal?.reason ?? new Error("aborted"));
        if (init?.signal?.aborted) {
          abort();
          return;
        }
        init?.signal?.addEventListener("abort", abort, { once: true });
      });

    const result = await checkFrameworkPackages({
      cwd: fixture.cwd,
      cachePath: fixture.cachePath,
      scope: SCOPE,
      timeoutMs: 20,
      fetch: fetchImpl,
    });
    expect(result.exitCode).toBe(0);
    expect(result.lines).toEqual(["registry unavailable; version check skipped"]);
  });

  it("exits 0 when the registry cannot be reached", async () => {
    const fixture = await writeConsumer(
      { dependencies: { "@app-framework/app-config": "^1.0.0" } },
      { "@app-framework/app-config": "1.0.0" },
    );
    const result = await checkFrameworkPackages({
      cwd: fixture.cwd,
      cachePath: fixture.cachePath,
      scope: SCOPE,
      fetch: async () => {
        throw new Error("getaddrinfo ENOTFOUND");
      },
    });
    expect(result).toEqual({
      exitCode: 0,
      lines: ["registry unavailable; version check skipped"],
    });
  });

  it("uses a fresh cache without calling the registry again", async () => {
    const fixture = await writeConsumer(
      { dependencies: { "@app-framework/app-config": "^1.0.0" } },
      { "@app-framework/app-config": "1.0.0" },
    );
    let calls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      calls += 1;
      return registry({ "@app-framework/app-config": { latest: "1.2.0" } })(input, init);
    };
    const options = {
      cwd: fixture.cwd,
      cachePath: fixture.cachePath,
      scope: SCOPE,
      now: 1_000,
      cacheTtlMs: 50,
      fetch: fetchImpl,
    };
    const first = await checkFrameworkPackages(options);
    const second = await checkFrameworkPackages({
      ...options,
      fetch: async () => {
        throw new Error("cache was not used");
      },
    });
    expect(first.lines).toEqual(["@app-framework/app-config  1.0.0 → 1.2.0  compatible update"]);
    expect(second.lines).toEqual(first.lines);
    expect(calls).toBe(1);
  });

  it("falls back to a stale cache when the registry fails", async () => {
    const fixture = await writeConsumer(
      { dependencies: { "@app-framework/app-config": "^1.0.0" } },
      { "@app-framework/app-config": "1.0.0" },
    );
    await checkFrameworkPackages({
      cwd: fixture.cwd,
      cachePath: fixture.cachePath,
      scope: SCOPE,
      now: 1_000,
      fetch: registry({ "@app-framework/app-config": { latest: "2.0.0" } }),
    });
    const result = await checkFrameworkPackages({
      cwd: fixture.cwd,
      cachePath: fixture.cachePath,
      scope: SCOPE,
      now: 1_000 + 13 * 60 * 60 * 1000,
      fetch: async () => {
        throw new Error("offline");
      },
    });
    expect(result.exitCode).toBe(0);
    expect(result.lines).toEqual([
      "@app-framework/app-config  1.0.0 → 2.0.0  major update",
      "registry unavailable; used cached versions",
    ]);
  });

  it("rejects unreadable local input", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "framework-check-bad-"));
    await writeFile(path.join(cwd, "package.json"), "{");
    const result = await checkFrameworkPackages({ cwd, scope: SCOPE, fetch: registry({}) });
    expect(result.exitCode).toBe(1);
    expect(result.lines[0]).toContain("not valid JSON");
  });
});

describe("cli", () => {
  it("prints nothing when there is nothing to report", async () => {
    const fixture = await writeConsumer({ name: "consumer", private: true });
    const logs: string[] = [];
    const code = await runCli(["--cwd", fixture.cwd, "--no-cache"], (line) => logs.push(line));
    expect(code).toBe(0);
    expect(logs).toEqual([]);
  });

  it("returns 1 for a missing manifest or a bad flag", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "framework-check-cli-"));
    const logs: string[] = [];
    expect(await runCli(["--cwd", cwd], (line) => logs.push(line))).toBe(1);
    expect(logs[0]).toContain("Could not read package.json");
    expect(parseArgs(["--timeout"])).toEqual({ ok: false, message: "Missing value for --timeout." });
    expect(formatReport(["@app-framework/app-config  1.0.0 → 2.0.0  major update"])).toBe(
      "framework-check\n  @app-framework/app-config  1.0.0 → 2.0.0  major update",
    );
  });
});
