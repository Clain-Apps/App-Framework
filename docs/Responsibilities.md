# Responsibilities

App Framework is the central source of recurring application patterns. An improvement made here can be adopted by applications that already exist and by ones that do not exist yet.

This repository does not own any one application, and it does not assemble a runnable starter. App-Template does that. An application owns its own behaviour.

## Three kinds of pattern

**Reusable packages** are shared programs distributed as versioned npm dependencies. The packages that exist are `@app-framework/ui`, `@app-framework/app-config`, and `@app-framework/dev-tools`. An application installs the ones it uses and chooses the versions. Publishing a version does not change an application that already installed an older one.

**Centrally managed standards and workflows** are shared solutions that are not npm packages. The ones that exist are the development conventions in `standards/cursor`, copied by `scripts/sync-cursor-standards.mjs`, and the reusable static deployment workflow. An application commits the synced rules and a version pin, or a GitHub Actions caller pinned to a tag. The canonical text stays here. The application does not keep a second deploy script.

**Documented candidates** are requirements with no validated central implementation yet. They are a roadmap. A catalogue entry is not a promise to build that pattern, and it is not something an application can install.

The inventory is [`REUSABLE_PATTERNS_CATALOGUE.md`](../REUSABLE_PATTERNS_CATALOGUE.md).

## What this repository is not

It is not a website, a landing page, or an application template. It is not a host, and it does not choose a provider. It does not hold one product's business rules. It does not replace Next.js, GitHub Actions, Cursor, or another established tool. It does not install or upgrade an application's dependencies.

## What belongs in App-Template

App-Template is the bootable starter. It owns project setup, the landing page, this starter's configuration values, per-application secrets, and the deploy caller. Until `deploy-static-v1` exists, that caller is the working workflow in the template. It installs the published framework packages the starter uses. It does not redefine those packages.

## What belongs in an application

Behaviour that is specific to one product: its screens, its data, its business rules, and its choice of which optional patterns to adopt. The application pins package versions, commits a standards sync, and chooses the deployment workflow tag.

## How an application adopts an update

- A package update is a version change in that application's manifest and lockfile. `framework-check` reports newer published framework packages and does not edit those files.
- A convention update arrives when the application reruns the sync script at a new `standards/cursor` version and commits the result. Existing source stays as it is until someone edits it.
- A static deployment update arrives when the caller moves to a new workflow tag. The application does not copy the workflow. App-Template keeps its current deploy workflow until the tag `deploy-static-v1` exists.
- A documented candidate has nothing to adopt until it becomes a package or a standard.
