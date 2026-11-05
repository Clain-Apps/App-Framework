import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(path.join(root, ".github/workflows/deploy.yml"), "utf8");
const wrapper = readFileSync(path.join(root, ".github/workflows/deploy-static.yml"), "utf8");
const manifest = JSON.parse(readFileSync(path.join(root, "capabilities/manifest.json"), "utf8")) as {
  repository: string;
  templateRepository: string;
  deployRoot: string;
};

const sha = "a".repeat(40);
const releaseId = `${sha}-11-1`;

function bashExecutable(): string {
  const candidates = process.platform === "win32" ? ["C:\\Program Files\\Git\\bin\\bash.exe", "bash"] : ["bash"];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["-c", "echo ok"], { encoding: "utf8" });
    if (probe.status === 0 && probe.stdout.includes("ok")) return candidate;
  }
  throw new Error("bash is required to test the release rules");
}

const bashBin = bashExecutable();

function releaseRules(): string {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex((line) => line.includes("# BEGIN release-rules"));
  const end = lines.findIndex((line) => line.includes("# END release-rules"));
  if (start < 0 || end < 0 || end <= start) throw new Error("release rules markers are missing");
  const block = lines.slice(start + 1, end);
  const indent = Math.min(
    ...block.filter((line) => line.trim() !== "").map((line) => line.match(/^ */)?.[0].length ?? 0),
  );
  return `${block.map((line) => line.slice(indent)).join("\n")}\n`;
}

const rules = releaseRules();

