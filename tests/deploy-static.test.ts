import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(path.join(root, ".github/workflows/deploy-static.yml"), "utf8");
const header = workflow.split("\njobs:")[0] ?? "";

describe("static deployment workflow", () => {
  it("is a workflow_call contract with read-only contents permission", () => {
    expect(header).toContain("workflow_call:");
    expect(header).not.toContain("workflow_dispatch:");
    expect(header).not.toContain("\n  push:");
    expect(header).toContain("contents: read");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).toContain("github.repository != 'daniel-clain/App-Template'");
  });

  it("takes the static profile from the caller and the four deploy secrets by name", () => {
    for (const input of [
      "rollback:",
      "node_version_file:",
      "install_command:",
      "build_command:",
      "output_directory:",
      "entry_file:",
    ]) {
      expect(header).toContain(input);
    }
    for (const secret of ["VPS_HOST:", "VPS_USER:", "VPS_SSH_KEY:", "VPS_KNOWN_HOSTS:"]) {
      expect(header).toContain(secret);
    }
    expect(header).toContain("required: true");
    expect(workflow).toContain("actions/checkout@v4");
    expect(workflow).toContain("repository: ${{ github.repository }}");
    expect(workflow).toContain("ref: ${{ github.sha }}");
    expect(workflow).toContain("pnpm/action-setup@v4");
    expect(workflow).toContain("actions/setup-node@v4");
    expect(workflow).not.toMatch(/run:\s*pnpm check/);
    expect(workflow).not.toContain("out/index.html");
    expect(workflow).toContain('bash --noprofile --norc -c "${INSTALL_COMMAND}"');
    expect(workflow).toContain('bash --noprofile --norc -c "${BUILD_COMMAND}"');
    expect(workflow).toContain("/root/apps/");
  });
});
