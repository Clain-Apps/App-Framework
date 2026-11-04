# App-Framework

This repository is the source of reusable solutions for Clain-Apps applications: packages, Cursor standards, the application deployment workflow, and the capability contract. It does not own any one application.

Read [`docs/PROJECT-DEFINITION.md`](docs/PROJECT-DEFINITION.md) before changing what this repository is. Read [`docs/Responsibilities.md`](docs/Responsibilities.md) before adding a module. Read [`docs/architecture.md`](docs/architecture.md) for dependency and release rules. Read [`REUSABLE_PATTERNS_CATALOGUE.md`](REUSABLE_PATTERNS_CATALOGUE.md) before treating a documented pattern as an implemented capability. Read [`capabilities/manifest.json`](capabilities/manifest.json) for the machine-readable contract of implemented capabilities. Read [`docs/consumer-contract.md`](docs/consumer-contract.md) before telling App-Template how to set up, install, or deploy.

Nothing here may depend on App-Template or on a generated application. Do not add a Next.js landing page or a starter app here.

The packages `@app-framework/ui`, `@app-framework/app-config`, and `@app-framework/dev-tools` stay private until `scopeConfirmed` is true in [`framework.scope.json`](framework.scope.json). Public imports use the package root. The UI package also exports `@app-framework/ui/styles.css`. The packages do not depend on each other.

## Decision test

When a new capability is requested, choose one outcome and record it briefly in the pull request. Update the architecture doc, the catalogue, or the manifest when the choice changes what this repository owns.

- **Reusable package** — a real implementation with a small public contract that more than one app needs. Add it to the manifest only when the code exists.
- **Standard or workflow** — a rule, convention, or reusable GitHub Actions workflow maintained here and consumed by reference. Do not invent an npm package for it.
- **Documented candidate** — a recurring requirement with no validated central implementation yet. Record it in the catalogue. Do not build it speculatively, and do not add it to the manifest.
- **Template concern** — bootstrap, the landing page, product secrets, or the thin caller for a shared workflow. That belongs in App-Template. The shared deploy connection is a Clain-Apps organisation setting.
- **Application code** — behaviour that is unique to one product. Leave it in that application.

Add a package only for the first outcome. Prefer a non-breaking change. A breaking change needs a major release and a migration note. Publishing a version, syncing a standards version, or moving a workflow ref must not update existing applications by itself.

Do not create an empty package, a dumping-ground `core` package, a module marketplace, or a catalogue feature ahead of a recurring need. The consumer entry for capabilities that already exist is the `framework` CLI, documented in the consumer contract.