function runBash(script: string, env: Record<string, string> = {}): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(bashBin, ["-s"], {
    input: script,
    encoding: "utf8",
    env: { ...process.env, MSYS_NO_PATHCONV: "1", MSYS2_ARG_CONV_EXCL: "*", ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function runRules(env: Record<string, string>, prelude = "", epilogue = ""): { status: number | null; stdout: string; stderr: string } {
  return runBash(`${prelude}${rules}${epilogue}`, env);
}

function fields(stdout: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const line of stdout.trim().split("\n")) {
    const index = line.indexOf("=");
    if (index <= 0) throw new Error(`Unexpected plan line: ${line}`);
    parsed[line.slice(0, index)] = line.slice(index + 1);
  }
  return parsed;
}

function plan(env: Record<string, string>) {
  return runRules({
    RELEASE_COMMAND: "plan",
    GITHUB_SHA: sha,
    GITHUB_RUN_ID: "11",
    GITHUB_RUN_ATTEMPT: "1",
    ...env,
  });
}

function supportsSymlinks(): boolean {
  const result = runBash(`
    set -euo pipefail
    d=$(mktemp -d)
    mkdir -p "$d/releases/target"
    printf 'hi' > "$d/releases/target/index.html"
    ln -sfn releases/target "$d/current"
    if [[ -L "$d/current" && "$(readlink "$d/current")" == "releases/target" ]]; then
      printf 'yes'
    else
      printf 'no'
    fi
    rm -rf "$d"
  `);
  return result.status === 0 && result.stdout.trim() === "yes";
}

const symlinks = supportsSymlinks();

describe("application deployment workflow", () => {
  const document = parse(workflow) as {
    on?: {
      workflow_call?: {
        inputs?: Record<string, { required?: boolean; type?: string; default?: unknown }>;
        secrets?: Record<string, { required?: boolean }>;
      };
    };
    permissions?: { contents?: string };
    jobs?: {
      deploy?: {
        if?: string;
        permissions?: { contents?: string };
        env?: Record<string, string>;
        steps?: Array<{ name?: string; run?: string; if?: string }>;
      };
    };
  };

  it("is a workflow_call contract with read-only contents permission", () => {
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
    expect(workflow).not.toContain("/root/apps");
    expect(workflow).not.toContain("/all-apps");
    expect(workflow).not.toContain("FLOWVPS_");
  });

  it("takes shared org inputs, an application name, and only the SSH secrets", () => {
    const call = document.on?.workflow_call;
    for (const input of [
      "profile",
      "vps_host",
      "vps_user",
      "deploy_root",
      "app_name",
      "allow_root",
      "rollback",
      "node_version_file",
      "install_command",
      "build_command",
      "output_directory",
      "entry_file",
      "systemd_unit",
      "healthcheck_url",
      "healthcheck_timeout",
    ]) {
      expect(call?.inputs, input).toHaveProperty(input);
    }
    expect(call?.inputs?.profile?.required).toBe(true);
    expect(call?.inputs?.vps_host?.required).toBe(true);
    expect(call?.inputs?.vps_user?.required).toBe(true);
    expect(call?.inputs?.deploy_root?.required).toBe(true);
    expect(call?.inputs?.app_name?.required).toBe(false);
    expect(call?.inputs?.allow_root?.default).toBe(false);
    expect(Object.keys(call?.secrets ?? {}).sort()).toEqual(["VPS_KNOWN_HOSTS", "VPS_SSH_KEY"]);
    expect(document.jobs?.deploy?.env).toMatchObject({
      VPS_HOST: "${{ inputs.vps_host }}",
      VPS_USER: "${{ inputs.vps_user }}",
      DEPLOY_ROOT: "${{ inputs.deploy_root }}",
      APP_NAME_INPUT: "${{ inputs.app_name }}",
      ALLOW_ROOT: "${{ inputs.allow_root }}",
      VPS_SSH_KEY: "${{ secrets.VPS_SSH_KEY }}",
      VPS_KNOWN_HOSTS: "${{ secrets.VPS_KNOWN_HOSTS }}",
    });
    expect(workflow).not.toContain("secrets.VPS_HOST");
    expect(workflow).not.toContain("secrets.VPS_USER");
  });

  it("keeps strict SSH, profile packaging, and upload exclusions", () => {
    expect(workflow).toContain("actions/checkout@v4");
    expect(workflow).toContain("pnpm/action-setup@v4");
    expect(workflow).toContain("steps.package-manager.outputs.manager == 'pnpm'");
    expect(workflow).toContain("Detected package manager:");
    expect(workflow).toContain("cache: ${{ steps.package-manager.outputs.cache }}");
    expect(workflow).not.toContain("\n          cache: pnpm\n");
    expect(workflow).toContain("actions/setup-node@v4");
    expect(workflow).toContain('bash --noprofile --norc -c "${INSTALL_COMMAND}"');
    expect(workflow).toContain('bash --noprofile --norc -c "${BUILD_COMMAND}"');
    expect(workflow).toContain(`${manifest.deployRoot}`);
    expect(workflow).toContain("StrictHostKeyChecking=yes");
    expect(workflow).toContain("IdentitiesOnly=yes");
    expect(workflow).toContain("GlobalKnownHostsFile=/dev/null");
    expect(workflow).toContain("Refusing to deploy as root.");
    expect(workflow).toContain("--exclude '.git'");
    expect(workflow).toContain("--exclude '.github'");
    expect(workflow).toContain("--exclude 'node_modules'");
    expect(workflow).toContain("--exclude '.env'");
    expect(workflow).toContain("--exclude '.env.*'");
    expect(workflow).toContain('if [[ "${DEPLOY_PROFILE}" == "static" ]]; then');
    expect(workflow).toContain("Assemble the Next.js standalone directory");
    expect(workflow).toContain("Health check failed. Rolling back.");
    expect(workflow).not.toContain("docker");
    expect(workflow).toContain("Caddy and other host routing stay outside this workflow.");
    expect(runBash(rules, { RELEASE_COMMAND: "" }).status).toBe(0);
    expect(dedentRun(stepRun("Write the release rules"))).toContain("\nEND_RELEASE_SCRIPT\n");
    expect(dedentRun(stepRun("Publish the release"))).toContain("\nEOF\n");
  });
});

describe("static compatibility wrapper", () => {
  const document = parse(wrapper) as {
    on?: {
      workflow_call?: {
        inputs?: Record<string, { required?: boolean }>;
        secrets?: Record<string, { required?: boolean }>;
      };
    };
    jobs?: { deploy?: { uses?: string; with?: Record<string, string> } };
  };

  it("calls the canonical workflow at main with the static profile", () => {
    expect(Object.keys(document.on ?? {})).toEqual(["workflow_call"]);
    expect(document.jobs?.deploy?.uses).toBe("Clain-Apps/App-Framework/.github/workflows/deploy.yml@main");
    expect(document.jobs?.deploy?.with?.profile).toBe("static");
    expect(document.jobs?.deploy?.with?.vps_host).toBe("${{ inputs.vps_host }}");
    expect(document.jobs?.deploy?.with?.deploy_root).toBe("${{ inputs.deploy_root }}");
    expect(wrapper).toContain("deploy-static-v1 is not moved");
    expect(wrapper).not.toContain("/all-apps");
    expect(wrapper).not.toContain("BEGIN release-rules");
  });
});

function stepRun(name: string): string {
  const document = parse(workflow) as {
    jobs?: { deploy?: { steps?: Array<{ name?: string; run?: string }> } };
  };
  const step = document.jobs?.deploy?.steps?.find((item) => item.name === name);
  if (step?.run === undefined) throw new Error(`Missing run script: ${name}`);
  return step.run;
}

function dedentRun(script: string): string {
  const lines = script.split("\n");
  const indent = Math.min(...lines.filter((line) => line.trim() !== "").map((line) => line.match(/^ */)?.[0].length ?? 0));
  return `${lines.map((line) => line.slice(indent)).join("\n")}\n`;
}

describe("release paths and rollback decisions", () => {
  it("is valid bash", () => {
    const checked = spawnSync(bashBin, ["-n"], { input: rules, encoding: "utf8" });
    expect(checked.status, checked.stderr).toBe(0);
  });

  it("derives each application under the supplied deploy root", () => {
    const demo = fields(expectSuccess(plan({ DEPLOY_ROOT: "/apps", GITHUB_REPOSITORY: "Clain-Apps/Demo" })).stdout);
    expect(demo).toEqual({
      app_root: "/apps/Demo",
      destination: `/apps/Demo/releases/${releaseId}`,
      release_id: releaseId,
      app_name: "Demo",
    });
    const demoRoot = demo.app_root ?? "";
    const demoDestination = demo.destination ?? "";

    const other = fields(expectSuccess(plan({ DEPLOY_ROOT: "/srv/apps", GITHUB_REPOSITORY: "Clain-Apps/Other" })).stdout);
    const otherRoot = other.app_root ?? "";
    expect(otherRoot).toBe("/srv/apps/Other");
    expect(other.destination).toBe(`/srv/apps/Other/releases/${releaseId}`);
    expect(otherRoot.startsWith(`${demoRoot}/`)).toBe(false);
    expect(demoRoot.startsWith(`${otherRoot}/`)).toBe(false);
    expect(demoDestination.startsWith(`${otherRoot}/`)).toBe(false);
  });

  it("uses an explicit application name independent of the repository", () => {
    const named = fields(
      expectSuccess(
        plan({ DEPLOY_ROOT: "/apps", GITHUB_REPOSITORY: "Clain-Apps/AppHub", APP_NAME_INPUT: "allapps" }),
      ).stdout,
    );
    expect(named).toEqual({
      app_root: "/apps/allapps",
      destination: `/apps/allapps/releases/${releaseId}`,
      release_id: releaseId,
      app_name: "allapps",
    });
  });

  it("appends the calling application name instead of replacing another application directory", () => {
    const nested = fields(
      expectSuccess(plan({ DEPLOY_ROOT: "/apps/Victim", GITHUB_REPOSITORY: "Clain-Apps/Other" })).stdout,
    );
    expect(nested.app_root).toBe("/apps/Victim/Other");
    expect(nested.app_name).toBe("Other");
    expect(nested.app_root).not.toBe("/apps/Victim");
    expect(nested.destination).toBe(`/apps/Victim/Other/releases/${releaseId}`);
  });

  it("rejects a deploy root or application name that can escape the application directory", () => {
    const roots = [
      "",
      "/",
      "../apps",
      "/apps/../etc",
      "/apps/releases",
      "/apps/Demo/current",
      "/apps/Demo/previous",
      "/apps/Demo/releases/abc",
      "/apps/Demo/shared",
      "apps",
    ];
    for (const deployRoot of roots) {
      const result = plan({ DEPLOY_ROOT: deployRoot, GITHUB_REPOSITORY: "Clain-Apps/Demo" });
      expect(result.status, deployRoot).not.toBe(0);
    }

    const repositories = ["Demo", "Clain-Apps/../Demo", "Clain-Apps/Demo/extra", "Clain-Apps/.hidden", "Clain-Apps/has space"];
    for (const repository of repositories) {
      const result = plan({ DEPLOY_ROOT: "/apps", GITHUB_REPOSITORY: repository });
      expect(result.status, repository).not.toBe(0);
    }

    for (const name of ["../x", "has space", ".hidden", "releases", "current", "previous", "shared"]) {
      const result = plan({ DEPLOY_ROOT: "/apps", GITHUB_REPOSITORY: "Clain-Apps/Demo", APP_NAME_INPUT: name });
      expect(result.status, name).not.toBe(0);
    }

    const badSha = plan({
      DEPLOY_ROOT: "/apps",
      GITHUB_REPOSITORY: "Clain-Apps/Demo",
      GITHUB_SHA: "abc",
    });
    expect(badSha.status).not.toBe(0);
    expect(badSha.stderr).toContain("Release id is not safe.");
  });

  it("plans activation and refuses a current path that is not a release symlink", () => {
    const first = expectSuccess(
      runRules({ RELEASE_COMMAND: "plan-activation", CURRENT_STATE: "missing", CURRENT_TARGET: "", RELEASE_ID: releaseId }),
    );
    expect(fields(first.stdout)).toEqual({ current: `releases/${releaseId}` });

    const next = expectSuccess(
      runRules({
        RELEASE_COMMAND: "plan-activation",
        CURRENT_STATE: "link",
        CURRENT_TARGET: `releases/${sha}-10-1`,
        RELEASE_ID: releaseId,
      }),
    );
    expect(fields(next.stdout)).toEqual({
      previous: `releases/${sha}-10-1`,
      current: `releases/${releaseId}`,
    });

    for (const target of ["/etc/passwd", "releases/../etc", "releases/not-a-release", "current"]) {
      const refused = runRules({
        RELEASE_COMMAND: "plan-activation",
        CURRENT_STATE: "link",
        CURRENT_TARGET: target,
        RELEASE_ID: releaseId,
      });
      expect(refused.status, target).not.toBe(0);
    }

    const directory = runRules({
      RELEASE_COMMAND: "plan-activation",
      CURRENT_STATE: "other",
      CURRENT_TARGET: "",
      RELEASE_ID: releaseId,
    });
    expect(directory.status).not.toBe(0);
    expect(directory.stderr).toContain("not a symlink");
  });

  it("plans rollback only to a previous release symlink that still has its entry file", () => {
    const ready = expectSuccess(
      runRules({
        RELEASE_COMMAND: "plan-rollback",
        PREVIOUS_STATE: "link",
        PREVIOUS_TARGET: `releases/${sha}-10-1`,
        ENTRY_PRESENT: "yes",
        CURRENT_STATE: "link",
      }),
    );
    expect(fields(ready.stdout)).toEqual({ current: `releases/${sha}-10-1` });

    const missing = runRules({
      RELEASE_COMMAND: "plan-rollback",
      PREVIOUS_STATE: "missing",
      PREVIOUS_TARGET: "",
      ENTRY_PRESENT: "no",
      CURRENT_STATE: "link",
    });
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain("No previous release is recorded.");

    const empty = runRules({
      RELEASE_COMMAND: "plan-rollback",
      PREVIOUS_STATE: "link",
      PREVIOUS_TARGET: `releases/${sha}-10-1`,
      ENTRY_PRESENT: "no",
      CURRENT_STATE: "missing",
    });
    expect(empty.status).not.toBe(0);
    expect(empty.stderr).toContain("Previous release has no entry file.");

    const outside = runRules({
      RELEASE_COMMAND: "plan-rollback",
      PREVIOUS_STATE: "link",
      PREVIOUS_TARGET: "/etc/passwd",
      ENTRY_PRESENT: "yes",
      CURRENT_STATE: "link",
    });
    expect(outside.status).not.toBe(0);

    const blocked = runRules({
      RELEASE_COMMAND: "plan-rollback",
      PREVIOUS_STATE: "link",
      PREVIOUS_TARGET: `releases/${sha}-10-1`,
      ENTRY_PRESENT: "yes",
      CURRENT_STATE: "other",
    });
    expect(blocked.status).not.toBe(0);
    expect(blocked.stderr).toContain("not a symlink");
  });

  it("refuses a root account unless allow_root is set, and accepts a normal deploy account", () => {
    const rootUser = runRules({ RELEASE_COMMAND: "require-account", VPS_HOST: "vps.example", VPS_USER: "root" });
    expect(rootUser.status).not.toBe(0);
    expect(rootUser.stderr).toContain("Refusing to deploy as root.");

    const allowedRoot = runRules({
      RELEASE_COMMAND: "require-account",
      VPS_HOST: "vps.example",
      VPS_USER: "root",
      ALLOW_ROOT: "true",
    });
    expect(allowedRoot.status, allowedRoot.stderr).toBe(0);

    const accepted = runRules({ RELEASE_COMMAND: "require-account", VPS_HOST: "vps.example", VPS_USER: "deploy" });
    expect(accepted.status, accepted.stderr).toBe(0);

    for (const [host, user] of [
      ["", "deploy"],
      ["-oProxyCommand", "deploy"],
      ["host name", "deploy"],
      ["vps.example", "Admin"],
    ] as const) {
      const refused = runRules({ RELEASE_COMMAND: "require-account", VPS_HOST: host, VPS_USER: user });
      expect(refused.status, `${host} ${user}`).not.toBe(0);
      expect(refused.stderr).not.toContain("Refusing to deploy as root.");
    }
  });

  it("accepts the three deployment profiles and a systemd unit", () => {
    for (const profile of ["static", "node", "next-standalone"]) {
      const result = runRules({ RELEASE_COMMAND: "require-profile", DEPLOY_PROFILE: profile });
      expect(result.status, profile).toBe(0);
    }
    const unknown = runRules({ RELEASE_COMMAND: "require-profile", DEPLOY_PROFILE: "container" });
    expect(unknown.status).not.toBe(0);

    const unit = runRules({ RELEASE_COMMAND: "require-unit", SYSTEMD_UNIT: "allapps.service" });
    expect(unit.status, unit.stderr).toBe(0);
    const badUnit = runRules({ RELEASE_COMMAND: "require-unit", SYSTEMD_UNIT: "../evil.service" });
    expect(badUnit.status).not.toBe(0);
  });

  it("plans a health check and fails when the endpoint is unreachable", () => {
    const planned = expectSuccess(
      runRules({
        RELEASE_COMMAND: "plan-healthcheck",
        HEALTHCHECK_URL: "http://127.0.0.1:3000/health",
        HEALTHCHECK_TIMEOUT: "20",
      }),
    );
    expect(fields(planned.stdout)).toEqual({ url: "http://127.0.0.1:3000/health", timeout: "20" });

    const badUrl = runRules({
      RELEASE_COMMAND: "plan-healthcheck",
      HEALTHCHECK_URL: "file:///etc/passwd",
      HEALTHCHECK_TIMEOUT: "20",
    });
    expect(badUrl.status).not.toBe(0);

    const failed = runRules({
      RELEASE_COMMAND: "healthcheck",
      HEALTHCHECK_URL: "http://127.0.0.1:1/health",
      HEALTHCHECK_TIMEOUT: "1",
    });
    expect(failed.status).not.toBe(0);
  });

  it.skipIf(!symlinks)("activates and rolls back one application without changing another", () => {
    const second = `${sha}-12-1`;
    const result = runRules(
      {},
      `
        set -euo pipefail
        d=$(mktemp -d)
        trap 'rm -rf "$d"' EXIT
        app="$d/apps/Demo"
        other="$d/apps/Other"
        mkdir -p "$app/releases/${releaseId}" "$app/shared" "$other/releases/${releaseId}"
        printf 'one' > "$app/releases/${releaseId}/index.html"
        printf 'keep' > "$app/shared/secret.env"
        printf 'other' > "$other/releases/${releaseId}/index.html"
        ln -sfn "releases/${releaseId}" "$other/current"
        export APP_ROOT="$app"
        export RELEASE_ID="${releaseId}"
        export ENTRY_FILE="index.html"
        export RELEASE_COMMAND="activate"
      `,
      `
        mkdir -p "$app/releases/${second}"
        printf 'two' > "$app/releases/${second}/index.html"
        export RELEASE_ID="${second}"
        apply_activation
        test "$(readlink "$app/previous")" = "releases/${releaseId}"
        test "$(readlink "$app/current")" = "releases/${second}"
        test "$(cat "$app/shared/secret.env")" = "keep"
        apply_rollback
        test "$(readlink "$app/current")" = "releases/${releaseId}"
        test "$(readlink "$other/current")" = "releases/${releaseId}"
        test "$(cat "$other/current/index.html")" = "other"
        rm "$app/current"
        mkdir "$app/current"
        if apply_activation; then
          echo "replaced a real directory" >&2
          exit 1
        fi
        printf 'ISOLATED\\n'
      `,
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("ISOLATED");
  });
});

describe("deploy tag procedure", () => {
  it("prints the deploy-v1 commands and does not create a tag", () => {
    const result = spawnSync(process.execPath, [path.join(root, "scripts", "verify-deploy-tag.mjs")], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("does not create or move a tag");
    expect(result.stdout).toContain("git tag -a deploy-v1 origin/main");
    expect(result.stdout).toContain("deploy-static-v1");
  });
});

function expectSuccess(result: { status: number | null; stdout: string; stderr: string }) {
  expect(result.status, result.stderr).toBe(0);
  return result;
}
