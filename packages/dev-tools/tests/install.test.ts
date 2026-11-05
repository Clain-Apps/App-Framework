import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { planFrameworkScript, planPackageInstall, writeFrameworkScript } from "../src/install.js";

const ui = {
  id: "ui",
  packageName: "@app-framework/ui",
  version: "0.1.0",
  dependencyField: "dependencies" as const,
  dependencies: [] as string[],
};

describe("package install plans", () => {
  it("reports an unpublished package without an install command", () => {
    const plan = planPackageInstall({
      ...ui,
      distributionStatus: "unpublished",
      packageJson: {},
      manager: "npm",
    });
    expect(plan.status).toBe("blocked");
    expect(plan.command).toBeUndefined();
    expect(plan.message).toContain("unpublished");
    expect(plan.message).toContain("No dependency was added.");
  });

  it("installs an available package with the application's package manager", () => {
    expect(
      planPackageInstall({ ...ui, distributionStatus: "available", packageJson: {}, manager: "npm" }).args,
    ).toEqual(["install", "@app-framework/ui@^0.1.0", "--save"]);
    expect(
      planPackageInstall({ ...ui, distributionStatus: "available", packageJson: {}, manager: "pnpm" }).args,
    ).toEqual(["add", "@app-framework/ui@^0.1.0"]);
    expect(
      planPackageInstall({
        ...ui,
        id: "dev-tools",
        packageName: "@app-framework/dev-tools",
        dependencyField: "devDependencies",
        distributionStatus: "available",
        packageJson: {},
        manager: "yarn",
      }).args,
    ).toEqual(["add", "--dev", "@app-framework/dev-tools@^0.1.0"]);
  });

  it("leaves a satisfying range, a local range, a newer range, and a major bump unchanged", () => {
    const satisfied = planPackageInstall({
      ...ui,
      distributionStatus: "available",
      packageJson: { dependencies: { "@app-framework/ui": "^0.1.0" } },
      manager: "npm",
    });
    expect(satisfied.status).toBe("unchanged");

    const local = planPackageInstall({
      ...ui,
      distributionStatus: "available",
      packageJson: { dependencies: { "@app-framework/ui": "file:../ui" } },
      manager: "npm",
    });
    expect(local.status).toBe("unchanged");
    expect(local.message).toContain("left unchanged");

    const ahead = planPackageInstall({
      ...ui,
      distributionStatus: "available",
      packageJson: { dependencies: { "@app-framework/ui": "^1.2.0" } },
      manager: "npm",
    });
    expect(ahead.status).toBe("unchanged");

    const major = planPackageInstall({
      ...ui,
      version: "1.0.0",
      distributionStatus: "available",
      packageJson: { dependencies: { "@app-framework/ui": "^0.1.0" } },
      manager: "npm",
    });
    expect(major.status).toBe("major");
    expect(major.command).toBeUndefined();
  });

  it("requires a detected package manager before installing", () => {
    const plan = planPackageInstall({
      ...ui,
      distributionStatus: "available",
      packageJson: {},
      manager: undefined,
    });
    expect(plan.status).toBe("error");
    expect(plan.message).toContain("package manager");
  });

  it("adds the framework script once and does not replace an application script", () => {
    expect(planFrameworkScript({}, false).status).toBe("skip");
    expect(planFrameworkScript({}, true).status).toBe("write");
    expect(planFrameworkScript({ scripts: { framework: "framework" } }, true).status).toBe("unchanged");
    expect(planFrameworkScript({ scripts: { framework: "node app.js" } }, true).status).toBe("conflict");

    const cwd = mkdtempSync(path.join(tmpdir(), "framework-script-"));
    writeFileSync(path.join(cwd, "package.json"), `${JSON.stringify({ name: "sample", scripts: { build: "echo app" } })}\n`);
    try {
      expect(writeFrameworkScript(cwd).status).toBe("write");
      const manifest = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8")) as {
        scripts: Record<string, string>;
      };
      expect(manifest.scripts).toEqual({ build: "echo app", framework: "framework" });
      expect(writeFrameworkScript(cwd).status).toBe("unchanged");

      writeFileSync(
        path.join(cwd, "package.json"),
        `${JSON.stringify({ name: "sample", scripts: { framework: "node app.js" } })}\n`,
      );
      expect(writeFrameworkScript(cwd).status).toBe("conflict");
      expect(JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"))).toEqual({
        name: "sample",
        scripts: { framework: "node app.js" },
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
