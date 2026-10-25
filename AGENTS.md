# App-Framework

This repository is the central source of recurring application patterns. It does not own any one application.

Three kinds of pattern live here. Reusable packages are versioned npm dependencies. Centrally managed standards and workflows are maintained outside npm, including Cursor conventions and reusable GitHub Actions workflows. Documented candidates are requirements with no validated central implementation yet. A catalogue entry is not a promise to build it.

App-Template selects and assembles the starter: the landing page, development configuration, per-application secrets, and the thin caller for shared workflows. Applications implement their own behaviour.

Nothing in this repository may depend on App-Template or on a generated application. Do not add a Next.js landing page or a starter app here.

## Packages

- `@app-framework/ui` — frontend custom elements (`af-theme`, `af-heading`, `af-panel`) and tag-name styles. No runtime dependencies. App-Template installs this package when the registry version exists.
- `@app-framework/app-config` — typed environment configuration, validation, and the split between server-only and browser-safe values. No runtime dependencies.
- `@app-framework/dev-tools` — `framework-check` compares installed framework packages with the latest stable npm versions. It warns, including when the registry is down, and it never edits dependency files.

Public imports use the package root. The UI package also exports `@app-framework/ui/styles.css`. The packages do not depend on each other. Names must match [`framework.scope.json`](framework.scope.json). They stay private, and publish is skipped, until `scopeConfirmed` is true.

Read [`docs/Responsibilities.md`](docs/Responsibilities.md) before adding a module. Read [`docs/architecture.md`](docs/architecture.md) for dependency and release rules. Read [`REUSABLE_PATTERNS_CATALOGUE.md`](REUSABLE_PATTERNS_CATALOGUE.md) before treating a documented pattern as an implemented capability. Do not copy that catalogue into this file. Read [`docs/consumer-contract.md`](docs/consumer-contract.md) before telling App-Template how to install a package, sync conventions, or call the deployment workflow.

## Decision test

When a new capability is requested, choose one outcome and record it briefly in the pull request. Update the architecture doc or the catalogue when the choice changes what this repository owns.

- **Reusable package** — a real implementation with a small public contract that more than one app needs.
- **Standard or workflow** — a rule, convention, or reusable GitHub Actions workflow maintained here and consumed by reference. Do not invent an npm package for it.
- **Documented candidate** — a recurring requirement with no validated central implementation yet. Record it in the catalogue. Do not build it speculatively.
- **Template concern** — bootstrap, the landing page, per-application secrets, or the thin caller for a shared workflow. That belongs in App-Template.
- **Application code** — behaviour that is unique to one product. Leave it in that application.

Add a package only for the first outcome. Prefer a non-breaking change. A breaking change needs a major release and a migration note. Publishing a version, syncing a standards version, or moving a workflow tag must not update existing applications by itself.

Do not create an empty package, a dumping-ground `core` package, a custom installer, or a catalogue feature ahead of a recurring need.
