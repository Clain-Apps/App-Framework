# Consumer contract

How App-Template, and later each application, consumes this repository. The purpose of the repository is [`PROJECT-DEFINITION.md`](PROJECT-DEFINITION.md). Implementations stay here. An application does not copy package source, and it does not depend on this git history as a substitute for a published release.

The packages are private until the npm scope in [`framework.scope.json`](../framework.scope.json) is confirmed and the first versions are published. The CLI reports that state. It does not add a `git` or `file` dependency. `framework setup` does not edit `package.json`. `framework add` and `framework upgrade` edit dependency files only when the selected package is marked `available` in the manifest.

## Select capabilities

Commit `framework.config.json` at the application root. The same file is used by applications created from App-Template and by existing applications that run `framework adopt`.

Framework integration is independent of the static-web deploy profile. An application can adopt shared configuration, UI modules, and Cursor standards without selecting a frontend or deploy stack. `profile` is optional. It is a deploy profile, not an application type.

Omitting `capabilities` selects every mandatory and default-enabled capability that is compatible with the chosen profile. With no profile, that is `app-config` (mandatory), `ui`, `dev-tools`, and `cursor-standards`. `deploy` is opt-in. It is selected when `workflowRef` or `deploy` settings are present, or when `capabilities.deploy` is true. `deploy-static` remains an alias of `deploy`. A mandatory capability cannot be turned off. `package-release` runs in App-Framework and is rejected if an application selects it.

Existing-application adoption writes:

```json
{
  "capabilities": {
    "app-config": true,
    "cursor-standards": true,
    "dev-tools": true,
    "ui": true
  }
}
```

A static-web application that also wants the shared deploy caller uses:

```json
{
  "profile": "static-web",
  "workflowRef": "main",
  "deploy": {
    "nodeVersionFile": ".nvmrc",
    "installCommand": "pnpm install --frozen-lockfile",
    "buildCommand": "pnpm check",
    "outputDirectory": "out",
    "entryFile": "index.html"
  }
}
```

A Next.js standalone application, for example AppHub deployed as `allapps`, uses:

```json
{
  "profile": "next-standalone",
  "workflowRef": "deploy-v1",
  "deploy": {
    "nodeVersionFile": ".nvmrc",
    "installCommand": "pnpm install --frozen-lockfile",
    "buildCommand": "pnpm build",
    "outputDirectory": ".next/standalone",
    "entryFile": "server.js",
    "appName": "allapps",
    "systemdUnit": "allapps.service",
    "healthcheckUrl": "http://127.0.0.1:3000/health"
  }
}
```

`workflowRef` is `main`, `deploy-vN` (for example `deploy-v1`), or a frozen static pin `deploy-static-vN`. `deploy` paths are relative. Install and build commands are single lines. `appName` is optional; empty uses the GitHub repository name. Server profiles require `systemdUnit` and `healthcheckUrl`. `allowRoot` defaults to false. A container profile is not implemented.

Selecting a profile and deploy settings does not write a GitHub Actions caller. Run `framework deploy enable --dry-run` after the configuration is valid.

`framework modules` prints the manifest: id, class, enablement, distribution status, whether the application can select it, and whether it is on in the current configuration.

## Run the CLI

After `@app-framework/dev-tools` is published, the application adds it as a dev dependency and runs:

```json
{
  "scripts": {
    "framework": "framework",
    "framework:setup": "framework-setup",
    "framework:check": "framework-check"
  }
}
```

```bash
pnpm framework doctor
pnpm framework adopt --dry-run
pnpm framework adopt
pnpm framework modules
pnpm framework add cursor-standards
pnpm framework upgrade --dry-run
pnpm framework upgrade
pnpm framework deploy enable --dry-run
pnpm framework deploy enable
```

`framework-setup` and `framework-check` remain aliases. Setup applies the current `framework.config.json`. Check compares installed package versions. Prefer the `framework` commands for new scripts.

`--dry-run` prints the plan and writes nothing. A second `adopt` or `setup` run reports managed files as unchanged. `--check` on setup or upgrade compares without writing. Exit code 0 from setup means the configuration is valid, including when npm packages are reported as unpublished. Exit code 1 means the configuration is invalid, or a Framework-managed path conflicts with an application-owned file.

