# Consumer contract

How App-Template, and later each application, consumes this repository. The purpose of the repository is [`PROJECT-DEFINITION.md`](PROJECT-DEFINITION.md). Implementations stay here. An application does not copy package source, and it does not depend on this git history as a substitute for a published release.

The packages are private until the npm scope in [`framework.scope.json`](../framework.scope.json) is confirmed and the first versions are published. Setup reports that state. It does not add a `git` or `file` dependency, and it does not edit `package.json`.

## Select capabilities

Commit `framework.config.json` at the application root. Omitting `capabilities` selects every mandatory and default-enabled capability for the profile. The static-web defaults are `app-config` (mandatory), `ui`, `dev-tools`, `cursor-standards`, and `deploy-static`. A mandatory capability cannot be turned off. `package-release` runs in App-Framework and is rejected if an application selects it.

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

`workflowRef` is `main` or `deploy-static-vN` (for example `deploy-static-v1`). `deploy` paths are relative. Install and build commands are single lines. The profile `static-web` publishes a static directory. A Node.js server profile and a container profile are not implemented; setup rejects any other profile name.

`framework-setup --list` prints the manifest: id, class, enablement, distribution status, and whether the application can select it.

## Run setup

After `@app-framework/dev-tools` is published, the application adds it as a dev dependency and runs:

```json
{
  "scripts": {
    "framework:setup": "framework-setup",
    "framework:check": "framework-check"
  }
}
```

```bash
pnpm framework:setup --dry-run
pnpm framework:setup
pnpm framework:setup --check
```

`--dry-run` prints the plan and writes nothing. A second run reports standards and a managed caller as unchanged. `--check` compares the installed standards pin with the standards shipped by the command and writes nothing. Exit code 0 means the configuration is valid, including when npm packages are reported as unpublished. Exit code 1 means the configuration or the manifest is invalid.

Until the package is published, run the same command from a checkout of App-Framework after `pnpm build`:

```bash
node packages/dev-tools/dist/setup-cli.js --cwd <application> --dry-run
```

`node scripts/sync-cursor-standards.mjs --target <application>` copies only the Cursor rules. Prefer `framework-setup` when the rest of the configuration should be validated too.

Setup does four things with the current manifest:

1. It validates the profile, the capability names, and the deploy settings.
2. It resolves each selected capability to the package, files, or workflow in the manifest, including runtime dependencies such as `semver` for dev-tools and the four deploy secrets.
3. It copies `standards/cursor/rules` into `.cursor/rules/framework` and writes `.cursor/framework-standards.json` with `version`, `source`, and `commit`. Files directly in that `framework` directory that are no longer in the standards set are removed. Other Cursor rules, including files in subfolders of `framework`, stay. Turning the capability off leaves a previous copy in place.
4. It writes `.github/workflows/deploy.yml` when that file is missing or when the file already starts with `# managed-by: @app-framework/dev-tools deploy-static`. An application-owned workflow is left unchanged.

For an unpublished package the line is `blocked` and names the package version. No dependency is added. After publication, once the manifest marks the package `available`, the line is the `pnpm add` command to run. Setup still leaves `package.json` unchanged so the lockfile update stays a commit in the application. `framework-check` then reports later versions and still does not edit files. Its flags are listed in [`packages/dev-tools/README.md`](../packages/dev-tools/README.md).

Application source, `package.json`, and rules outside `.cursor/rules/framework` are preserved.

## Packages

These commands work after the registry release exists. They fail today.

```bash
pnpm add @app-framework/ui
pnpm add @app-framework/app-config
pnpm add -D @app-framework/dev-tools
```

`appFramework.required` in `package.json` lists framework packages the checker should treat as mandatory. The checker reports a required package that is absent. It ignores unrelated dependencies.

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

## Static deployment

The shared implementation is [`.github/workflows/deploy-static.yml`](../.github/workflows/deploy-static.yml). Callers reference it. They do not copy it.

```yaml
uses: Clain-Apps/App-Framework/.github/workflows/deploy-static.yml@main
```

```yaml
uses: Clain-Apps/App-Framework/.github/workflows/deploy-static.yml@deploy-static-v1
```

`main` runs the workflow currently on the protected default branch. A reviewed fix applies on the next deploy without editing the caller. A breaking change on `main` also applies on that next run. Use `main` when the default branch is protected and the application wants central fixes immediately.

`deploy-static-v1` runs that tag until someone moves it. A compatible fix is adopted by moving the tag. A caller-contract change uses a new tag, such as `deploy-static-v2`, and the application edits `workflowRef` when it is ready. `framework-check` does not report workflow tags.

