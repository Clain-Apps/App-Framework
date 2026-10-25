# Architecture

App-Framework is the shared library for capabilities that more than one application needs. It publishes independently versioned packages. It does not host a running application.

App-Template consumes the published packages and the standards in this repository. It owns the bootable starter, including development and deployment configuration. Individual applications own their unique behaviour. This repository must not depend on App-Template or on any generated application.

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

## Dependency rules

- A package declares every package it imports.
- Shared behaviour lives in a package with a real public API, not in a general `core` package.
- A new folder is added only when there is a working implementation.
- Universal packages do not import Next.js or a hosting provider SDK.
- Application-specific code stays in the application repository.

When a package does depend on another framework package, Changesets is configured with `updateInternalDependencies: "patch"` and with empty `fixed` and `linked` groups. The dependent is versioned on that release, including when its current range would still accept the new version. Unrelated packages are not.

## Release flow

1. Change a package and add a changeset that names only the affected packages.
2. Merge to `main`. GitHub Actions opens or updates a version pull request.
3. Merge the version pull request.
4. The release workflow publishes changed packages and their dependents, then pushes package tags, once the npm scope is confirmed and trusted publishing is configured.
5. Consuming apps detect newer versions with `framework-check`. They are not updated automatically, and the checker does not edit their dependency files.

`framework-check` exits 0 for warnings and for registry failures, so a development script can continue. It exits 1 only when the local manifest cannot be read.

## What does not belong here

- A Next.js landing page, starter application, or deployment project.
- A feature used by only one application.
- A speculative package for a catalogue item that no consumer needs yet.
- A custom registry or management UI for the capability catalogue.

The catalogue in [`capability-catalogue.md`](capability-catalogue.md) is the long-term map. An item becomes a package only after the decision test in [`AGENTS.md`](../AGENTS.md) says the behaviour is a reusable implementation with a stable interface. Standards, policies, adapters, and template concerns stay out of npm until that test is met.

## Decisions

Record a new-capability decision in the pull request. If it changes what the framework owns, update this document or the catalogue in the same change.

- The shared interface belongs in `@app-framework/ui` as custom elements styled by tag name. Tabs, accordions, graphs, calendars, modals, menus, routing, and animation wait until an application needs them.
- A database package waits until two applications would copy the same client setup. It will wrap an established library, not an ORM or an engine.
- Typed environment loading belongs in `@app-framework/app-config` because every server application repeats it and the contract is small.
- Version awareness belongs in `@app-framework/dev-tools` because adoption of framework releases must stay explicit. The command reports versions and does not change dependency files.
- Project bootstrap, the landing page, and application hosting stay with App-Template. Who owns which of those decisions is written in [`RESPONSIBILITIES.md`](RESPONSIBILITIES.md).