`framework doctor` reports one of: `not-integrated`, `integrated`, `update-available`, `configuration-drift`, `conflict`, `capability-unavailable`. It also reports which deploy profiles are available and whether the application looks compatible with them. An unpublished selected package is `capability-unavailable`, not `integrated`. An application-owned `deploy.yml` is a `conflict` when `deploy` is selected, and a reported existing system when it is not. A configured deploy profile without an enabled caller is `configuration-drift`.

Until the package is published, run the same commands from a checkout of App-Framework after `pnpm build`:

```bash
node packages/dev-tools/dist/framework-cli.js adopt --cwd <application> --dry-run
node packages/dev-tools/dist/framework-cli.js doctor --cwd <application>
```

`node scripts/sync-cursor-standards.mjs --target <application>` is a compatibility shim for the standards copy after `pnpm build`. Prefer `framework adopt` or `framework upgrade`.

Adopt and setup do the following with the current manifest:

1. Validate `framework.config.json` against the capability names and, when selected, the deploy settings.
2. Resolve each selected capability to the package, files, or workflow in the manifest, including runtime dependencies such as `semver` for dev-tools and the organisation deploy variables and secrets.
3. Copy `standards/cursor/rules` into `.cursor/rules/framework` and write `.cursor/framework-standards.json` with `version`, `source`, and `commit`. Files directly in that `framework` directory that are no longer in the standards set are removed. Other Cursor rules, including files in subfolders of `framework`, stay. Turning the capability off leaves a previous copy in place.
4. Do not write `.github/workflows/deploy.yml`. `framework deploy enable` writes that caller in a separate step. `--dry-run` prints the plan and any conflicting active workflows. `--approve-switch` archives a legacy workflow to `.github/workflow-archive/` and then writes the managed caller. The old file is not deleted. A managed caller starts with `# managed-by: @app-framework/dev-tools deploy`. The previous `deploy-static` marker is still recognised.

For an unpublished package the line is `blocked` and names the package version. No dependency is added. After publication, once the manifest marks the package `available`, `framework add <module>` and `framework upgrade` install the versioned dependency with the application's existing package manager and update the lockfile. Setup still leaves `package.json` unchanged. Package versions are also compared by `framework-check`. Selected npm capabilities in `framework.config.json` are the required set. `appFramework.required` in `package.json` is a legacy fallback used only when `framework.config.json` is absent.

Application source, package manager, database, and backend architecture are preserved. Adopt does not enable `deploy` and does not write a caller.

## Packages

These commands work after the registry release exists. They fail today.

```bash
pnpm add @app-framework/ui
pnpm add @app-framework/app-config
pnpm add -D @app-framework/dev-tools
```

Selected npm capabilities in `framework.config.json` are the packages the checker treats as required. `appFramework.required` in `package.json` is read only when that file is absent. The checker reports a required package that is absent. It ignores unrelated dependencies.

### Interface

Load the stylesheet and register the elements from a browser. Style and markup use the tag names.

```ts
import { defineAppElements } from "@app-framework/ui";
import "@app-framework/ui/styles.css";

defineAppElements();
```

```html
<af-theme name="light">
  <af-heading level="1">Title</af-heading>
  <af-panel>Content</af-panel>
</af-theme>
```

`af-theme` accepts `light` or `dark`. `af-heading` uses `level` from 1 to 6. The package does not include routing, tabs, accordions, graphs, calendars, modals, or menus.

Next.js evaluates a client component on the server, where `HTMLElement` is missing, so call `defineAppElements()` inside `useEffect`. The package can be imported in that environment, and `defineAppElements()` returns without registering until `customElements` exists.

```tsx
"use client";

import { useEffect } from "react";
import { defineAppElements } from "@app-framework/ui";
import "@app-framework/ui/styles.css";

export function RegisterAppElements() {
  useEffect(() => {
    defineAppElements();
  }, []);
  return null;
}
```

Render `<af-theme>`, `<af-heading>`, and `<af-panel>` as tags. The browser upgrades them after registration. `af-heading` sets `role="heading"` and `aria-level` when it connects. The package does not depend on Next.js or React.

### Configuration

```ts
import { defineConfig, loadConfig, loadPublicConfig } from "@app-framework/app-config";

const definition = defineConfig({
  server: {
    DATABASE_URL: { kind: "url" },
  },
  public: {
    APP_NAME: { kind: "string" },
    APP_URL: { kind: "url" },
  },
});

const config = loadConfig(definition, process.env);
const publicConfig = loadPublicConfig(definition, process.env);
```

