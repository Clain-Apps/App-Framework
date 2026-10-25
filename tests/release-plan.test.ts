import { assembleReleasePlan } from "@changesets/assemble-release-plan";
import { readConfig } from "@changesets/config";
import type { NewChangeset, Packages } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadConfig(packages: Packages) {
  const parsed = await readConfig(root, packages);
  if (parsed.config === undefined) {
    throw new Error(parsed.errors.join("\n"));
  }
  return parsed.config;
}

describe("independent versions", () => {
  it("versions only the changed package when nothing depends on it", async () => {
    const packages = (await getPackages(root)) as Packages;
    const config = await loadConfig(packages);
    const plan = assembleReleasePlan(
      [
        {
          id: "dev-tools-only",
          summary: "Adjust the version check.",
          releases: [{ name: "@app-framework/dev-tools", type: "patch" }],
        },
      ],
      packages,
      config,
      undefined,
    );

    expect(plan.releases.map((release) => release.name)).toEqual(["@app-framework/dev-tools"]);
  });

  it("versions a changed package and its dependent, and leaves an unrelated package alone", async () => {
    const packages = (await getPackages(root)) as Packages;
    const config = await loadConfig(packages);
    const fixture: Packages = {
      rootDir: "/virtual",
      rootPackage: {
        dir: "/virtual",
        packageJson: { name: "virtual-root", version: "0.0.0", private: true },
      },
      tool: { type: "pnpm" },
      packages: [
        packageAt("@scope/a", "1.2.3"),
        packageAt("@scope/b", "1.2.3", { "@scope/a": "workspace:^1.2.3" }),
        packageAt("@scope/c", "1.2.3"),
      ],
    };
    const changeset: NewChangeset = {
      id: "change-a",
      summary: "Add a feature to A.",
      releases: [{ name: "@scope/a", type: "minor" }],
    };

    const plan = assembleReleasePlan([changeset], fixture, config, undefined);
    const names = plan.releases.map((release) => release.name).sort();

    expect(names).toEqual(["@scope/a", "@scope/b"]);
    expect(plan.releases.find((release) => release.name === "@scope/a")?.type).toBe("minor");
    expect(plan.releases.find((release) => release.name === "@scope/b")?.type).toBe("patch");
  });
});

function packageAt(name: string, version: string, dependencies?: Record<string, string>) {
  return {
    dir: `/virtual/${name}`,
    packageJson: {
      name,
      version,
      ...(dependencies === undefined ? {} : { dependencies }),
    },
  };
}
