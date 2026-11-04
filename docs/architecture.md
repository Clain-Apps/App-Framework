# Architecture

App-Framework publishes independently versioned packages and maintains shared standards and workflows. The purpose of the repository, and the split with App-Template and with applications, is [`PROJECT-DEFINITION.md`](PROJECT-DEFINITION.md).

Patterns are listed in [`REUSABLE_PATTERNS_CATALOGUE.md`](../REUSABLE_PATTERNS_CATALOGUE.md). Implemented capabilities are described for setup in [`capabilities/manifest.json`](../capabilities/manifest.json). A catalogue row is not added to the manifest until the artifact exists.

## Package boundaries

Each package has one responsibility and one JavaScript entry, `"."`. `@app-framework/ui` also exports its stylesheet.

| Package | Responsibility |
| --- | --- |
| `@app-framework/ui` | `af-*` custom elements and tag-name styles for theme, headings, and panels. |
| `@app-framework/app-config` | Typed environment contracts, validation, and the split between server-only and browser-safe values. |
| `@app-framework/dev-tools` | `framework-check` and `framework-setup`. The checker compares installed framework packages with the latest stable npm versions. Setup validates `framework.config.json` and applies standards and the static deploy caller. |

`ui` and `app-config` have no runtime dependencies. `dev-tools` depends only on `semver`. None of the packages depend on each other, so a release of one does not version the other. `framework-setup` reads the manifest and the standards from this repository when it runs inside the checkout. The published package carries a copy of that contract and those rules, produced at build time, so an installed CLI can run without this git tree.

Consumers import the public entry, and the UI stylesheet when they use elements. Deep imports of `src` or `dist` internals are not part of the contract.

The npm scope is recorded in [`framework.scope.json`](../framework.scope.json). Package names must match that scope. Until `scopeConfirmed` is true, the packages stay private and the release workflow does not publish. The manifest keeps each package `unpublished` until a registry release exists, including after the scope flag is turned on. Setup reports that status and does not tell an application to install a package the manifest still marks unpublished.

## Standards and workflows

Shared development conventions live in [`standards/cursor/`](../standards/cursor). Setup copies a version into `.cursor/rules/framework` and writes `.cursor/framework-standards.json` with that version and the framework commit. [`scripts/sync-cursor-standards.mjs`](../scripts/sync-cursor-standards.mjs) performs the same copy. `framework-check` does not report the standards version. `framework-setup --check` does. Project-specific rules stay outside that directory. The interface rule in [`.cursor/rules/ui-elements.mdc`](../.cursor/rules/ui-elements.mdc) applies to this repository only.

The reusable static deployment workflow is [`.github/workflows/deploy-static.yml`](../.github/workflows/deploy-static.yml). It is `workflow_call` only. Callers in Clain-Apps reference `Clain-Apps/App-Framework/.github/workflows/deploy-static.yml@main`. The release directory is `<deploy_root>/<repository-name>/`. The organisation variable `DEPLOY_ROOT` is `/all-apps`, and the name is the repository that triggered the caller. The caller passes `vps_host`, `vps_user`, and `deploy_root`. `VPS_SSH_KEY` and `VPS_KNOWN_HOSTS` are organisation secrets. The workflow creates that application's release directory and switches its `current` symlink. It leaves every other path unchanged. An optional `deploy-static-vN` pin is described in the consumer contract.

This repository's own [CI](../.github/workflows/ci.yml) and [release](../.github/workflows/release.yml) workflows validate and version the framework. They are not the application deployment. There is no Node.js server profile and no container profile.

## Dependency rules

- A package declares every package it imports.
- Shared behaviour lives in a package with a real public API, not in a general `core` package.
- A new folder is added only when there is a working implementation.
- Universal packages do not import Next.js or a hosting provider SDK.
- Application-specific code stays in the application repository.
- Setup does not copy package source into an application.

When a package does depend on another framework package, Changesets is configured with `updateInternalDependencies: "patch"` and with empty `fixed` and `linked` groups. The dependent is versioned on that release, including when its current range would still accept the new version. Unrelated packages are not.

## Release flow

Packages and non-package patterns are versioned differently.