`loadConfig` returns `{ server, public }` or throws `ConfigError` with every problem. Server error text does not include the rejected value. `loadPublicConfig` reads only public keys. In browser code, call `loadPublicConfig`. `loadConfig` with `{ runtime: "browser" }` throws before it reads server values.

Supported field kinds are `string`, `number`, `boolean`, `url`, and `enum`. A field is required unless it sets `default` or `required: false`. Empty strings are missing. A key cannot appear in both sections.

## Application deployment

The shared implementation is [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). Callers reference it. They do not copy it. [`.github/workflows/deploy-static.yml`](../.github/workflows/deploy-static.yml) is a compatibility wrapper that calls `deploy.yml@main` with `profile: static`.

```yaml
uses: Clain-Apps/App-Framework/.github/workflows/deploy.yml@main
```

```yaml
uses: Clain-Apps/App-Framework/.github/workflows/deploy.yml@deploy-v1
```

```yaml
uses: Clain-Apps/App-Framework/.github/workflows/deploy-static.yml@deploy-static-v1
```

`main` runs the workflow currently on the protected default branch. A reviewed fix applies on the next deploy without editing the caller. A breaking change on `main` also applies on that next run. Use `main` while iterating. Production callers pin `deploy-v1`.

`deploy-v1` is the current production pin. Cut it from a commit that contains `deploy.yml`. Do not move the frozen tag `deploy-static-v1`. Existing callers of that tag keep the historic static workflow until they migrate. A caller-contract change uses a new tag, such as `deploy-v2`, and the application edits `workflowRef` when it is ready. `framework-check` does not report workflow tags.

The workflow runs only when called. It checks out the caller repository, runs the caller's install and build commands, and publishes `output_directory`. The `next-standalone` profile also copies `.next/static` and `public` into that directory. Empty commands fail. The commands are single-line strings in the caller file. `rollback` is the caller's `workflow_dispatch` input.

It refuses to deploy `Clain-Apps/App-Template` and `Clain-Apps/App-Framework`, to deploy as root unless `allow_root` is true, or to publish environment files, `.git`, or `.github`. Static releases also refuse `node_modules`. Server releases keep runtime `node_modules`. A release is a new directory under `/apps/<app-name>/releases/<sha>-<run id>-<run attempt>`. `app-name` comes from the `app_name` input, or from the calling repository when that input is empty. `deploy_root` is the shared parent; default `DEPLOY_ROOT` is `/apps`. The workflow only changes `releases/<id>`, `current`, and `previous` inside that application directory. It creates `shared/` and never deletes it. `current` moves only after the entry file is present, and only when `current` is absent or already a symlink. Rollback points `current` at `previous` when that previous release still has the entry file.

Server profiles restart the configured systemd unit after activation and curl `healthcheck_url` on the VPS. A failed restart or health check rolls `current` back and restarts the previous release. Application data and secrets stay outside the release directory, typically in `shared/` or a systemd `EnvironmentFile`. Caddy and other host routing stay in the application or host repository.

The workflow creates and switches that application's release directory. It leaves every other path unchanged. Pointing a host at `/apps/<app-name>/current` is a separate change and was not done from this repository. The deploy account needs write access to `/apps/<app-name>/`. This repository does not create that directory on the server.

### Organisation variables and secrets

Set these on the Clain-Apps organisation and grant them to application repositories. The called workflow reads the caller's inputs and secrets. It does not read organisation settings itself.

| Name | Kind | Value |
| --- | --- | --- |
| `VPS_HOST` | Variable | SSH hostname |
| `VPS_USER` | Variable | Deploy account. Non-root unless `allow_root` is true. |
| `DEPLOY_ROOT` | Variable | `/apps` |
| `VPS_SSH_KEY` | Secret | Private key for that account |
| `VPS_KNOWN_HOSTS` | Secret | `known_hosts` line for `VPS_HOST`, used with `StrictHostKeyChecking=yes` |

Product secrets stay with the application. These five values are the shared deploy connection. Do not introduce `FLOWVPS_*` names.

The static Next.js export profile is `.nvmrc`, `pnpm install --frozen-lockfile`, `pnpm check`, `out`, and `index.html`. The Next.js standalone profile is `.nvmrc`, `pnpm install --frozen-lockfile`, `pnpm build`, `.next/standalone`, and `server.js`, plus a systemd unit and health-check URL.

The caller below is what `framework deploy enable` writes for `workflowRef` `main` and `profile` `static-web`. The first line marks it as framework-managed. A caller without that line is left alone until `--approve-switch` archives it.

