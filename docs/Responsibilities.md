# Responsibilities

## What App Framework is

App Framework is a shared library of reusable packages. Applications install the packages they need, at the versions they choose. Each package has a public interface and its own version.

The packages that exist today are:

- `@app-framework/app-config` — typed environment values, with server-only values kept apart from browser-safe values.
- `@app-framework/dev-tools` — `framework-check`, which reports newer published framework packages. It does not install or upgrade them.
- `@app-framework/ui` — the frontend module. It registers `af-*` custom elements and styles them by tag name.

`@app-framework/ui` is a core install for App-Template. Config and the version check are available on their own. None of these packages imports the others.

## What it is not

This repository is not a website, an application, or an application template. It is not a host or a deployment system. It does not hold one product's business rules. It does not replace an existing framework, library, or service. It does not install, select, or upgrade modules for an application.

## What belongs here

Shared behaviour that more than one application would otherwise copy, with a small public interface.

That includes the packages above. It also includes the architectural standards and the capability catalogue.

A future `@app-framework/database` package may wrap an established database client and the connection setup applications would otherwise copy. It will not be an ORM or a database engine. It will not be added until two applications would otherwise copy that setup.

Further `af-*` elements belong in `@app-framework/ui` when an application needs them: tab bars, accordions, graphs, calendars, modals, mobile menus, routing and navigation, and animation. Element state stays on attributes, properties, and events. A shared state container is not added before a screen needs one.

## What belongs in App-Template

App-Template is the bootable starter. It owns project setup, the landing page, hosting, and deployment configuration. It installs the framework packages the starter uses, including `@app-framework/ui`, and wires them into the running app. It does not redefine those packages.

## What belongs in an application

Behaviour that is specific to one product: its screens, its data, its business rules, and its choice of which optional framework packages to install. An application pins package versions itself. Publishing a new framework version does not change installed applications.

## How applications depend on packages

Install only the packages the application uses:

```bash
pnpm add @app-framework/ui
pnpm add @app-framework/app-config
pnpm add -D @app-framework/dev-tools
```

Import the public entry. For the interface, also load `@app-framework/ui/styles.css` and call `defineAppElements()`. Do not import another framework package through these entries, and do not depend on this git repository.

## Not implemented yet

These stay documented until an application requires them:

- Visitor identity, user accounts, and permissions
- Payments and invoicing
- Realtime communication and notifications
- Background jobs and file storage
- External integrations and offline synchronisation
- Analytics and developer diagnostics
- Database access
- Tab bars, accordions, graphs, calendars, modals, mobile menus, routing, and animation
