# Architecture

App-Framework is the central source of recurring application patterns. It publishes independently versioned packages, and it maintains shared standards and workflows that are not packages. It does not host a running application.

App-Template consumes those packages, conventions, and workflows. It owns the bootable starter: project setup, the landing page, per-application secrets, and the thin caller for the static deployment workflow. Individual applications own their unique behaviour. This repository must not depend on App-Template or on any generated application.

Patterns have one of three homes, recorded in [`REUSABLE_PATTERNS_CATALOGUE.md`](../REUSABLE_PATTERNS_CATALOGUE.md):

- A reusable package, installed by version.
- A centrally managed standard or workflow, consumed by reference.
- A documented candidate, which is a roadmap entry and not an implemented capability.

## Package boundaries

Each package has one responsibility and one JavaScript entry, `"."`. `@app-framework/ui` also exports its stylesheet.

| Package | Responsibility |
| --- | --- |
| `@app-framework/ui` | `af-*` custom elements and tag-name styles for theme, headings, and panels. |
| `@app-framework/app-config` | Typed environment contracts, validation, and the split between server-only and browser-safe values. |
| `@app-framework/dev-tools` | `framework-check`, which compares installed framework packages with the latest stable npm versions. |

`ui` and `app-config` have no runtime dependencies. `dev-tools` depends only on `semver`. None of the packages depend on each other, so a release of one does not version the other.

Consumers import the public entry, and the UI stylesheet when they use elements. Deep imports of `src` or `dist` internals are not part of the contract.

The npm scope is recorded in [`framework.scope.json`](../framework.scope.json). Package names must match that scope. Until `scopeConfirmed` is true, the packages stay private and the release workflow does not publish.

## Standards and workflows

Shared development conventions live in [`standards/cursor/`](../standards/cursor). [`scripts/sync-cursor-standards.mjs`](../scripts/sync-cursor-standards.mjs) copies a pinned version into a consumer. They are not an npm package, and `framework-check` does not report them. Project-specific architectural rules stay in the application that needs them. The interface rule in [`.cursor/rules/ui-elements.mdc`](../.cursor/rules/ui-elements.mdc) applies to this repository only.

The reusable static deployment workflow is [`.github/workflows/deploy-static.yml`](../.github/workflows/deploy-static.yml). Callers pin a git tag. This repository's own [CI](../.github/workflows/ci.yml) and [release](../.github/workflows/release.yml) workflows validate and version the framework. They are not the application deployment.

## Dependency rules

- A package declares every package it imports.
- Shared behaviour lives in a package with a real public API, not in a general `core` package.
- A new folder is added only when there is a working implementation.
- Universal packages do not import Next.js or a hosting provider SDK.
- Application-specific code stays in the application repository.

When a package does depend on another framework package, Changesets is configured with `updateInternalDependencies: "patch"` and with empty `fixed` and `linked` groups. The dependent is versioned on that release, including when its current range would still accept the new version. Unrelated packages are not.

## Release flow

Packages and non-package patterns are versioned differently.

1. Change a package and add a changeset that names only the affected packages.
2. Merge to `main`. GitHub Actions opens or updates a version pull request.
3. Merge the version pull request.
4. The release workflow publishes changed packages and their dependents, then pushes package tags, once the npm scope is confirmed and trusted publishing is configured.
5. Consuming apps detect newer package versions with `framework-check`. They are not updated automatically, and the checker does not edit their dependency files.

`framework-check` exits 0 for warnings and for registry failures, so a development script can continue. It exits 1 only when the local manifest cannot be read.

A workflow change is adopted when a caller moves from one git tag to another, such as `deploy-static-v1`. A convention change is adopted by bumping `standards/cursor/version.json`, rerunning the sync script, and committing the copied rules. That version is not an npm version. Neither path rewrites an application's source on its own. App-Template keeps its current deploy workflow until `deploy-static-v1` exists.

## What does not belong here

- A Next.js landing page, starter application, or hosting platform.
- A feature used by only one application.
- A speculative package for a catalogue item that no consumer needs yet.
- A custom registry, installer, or management UI for the catalogue.
- A Node.js deployment profile. Only the static profile is shared.

An item becomes a package only after the decision test in [`AGENTS.md`](../AGENTS.md) says the behaviour is a reusable implementation with a stable interface. Standards and workflows stay out of npm. Candidates stay in the catalogue until a real implementation exists.

## Decisions

Record a new-capability decision in the pull request. If it changes what the framework owns, update this document or the catalogue in the same change.

- The shared interface belongs in `@app-framework/ui` as custom elements styled by tag name. Tabs, accordions, graphs, calendars, modals, menus, routing, and animation wait until an application needs them.
- A database package waits until two applications would copy the same client setup. It will wrap an established library, not an ORM or an engine.
- Typed environment loading belongs in `@app-framework/app-config` because every server application repeats it and the contract is small.
- Version awareness for published packages belongs in `@app-framework/dev-tools`. The command reports versions and does not change dependency files. It does not track conventions or workflows.
- Shared development conventions belong in `standards/cursor`. Cursor applies the copy a consumer commits. It does not apply rules merely because they are stored in this GitHub repository.
- The common static deployment process belongs in the reusable workflow. App-Template keeps the landing page, per-application secrets, and, once `deploy-static-v1` exists, the thin caller. Who owns which of those decisions is written in [`Responsibilities.md`](Responsibilities.md).