```yaml
# managed-by: @app-framework/dev-tools deploy
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      rollback:
        description: Repoint current at the previous release
        required: false
        type: boolean
        default: false

permissions:
  contents: read

jobs:
  deploy:
    permissions:
      contents: read
    uses: Clain-Apps/App-Framework/.github/workflows/deploy.yml@main
    with:
      profile: static
      vps_host: "${{ vars.VPS_HOST }}"
      vps_user: "${{ vars.VPS_USER }}"
      deploy_root: "${{ vars.DEPLOY_ROOT }}"
      rollback: "${{ github.event_name == 'workflow_dispatch' && inputs.rollback }}"
      node_version_file: ".nvmrc"
      install_command: "pnpm install --frozen-lockfile"
      build_command: "pnpm check"
      output_directory: "out"
      entry_file: "index.html"
    secrets:
      VPS_SSH_KEY: "${{ secrets.VPS_SSH_KEY }}"
      VPS_KNOWN_HOSTS: "${{ secrets.VPS_KNOWN_HOSTS }}"
```

Pass those two secrets by name. Do not use `secrets: inherit`. The caller and the called workflow both request `contents: read`.

To pin a release, set `workflowRef` to `deploy-v1` and run `framework deploy enable`. Existing static callers can keep `deploy-static.yml@deploy-static-v1` until they migrate; that tag is not moved.

## What App-Template adds

This is the integration contract for [Clain-Apps/App-Template](https://github.com/Clain-Apps/App-Template).

1. Commit the `framework.config.json` in "Select capabilities". Generated static-web applications include `profile`, `workflowRef`, and `deploy`. Existing applications can start from the adoption file, with no deploy profile.
2. Keep the landing page and the starter's own configuration values. Use the Clain-Apps organisation variables `VPS_HOST`, `VPS_USER`, and `DEPLOY_ROOT`, and the organisation secrets `VPS_SSH_KEY` and `VPS_KNOWN_HOSTS`.
3. After `@app-framework/dev-tools` is on the registry, add it as a dev dependency and add the `framework` scripts above. Run `pnpm framework adopt` or `pnpm framework:setup` and commit `.cursor/rules/framework` and `.cursor/framework-standards.json`. Write the managed deploy caller with `pnpm framework deploy enable` in a separate change.
4. After `@app-framework/app-config` and `@app-framework/ui` are on the registry, add the ranges setup prints and commit the lockfile. Load UI from a client component as shown above. Call `loadPublicConfig` from browser code.
5. Replace a copied deploy workflow with `framework deploy enable --dry-run`, then `--approve-switch` after reviewing the conflict report. Keep the managed caller. Link to `REUSABLE_PATTERNS_CATALOGUE.md` in this repository. Do not copy the catalogue or the workflow implementation.
6. Leave App-Template's own repository out of deployment. The shared workflow skips `Clain-Apps/App-Template`.

Generated applications inherit that caller and that config. They pin their own package versions afterward. A later commit in App-Framework does not edit them.

## Current blockers

- The three packages have no registry release. `scopeConfirmed` is false. Setup reports them as unpublished. The publication checklist is in [`architecture.md`](architecture.md).
- GitHub can resolve the caller only after `.github/workflows/deploy.yml` is on the default branch of `Clain-Apps/App-Framework`. Cut `deploy-v1` from a commit that contains that file. Do not move `deploy-static-v1`. Neither tag is created by editing the file locally.
- For a private repository, GitHub Actions access must allow repositories in `Clain-Apps` to call workflows from this repository. That setting is in the repository's Actions settings.
- The Clain-Apps organisation variables `VPS_HOST`, `VPS_USER`, and `DEPLOY_ROOT` (`/apps`), and the secrets `VPS_SSH_KEY` and `VPS_KNOWN_HOSTS`, have to exist and be granted to application repositories. This repository does not create them. If the Flow VPS account is root, set `VPS_USER` to `root` and pass `allow_root: true`; non-root remains the default.
- The deploy account must be able to create `/apps/<app-name>/`. Server profiles also need passwordless `systemctl restart` for that unit, `curl` on the host, and a health-check URL reachable from the VPS. No directory on the server was created or modified from this change, and this change was not deployed to the live VPS.
- App-Template and existing applications still keep their own callers until they run `framework deploy enable`. Treat `/apps` as a new directory rather than a move of `/all-apps`.
- There is no container profile. Caddy configuration stays outside App-Framework.
