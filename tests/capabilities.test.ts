import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assertScopeAgreement, loadCapabilityManifest, type CapabilityManifest } from "../packages/dev-tools/src/capabilities.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const operationalFiles = [
  "README.md",
  "AGENTS.md",
  "docs/PROJECT-DEFINITION.md",
  "docs/Responsibilities.md",
  "docs/architecture.md",
  "docs/consumer-contract.md",
  "REUSABLE_PATTERNS_CATALOGUE.md",
  ".github/workflows/deploy.yml",
  ".github/workflows/deploy-static.yml",
  "framework.scope.json",
  "capabilities/manifest.json",
];

describe("capability contract", () => {
  const loaded = loadCapabilityManifest();

  it("matches the implemented catalogue and the unpublished npm scope", () => {
    const catalogue = readFileSync(path.join(root, "REUSABLE_PATTERNS_CATALOGUE.md"), "utf8");
    const patterns = catalogue.split("## Former requirement index")[0] ?? "";
    const implemented = patterns
      .split(/^### /m)
      .slice(1)
      .filter((block) => /^- Status: implemented$/m.test(block))
      .map((block) => block.split("\n")[0]?.trim());
    expect(loaded.manifest.capabilities.map((capability) => capability.catalogue).sort()).toEqual(implemented.sort());
    expect(loaded.manifest.repository).toBe("Clain-Apps/App-Framework");
    expect(loaded.manifest.templateRepository).toBe("Clain-Apps/App-Template");
    expect(loaded.manifest.deployRoot).toBe("/apps");
    expect(loaded.manifest.profiles.map((profile) => profile.id)).toEqual([
      "static-web",
      "node-server",
      "next-standalone",
    ]);

    const scope = JSON.parse(readFileSync(path.join(root, "framework.scope.json"), "utf8")) as { scopeConfirmed: boolean };
    expect(scope.scopeConfirmed).toBe(false);
    for (const capability of loaded.manifest.capabilities) {
      if (capability.distribution.mechanism === "npm") expect(capability.distribution.status).toBe("unpublished");
    }
    expect(loaded.manifest.capabilities.find((capability) => capability.id === "deploy")?.version).toBe("deploy-v1");
  });

  it("rejects a manifest that marks a package available before the scope is confirmed", () => {
    const scope = JSON.parse(readFileSync(path.join(root, "framework.scope.json"), "utf8")) as unknown;
    const flipped: CapabilityManifest = {
      ...loaded.manifest,
      capabilities: loaded.manifest.capabilities.map((capability) =>
        capability.distribution.mechanism === "npm"
          ? { ...capability, distribution: { ...capability.distribution, status: "available" } }
          : capability,
      ),
    };
    expect(() => assertScopeAgreement(flipped, scope)).toThrow(/not confirmed/);
  });

  it("documents the App-Template integration contract with the current organisation", () => {
    const contract = readFileSync(path.join(root, "docs/consumer-contract.md"), "utf8");
    expect(contract).toContain("pnpm framework:setup");
    expect(contract).toContain("framework adopt");
    expect(contract).toContain("framework.config.json");
    expect(contract).toContain("uses: Clain-Apps/App-Framework/.github/workflows/deploy.yml@main");
    expect(contract).toContain("uses: Clain-Apps/App-Framework/.github/workflows/deploy.yml@deploy-v1");
    expect(contract).toContain("uses: Clain-Apps/App-Framework/.github/workflows/deploy-static.yml@deploy-static-v1");
    expect(contract).toContain("# managed-by: @app-framework/dev-tools deploy");
    expect(contract).toContain("/apps/<app-name>/");
    expect(contract).toContain("scopeConfirmed");
    for (const relative of operationalFiles) {
      expect(readFileSync(path.join(root, relative), "utf8"), relative).not.toContain("daniel-clain");
    }
  });
});