1. Change a package and add a changeset that names only the affected packages.
2. Merge to `main`. GitHub Actions opens or updates a version pull request.
3. Merge the version pull request.
4. The release workflow publishes changed packages and their dependents, then pushes package tags, once the npm scope is confirmed and trusted publishing is configured.
5. Consuming apps detect newer package versions with `framework-check`. They are not updated automatically, and the checker does not edit their dependency files.

`framework-check` exits 0 for warnings and for registry failures, so a development script can continue. It exits 1 only when the local manifest cannot be read.

A standards change is adopted by bumping `standards/cursor/version.json`, rerunning setup, and committing the copied rules. That version is not an npm version. A workflow change on `main` is adopted by the next run of a caller that references `main`. A caller that references `deploy-static-v1` stays on that tag until the tag moves. Neither path rewrites an application's source on its own.

## First publication

Do this once, by hand, after the scope is real. The packages stay private until then.

An anonymous lookup on 26 October 2026 received HTTP 404 for `@app-framework/ui`, `@app-framework/app-config`, and `@app-framework/dev-tools`. A 404 means those names were not visible. It does not show that this account owns `@app-framework`, and it does not show that the scope is free. `scopeConfirmed` stays `false`. Nobody publishes under `@app-framework` until the npm account owner confirms the scope in npm's UI.

Setting `scopeConfirmed` to `true` does not create the packages. `scripts/publish.mjs` skips the registry while the flag is false. If the flag were true, that script would refuse to publish while any of the three packages is still private.

1. Confirm that the npm scope is owned and available. If the name is not `@app-framework`, change `framework.scope.json` and the package names together, and update the manifest and the docs that mention the scope.
2. Set `scopeConfirmed` to `true`. Leave each npm capability's `distribution.status` as `unpublished` until step 6 has succeeded. Setup keeps reporting those packages as unpublished, so an application is not told to install a version that is not on the registry yet.
3. Set `"private": false` on each package.
4. Set Changesets `access` to `"public"`.
5. From a logged-in machine, build and publish each package once (`pnpm build`, then `pnpm exec npm publish --access public` in each package directory). Trusted publishing cannot create the first version of a package.
6. Confirm `npm view` for each package. Then set that capability's `distribution.status` to `available` in `capabilities/manifest.json`. Setup will print the `pnpm add` command and will still leave the application's `package.json` unchanged.
7. On npm, for each package, add a GitHub Actions trusted publisher for owner `Clain-Apps`, repository `App-Framework`, workflow filename `release.yml`. Allow `npm publish`. A new trusted-publisher configuration must complete a successful publish within npm's current window (2 days at the time of writing).
8. Later version pulls publish through `.github/workflows/release.yml`. Only changed packages, and packages that depend on them, are released. Each published package gets its own tag.

Choose a license before the first public publish. The private packages are marked `UNLICENSED`.

## What does not belong here

- A Next.js landing page, starter application, or hosting platform.
- A feature used by only one application.
- A speculative package, or a manifest entry, for a catalogue item that no consumer needs yet.
- A module marketplace or a second installer beside `framework-setup`.
- A Node.js server deployment profile, or a container profile. Only the static profile is shared.

An item becomes a package only after the decision test in [`AGENTS.md`](../AGENTS.md) says the behaviour is a reusable implementation with a stable interface. Standards and workflows stay out of npm. Candidates stay in the catalogue until a real implementation exists.

## Decisions

Record a new-capability decision in the pull request. If it changes what the framework owns, update this document, the catalogue, or the manifest in the same change.

- The shared interface belongs in `@app-framework/ui` as custom elements styled by tag name. Tabs, accordions, graphs, calendars, modals, menus, routing, and animation wait until an application needs them.
- A database package waits until two applications would copy the same client setup. It will wrap an established library, not an ORM or an engine.
- Typed environment loading belongs in `@app-framework/app-config` because every server application repeats it and the contract is small.
- Version awareness belongs in `framework-check`. Capability selection and standards sync belong in `framework-setup`. Neither command edits dependency files.
- Shared development conventions belong in `standards/cursor`. Cursor applies the copy an application commits.
- The common static deployment process belongs in the reusable workflow, with releases under `/all-apps/<repository-name>/`. App-Template keeps the landing page and the thin caller. The host, user, deploy root, SSH key, and known hosts are Clain-Apps organisation settings. Who owns which of those decisions is written in [`Responsibilities.md`](Responsibilities.md).
