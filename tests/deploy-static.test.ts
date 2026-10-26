import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(path.join(root, ".github/workflows/deploy-static.yml"), "utf8");
const manifest = JSON.parse(readFileSync(path.join(root, "capabilities/manifest.json"), "utf8")) as {
  repository: string;
  templateRepository: string;
  deployRoot: string;
};

describe("static deployment workflow", () => {
  const document = parse(workflow) as {
    on?: Record<string, unknown>;
    permissions?: { contents?: string };
    jobs?: {
      deploy?: {
        if?: string;
        permissions?: { contents?: string };
        steps?: Array<{ name?: string; run?: string }>;
      };
    };
  };

  it("is a workflow_call contract with read-only contents permission", () => {
    expect(document.on).toBeTypeOf("object");
    expect(Object.keys(document.on ?? {})).toEqual(["workflow_call"]);
    expect(workflow).not.toContain("workflow_dispatch:");
    expect(workflow).not.toContain("\n  push:");
    expect(document.permissions).toEqual({ contents: "read" });
    expect(document.jobs?.deploy?.permissions).toEqual({ contents: "read" });
    expect(workflow).not.toContain("contents: write");
    expect(workflow).not.toContain("secrets: inherit");
    expect(document.jobs?.deploy?.if).toContain(manifest.templateRepository);
    expect(document.jobs?.deploy?.if).toContain(manifest.repository);
    expect(workflow).not.toContain("daniel-clain");
  });

  it("takes the static profile from the caller and publishes under the manifest deploy root", () => {
    const call = document.on?.workflow_call as {
      inputs?: Record<string, unknown>;
      secrets?: Record<string, { required?: boolean }>;
    };
    for (const input of [
      "rollback",
      "node_version_file",
      "install_command",
      "build_command",
      "output_directory",
      "entry_file",
    ]) {
      expect(call.inputs).toHaveProperty(input);
    }
    for (const secret of ["VPS_HOST", "VPS_USER", "VPS_SSH_KEY", "VPS_KNOWN_HOSTS"]) {
      expect(call.secrets?.[secret]?.required).toBe(true);
    }
    expect(workflow).toContain("actions/checkout@v4");
    expect(workflow).toContain("repository: ${{ github.repository }}");
    expect(workflow).toContain("ref: ${{ github.sha }}");
    expect(workflow).toContain("pnpm/action-setup@v4");
    expect(workflow).toContain("actions/setup-node@v4");
    expect(workflow).not.toMatch(/run:\s*pnpm check/);
    expect(workflow).not.toContain("out/index.html");
    expect(workflow).toContain('bash --noprofile --norc -c "${INSTALL_COMMAND}"');
    expect(workflow).toContain('bash --noprofile --norc -c "${BUILD_COMMAND}"');
    expect(workflow).toContain(`${manifest.deployRoot}/`);
    expect(workflow).not.toContain("/root/apps/");
    expect(workflow).toContain("There is no Node.js server profile and no container profile.");

    const runs = (document.jobs?.deploy?.steps ?? []).map((step) => step.run ?? "").join("\n");
    expect(runs).toContain(`app_root="${manifest.deployRoot}/`);
    expect(runs).not.toContain("docker");
  });
});
