# Project definition

App-Framework is the authoritative source of reusable solutions for applications in the [Clain-Apps](https://github.com/Clain-Apps) organisation. It holds the shared packages, architectural standards, Cursor rules, deployment workflow, and capability contracts that more than one application would otherwise copy.

It exists so an improvement is made once, in one repository, and existing and future applications adopt it deliberately. Application repositories keep their product behaviour. They receive framework behaviour by version, by a standards pin, or by a workflow reference.

## Problems it solves

- The same interface elements, environment parsing, and version check were being rewritten in each application.
- Cursor guidance drifted because each repository kept its own copy of the rules.
- Static deployment logic was copied into application workflows, including the release directory layout and rollback.
- A written idea for a shared capability was easy to mistake for something an application could already install.

## What belongs here

- Reusable packages with a small public contract: `@app-framework/ui`, `@app-framework/app-config`, and `@app-framework/dev-tools`.
- Shared standards and workflows that are not packages: Cursor rules in `standards/cursor`, and the static deployment workflow.
- The capability contract in [`capabilities/manifest.json`](../capabilities/manifest.json), and the human inventory in [`REUSABLE_PATTERNS_CATALOGUE.md`](../REUSABLE_PATTERNS_CATALOGUE.md).
- `framework-setup`, the command an application runs to validate its selection and apply the capabilities that have a working distribution mechanism.
- This repository's own CI and package release workflow.

Every pattern belongs to one class:

| Class | Meaning |
| --- | --- |
| Core capability | Required by every applicable application profile, or enabled for that profile unless the application turns it off. |
| Optional capability | Enabled when the product needs it. None are implemented yet. |
| Shared standard or workflow | A convention or GitHub Actions workflow maintained here and consumed by reference. |
| Candidate | A documented recurring pattern with no central implementation yet. |

The manifest records the implemented rows: identifier, purpose, location, class, version, dependencies, configuration schema, integration method, compatibility, and whether the capability is mandatory, default-enabled, or opt-in. Candidates stay in the catalogue. A catalogue row is not a promise to build the pattern.

## What belongs in App-Template

App-Template is the bootable starter at [Clain-Apps/App-Template](https://github.com/Clain-Apps/App-Template). It owns project setup, the landing page, the starter's configuration values, and the thin caller that references this repository. It installs published framework packages. It does not reimplement them. The shared deploy connection is a Clain-Apps organisation setting.

This repository does not depend on App-Template, and it does not contain a landing page or a starter application.

## What belongs in an application

Product screens, data, business rules, and the choice of which optional capabilities to adopt. The application pins package versions, commits the synced Cursor rules and their version pin, stores its own secrets, and keeps the thin deployment caller. Project-specific Cursor rules stay in that application's `.cursor/rules`, outside `.cursor/rules/framework`.

## How a new application consumes it

The application commits `framework.config.json` and, once `@app-framework/dev-tools` is published, runs:

```bash
pnpm framework:setup
```

Setup reads that file, checks the requested capabilities against the manifest, resolves their dependencies, and applies the distribution mechanism each capability actually has. Today that means copying Cursor standards and writing the static deploy caller. The npm packages have no registry release, so setup reports them and leaves `package.json` unchanged. The steps, the configuration file, and the caller are in [`consumer-contract.md`](consumer-contract.md).

Authoritative implementations stay in this repository. Setup does not copy package source into the application.

## How an existing application receives updates

An application changes only when someone updates that application.

- A package update is a new published version, then a dependency and lockfile change in the application. `framework-check` reports the difference and does not edit files. Nothing is published while `scopeConfirmed` is false in [`framework.scope.json`](../framework.scope.json).
- A standards update is a new `standards/cursor/version.json`, then `framework-setup` (or `framework-setup --check` to compare) in the application, then a commit of `.cursor/rules/framework` and `.cursor/framework-standards.json`. The pin records the standards version and the framework commit.
- A deployment update follows the caller's workflow ref. `main` runs the workflow on the protected default branch, so a reviewed fix applies on the next deploy without editing the caller. `deploy-static-v1` stays on that tag until someone moves it. The trade-off is in the consumer contract.

Publishing, syncing, or moving a ref does not rewrite an application's product source.

## Implemented and planned

Implemented and selectable for the `static-web` profile:

- `@app-framework/ui`, `@app-framework/app-config`, and `@app-framework/dev-tools` (source is here; registry install is blocked)
- Cursor standards in `standards/cursor`
- Static deployment to `/all-apps/<repository-name>/`, with versioned release directories and rollback. `DEPLOY_ROOT` supplies `/all-apps`, and the directory name is the calling repository.

Implemented and not selectable by an application:

- Package release through Changesets and `.github/workflows/release.yml`

Planned only as catalogue entries: lint presets, database access, identity, billing, a Node.js server deploy profile, containers, and the rest of the candidate list. Those rows are not packages, and setup rejects their names.

The static profile builds a directory of files. It does not start a Node.js server and it does not build a container image.

## Distribution

| Capability | Mechanism | Current state |
| --- | --- | --- |
| npm packages | registry | Unpublished. `scopeConfirmed` is false. An anonymous lookup on 26 October 2026 returned HTTP 404 for all three names. A 404 does not show who owns `@app-framework`. |
| Cursor standards | file copy | Available from a checkout, and from the `framework-setup` command. |
| Static deployment | `workflow_call` | The workflow file is in this repository. Another repository can call it after the file is on the default branch of `Clain-Apps/App-Framework`. |
| Package release | this repository's release workflow | Skipped until the scope is confirmed. The manual publication steps are in [`architecture.md`](architecture.md). |

Setup can show the plan before it writes files: `framework-setup --dry-run`. Running it again applies the same standards and the same managed caller, and it leaves application source and application-owned workflows in place.
