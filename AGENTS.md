# App-Framework

This repository owns reusable capabilities for many independent applications. It does not own any one application.

App-Framework defines and implements shared capabilities, package APIs, compatibility, and release versions. It publishes independently versioned packages. App-Template selects and assembles the mandatory capabilities and provides the bootable starter, including development and deployment configuration. Applications implement their own behaviour.

Nothing in this repository may depend on App-Template or on a generated application. Do not add a Next.js landing page or a starter app here.

## Packages

- `@app-framework/ui` — frontend custom elements (`af-theme`, `af-heading`, `af-panel`) and tag-name styles. No runtime dependencies. App-Template installs this package.
- `@app-framework/app-config` — typed environment configuration, validation, and the split between server-only and browser-safe values. No runtime dependencies.
- `@app-framework/dev-tools` — `framework-check` compares installed framework packages with the latest stable npm versions. It warns, including when the registry is down, and it never edits dependency files.

Public imports use the package root. The UI package also exports `@app-framework/ui/styles.css`. The packages do not depend on each other. Names must match [`framework.scope.json`](framework.scope.json). They stay private, and publish is skipped, until `scopeConfirmed` is true.

Read [`docs/RESPONSIBILITIES.md`](docs/RESPONSIBILITIES.md) before adding a module. Read [`docs/architecture.md`](docs/architecture.md) for dependency and release rules. Read [`docs/capability-catalogue.md`](docs/capability-catalogue.md) for the 121 recurring requirements. Do not copy that catalogue into this file. Read [`docs/consumer-contract.md`](docs/consumer-contract.md) before telling App-Template how to install or invoke a package.

## Decision test

When a new capability is requested, choose one outcome and record it briefly in the pull request. Update the architecture doc or the catalogue when the choice changes what this repository owns.

- **Reusable package** — a real implementation with a small public contract that more than one app needs.
- **Standard or policy** — a rule or a project decision. Document it. Do not invent a package for it.
- **Adapter or integration** — a binding to one external system. Add it only when a consumer needs that system.
- **Template concern** — bootstrap, landing page, hosting, or deployment configuration. That belongs in App-Template.
- **Application code** — behaviour that is unique to one product. Leave it in that application.

Add a package only for the first outcome. Prefer a non-breaking change. A breaking change needs a major release and a migration note. Publishing a version must not update existing applications by itself.

Do not create an empty package, a dumping-ground `core` package, or a catalogue feature ahead of a recurring need.