The workflow runs only when called. It checks out the caller repository, runs the caller's install and build commands, and publishes `output_directory`. Empty commands fail. The commands are single-line strings in the caller file. `rollback` is the caller's `workflow_dispatch` input; the called workflow reads that input because a called workflow does not see the caller's event name reliably.

It refuses to deploy `Clain-Apps/App-Template` and `Clain-Apps/App-Framework`, to deploy as root, or to publish environment files or a `node_modules` / `.git` directory inside the output directory. A release is a new directory under `/all-apps/<repository-name>/releases/<sha>-<run id>-<run attempt>`. The repository name comes from the GitHub repository that triggered the run, so each application has its own directory. `current` moves only after the entry file is present, and only when `current` is a symlink. Rollback points `current` at `previous` when that previous release still has the entry file.

The workflow creates and switches that application's release directory. It does not modify any other path. An existing host that serves `/root/apps/<repository-name>/current` keeps serving that directory. Pointing the host at `/all-apps/<repository-name>/current` is a separate change and was not done from this repository. The deploy account needs write access to `/all-apps/<repository-name>/`. This repository does not create that directory on the server.

The Next.js profile is `.nvmrc`, `pnpm install --frozen-lockfile`, `pnpm check`, `out`, and `index.html`. There is no Node.js server profile and no container profile.

The caller below is what setup writes for `workflowRef` `main`. The first line marks it as framework-managed so a later setup can update the ref and the build inputs. A caller without that line is left alone.

```yaml
# managed-by: @app-framework/dev-tools deploy-static
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
    uses: Clain-Apps/App-Framework/.github/workflows/deploy-static.yml@main
    with:
      rollback: "${{ github.event_name == 'workflow_dispatch' && inputs.rollback }}"
      node_version_file: ".nvmrc"
      install_command: "pnpm install --frozen-lockfile"
      build_command: "pnpm check"
      output_directory: "out"
      entry_file: "index.html"
    secrets:
      VPS_HOST: "${{ secrets.VPS_HOST }}"
      VPS_USER: "${{ secrets.VPS_USER }}"
      VPS_SSH_KEY: "${{ secrets.VPS_SSH_KEY }}"
      VPS_KNOWN_HOSTS: "${{ secrets.VPS_KNOWN_HOSTS }}"
```

Pass those four secrets by name. Do not use `secrets: inherit`. The caller and the called workflow both request `contents: read`.

To pin a release, set `workflowRef` to `deploy-static-v1` and run setup again. The managed caller is rewritten to that tag.

## What App-Template adds

This is the integration contract for [Clain-Apps/App-Template](https://github.com/Clain-Apps/App-Template).

1. Commit the `framework.config.json` in "Select capabilities" for the static-web profile, with `workflowRef` of `main` or `deploy-static-v1`.
2. Keep the landing page, the starter's own configuration values, and the per-application secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, and `VPS_KNOWN_HOSTS`.
3. After `@app-framework/dev-tools` is on the registry, add it as a dev dependency and add the `framework:setup` and `framework:check` scripts above. Run `pnpm framework:setup` and commit `.cursor/rules/framework`, `.cursor/framework-standards.json`, and the managed `.github/workflows/deploy.yml`.
4. After `@app-framework/app-config` and `@app-framework/ui` are on the registry, add the ranges setup prints and commit the lockfile. Load UI from a client component as shown above. Call `loadPublicConfig` from browser code.
5. Replace a copied deploy workflow with the thin caller. Keep the caller. Link to `REUSABLE_PATTERNS_CATALOGUE.md` in this repository. Do not copy the catalogue or the workflow implementation.
6. Leave App-Template's own repository out of deployment. The shared workflow skips `Clain-Apps/App-Template`.

Generated applications inherit that caller and that config. They pin their own package versions afterward. A later commit in App-Framework does not edit them.

## Current blockers

- The three packages have no registry release. `scopeConfirmed` is false. Setup reports them as unpublished. The publication checklist is in [`architecture.md`](architecture.md).
- GitHub can resolve the caller only after `.github/workflows/deploy-static.yml` is on the default branch of `Clain-Apps/App-Framework`. The tag `deploy-static-v1` has to point at a commit that contains the file before a pinned caller can run. Neither ref is created by editing the file locally.
- For a private repository, GitHub Actions access must allow repositories in `Clain-Apps` to call workflows from this repository. That setting is in the repository's Actions settings.
- The deploy account must be able to create `/all-apps/<repository-name>/`. No directory on the server was created or modified from this change. Hosts still pointed at `/root/apps/<repository-name>/current` are unchanged.
- App-Template's current deploy workflow is still its own copy. Switch it to the caller above only after the shared workflow is on the default branch, and treat the `/all-apps` path as a new directory rather than a move of an existing one.
- There is no shared Node.js server profile and no container profile.
