# Project definition

App-Framework is the authoritative source of reusable solutions for applications in the [Clain-Apps](https://github.com/Clain-Apps) organisation. It holds the shared packages, architectural standards, Cursor rules, deployment workflow, and capability contracts that more than one application would otherwise copy.

It exists so an improvement is made once, in one repository, and existing and future applications adopt it deliberately. Application repositories keep their product behaviour. They receive framework behaviour by version, by a standards pin, or by a workflow reference.

## Problems it solves

- The same interface elements, environment parsing, and version check were being rewritten in each application.
- Cursor guidance drifted because each repository kept its own copy of the rules.
- Deployment logic was copied into application workflows, including the release directory layout and rollback.
- A written idea for a shared capability was easy to mistake for something an application could already install.

## What belongs here

- Reusable packages with a small public contract: `@app-framework/ui`, `@app-framework/app-config`, and `@app-framework/dev-tools`.
- Shared standards and workflows that are not packages: Cursor rules in `standards/cursor`, and the application deployment workflow.
- The capability contract in [`capabilities/manifest.json`](../capabilities/manifest.json), and the human inventory in [`REUSABLE_PATTERNS_CATALOGUE.md`](../REUSABLE_PATTERNS_CATALOGUE.md).
- `framework`, the command an application runs to adopt the framework, inspect integration, list and add implemented capabilities, and apply selected updates. `framework-setup` and `framework-check` remain aliases.
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

The application commits `framework.config.json`. Once `@app-framework/dev-tools` is published, an existing application runs:

```bash
npm exec --yes --package=@app-framework/dev-tools -- framework adopt
```

App-Template should depend on the published packages so a generated application gets the same CLI from `npm install`. Adopt does not copy the Next.js starter, rewrite product code, or write a deploy caller. It does not replace the application's package manager.

The CLI reads `framework.config.json`, checks the requested capabilities against the manifest, resolves their dependencies, and applies the distribution mechanism each capability actually has. Today that means copying Cursor standards. Writing a deploy caller is a separate `framework deploy enable` step. The npm packages have no registry release, so the CLI reports them and does not pretend they are installed. The steps, the configuration file, and the caller are in [`consumer-contract.md`](consumer-contract.md).

Authoritative implementations stay in this repository. Setup does not copy package source into the application.

## How an existing application receives updates

An application changes only when someone updates that application.

- A package update is a new published version, then a dependency and lockfile change in the application. `framework doctor` and `framework-check` report the difference. `framework upgrade` applies compatible updates when the package is available, and does not apply a major update. Nothing is published while `scopeConfirmed` is false in [`framework.scope.json`](../framework.scope.json).
- A standards update is a new `standards/cursor/version.json`, then `framework upgrade` (or `framework upgrade --check` to compare) in the application, then a commit of `.cursor/rules/framework` and `.cursor/framework-standards.json`. The pin records the standards version and the framework commit.
- A deployment update follows the caller's workflow ref. `main` runs the workflow on the protected default branch, so a reviewed fix applies on the next deploy without editing the caller. `deploy-v1` stays on that tag until the application moves the ref. `deploy-static-v1` is not moved. The trade-off is in the consumer contract.

Publishing, syncing, or moving a ref does not rewrite an application's product source.

## Implemented and planned

Implemented and selectable for any JavaScript application:

- `@app-framework/ui`, `@app-framework/app-config`, and `@app-framework/dev-tools` (source is here; registry install is blocked)
- Cursor standards in `standards/cursor`

Implemented and selectable when a deploy profile is chosen and `framework deploy enable` is run:

- Application deployment to `/apps/<app-name>/`, with versioned release directories, symlink activation, and rollback. Profiles are `static-web`, `node-server`, and `next-standalone`. `DEPLOY_ROOT` supplies `/apps`. `app-name` may be set independently of the GitHub repository.

Implemented and not selectable by an application:

- Package release through Changesets and `.github/workflows/release.yml`

Planned only as catalogue entries: lint presets, database access, identity, billing, containers, and the rest of the candidate list. Those rows are not packages, and setup rejects their names.

The static profile builds a directory of files. Server profiles restart a systemd unit and health-check it. None of the profiles build a container image.

## Distribution

| Capability | Mechanism | Current state |
| --- | --- | --- |
| npm packages | registry | Unpublished. `scopeConfirmed` is false. On 5 November 2026 the registry org endpoints for `app-framework` and `clain-apps` returned 404, and this machine was not logged into npm. A 404 does not show who owns `@app-framework`. |
| Cursor standards | file copy | Available from a checkout, and from `framework adopt` / `framework upgrade`. |
| Application deployment | `workflow_call` | The workflow file is in this repository. Another repository can call it after the file is on the default branch of `Clain-Apps/App-Framework`. |
| Package release | this repository's release workflow | Skipped until the scope is confirmed. The manual publication steps are in [`architecture.md`](architecture.md). |

The CLI can show the plan before it writes files: `framework adopt --dry-run`. Running it again applies the same standards and leaves application source and application-owned workflows in place. `framework deploy enable --dry-run` reports caller conflicts without writing.
