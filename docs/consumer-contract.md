# Consumer contract

App-Template, and later each application, installs the published packages. They do not depend on this git repository, and they do not copy these modules into the application.

The packages are private until the npm scope in [`framework.scope.json`](../framework.scope.json) is confirmed and the first versions are published. Do not point an application at a `git` or `file` dependency as a substitute. Wait for the registry versions, then pin them with a normal semver range so upgrades stay deliberate.

## Install

```bash
pnpm add @app-framework/ui
pnpm add @app-framework/app-config
pnpm add -D @app-framework/dev-tools
```

`@app-framework/app-config` and `@app-framework/dev-tools` are the two MVP packages. `@app-framework/ui` is a separate package under the same scope. App-Template does not install it until `npm view @app-framework/ui` resolves a release. Installing the UI package does not install the other two.

Use the scope from `framework.scope.json` if it changes before the first publish.

## Development script

`framework-check` is safe to run at the start of local development. It prints nothing when framework packages are current. Warnings and an unavailable registry exit 0. The command never edits `package.json` or the lockfile.

```json
{
  "scripts": {
    "framework:check": "framework-check",
    "dev": "framework-check && next dev"
  },
  "dependencies": {
    "@app-framework/ui": "^0.1.0",
    "@app-framework/app-config": "^0.1.0"
  },
  "devDependencies": {
    "@app-framework/dev-tools": "^0.1.0"
  },
  "appFramework": {
    "required": ["@app-framework/ui", "@app-framework/app-config", "@app-framework/dev-tools"]
  }
}
```

`appFramework.required` lists framework packages the starter considers mandatory. The checker reports a required package that is absent. It ignores unrelated dependencies such as React.

Optional flags: `--cwd`, `--timeout`, `--cache-path`, `--cache-ttl`, `--registry`, and `--no-cache`. Results are cached for 12 hours under `node_modules/.cache/framework-check.json`.

## Interface

Load the stylesheet and register the elements once. Style and markup use the tag names. Do not restyle them with utility classes.

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

The snippet above is for a browser page. Next.js still evaluates a client component on the server, where `HTMLElement` is missing, so do not call `defineAppElements()` at module scope. The package can be imported in that environment, and `defineAppElements()` returns without registering until `customElements` exists. Load the module and the stylesheet from a client component, and register inside `useEffect`:

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

Render `<af-theme>`, `<af-heading>`, and `<af-panel>` as tags. The browser upgrades them after registration. `af-heading` sets `role="heading"` and `aria-level` when it connects, so the server HTML does not have those attributes yet. The package does not depend on Next.js or React. Do not install it in App-Template while the npm scope is unconfirmed.

## Configuration

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

## Development conventions

Shared naming, structure, TypeScript, testing, and maintainability guidance lives in [`standards/cursor/`](../standards/cursor). The version is `version` in `standards/cursor/version.json`. It is not an npm version, and `framework-check` does not report it.

Cursor reads rules from the consuming project. It does not import them from this repository. Copy the current version with:

```bash
node scripts/sync-cursor-standards.mjs --target <application-directory>
```

Run that command from this repository. It writes `<application>/.cursor/rules/framework/` and `<application>/.cursor/framework-standards.json` with the version, the source path `standards/cursor/rules`, and this repository's current commit. It replaces files in that `framework` directory and leaves every other rule alone. It does not edit application source or dependency files.

Commit the copied rules and the pin. A later change is a bump of `version.json`, a rerun, and a commit in the application. Generated applications are not updated by a later sync in this repository. Product rules stay in the application's own `.cursor/rules`. The interface rule in this repository's `.cursor/rules/ui-elements.mdc` stays here. It is not part of the shared set.

## Static deployment

The shared implementation is [`.github/workflows/deploy-static.yml`](../.github/workflows/deploy-static.yml). It is not an npm package. Callers pin the git tag `deploy-static-v1`. A compatible fix stays on that tag. A change that breaks the caller contract uses a new tag, such as `deploy-static-v2`. `framework-check` does not report workflow tags.

The workflow runs only when called. It does not choose a bundler. The caller passes `node_version_file`, `install_command`, `build_command`, `output_directory`, and `entry_file`. Empty install or build commands fail a normal deploy. Those commands are single-line strings in the caller file. `rollback` is the only `workflow_dispatch` input. The called workflow checks out the caller repository, runs the supplied commands, and publishes `output_directory`.

It refuses to deploy `daniel-clain/App-Template`, to deploy as root, or to publish environment files or a `node_modules` / `.git` directory inside the output directory. A release is a new directory under `/root/apps/<repository-name>/releases/<sha>-<run id>-<run attempt>`. `current` moves only after the entry file is present, and only when `current` is a symlink. Rollback points `current` at `previous` when that previous release still has the entry file.

The Next.js profile is `.nvmrc`, `pnpm install --frozen-lockfile`, `pnpm check`, `out`, and `index.html`. There is no Node.js server profile. Do not call this workflow for an application that must keep a process running.

The caller below is the contract. App-Template does not switch its deploy workflow to it until `deploy-static-v1` exists on GitHub. Until then, App-Template keeps its working deploy workflow.

```yaml
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
    uses: daniel-clain/App-Framework/.github/workflows/deploy-static.yml@deploy-static-v1
    with:
      rollback: ${{ github.event_name == 'workflow_dispatch' && inputs.rollback }}
      node_version_file: .nvmrc
      install_command: pnpm install --frozen-lockfile
      build_command: pnpm check
      output_directory: out
      entry_file: index.html
    secrets:
      VPS_HOST: ${{ secrets.VPS_HOST }}
      VPS_USER: ${{ secrets.VPS_USER }}
      VPS_SSH_KEY: ${{ secrets.VPS_SSH_KEY }}
      VPS_KNOWN_HOSTS: ${{ secrets.VPS_KNOWN_HOSTS }}
```

Pass those four secrets by name. Do not use `secrets: inherit`. The caller and the called workflow both request `contents: read` and nothing else.

This file has to be on the default branch, and the tag `deploy-static-v1` has to point at a commit that contains it, before another repository can call it. Neither is created by adding the file locally. For a private repository, GitHub Actions access must also allow repositories owned by `daniel-clain` to use workflows from this repository. That setting is in the repository's Actions settings, not in the workflow file. A deploy to a server was not run from this change.

## What App-Template must not do

- Redefine `@app-framework/ui`, `@app-framework/app-config`, or `@app-framework/dev-tools`, or maintain a second copy of their behaviour.
- Import anything other than the package root, plus `@app-framework/ui/styles.css` for the interface.
- Add `@app-framework/ui` before a registry release exists.
- Treat [`REUSABLE_PATTERNS_CATALOGUE.md`](../REUSABLE_PATTERNS_CATALOGUE.md) as a menu of packages to generate, or copy it. App-Template may link to it and document the subset the starter uses.
- Edit the synced standards in place. Rerun the sync script from a newer version.
- Point a deploy workflow at `deploy-static-v1` before that tag exists, or copy `.github/workflows/deploy-static.yml` into an application.
- Move a one-application feature into this repository. Extract it only when it is a general capability with a stable interface.
- Expect a publish from this repository to change an application's installed versions.

## Release awareness

After a version pull request is merged and the packages are published, `framework-check` reports a same-major upgrade as `compatible update` and a higher major as `major update`. Installing the new version remains a change in the consumer repository.
