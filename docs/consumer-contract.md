# Consumer contract

App-Template, and later each application, installs the published packages. They do not depend on this git repository, and they do not copy these modules into the application.

The packages are private until the npm scope in [`framework.scope.json`](../framework.scope.json) is confirmed and the first versions are published. Do not point an application at a `git` or `file` dependency as a substitute. Wait for the registry versions, then pin them with a normal semver range so upgrades stay deliberate.

## Install

```bash
pnpm add @app-framework/ui
pnpm add @app-framework/app-config
pnpm add -D @app-framework/dev-tools
```

`@app-framework/ui` is a runtime dependency of App-Template. Config and dev-tools are separate packages. Installing the UI package does not install them.

Use the scope from `framework.scope.json` if it changes before the first publish.

## Development script

`framework-check` is safe to run at the start of local development. It prints nothing when framework packages are current. Warnings and an unavailable registry exit 0. The command never edits `package.json` or the lockfile.

```json
{
  "scripts": {
    "framework:check": "framework-check",
    "dev": "framework-check && next dev"
  },
  "dependencies": {
    "@app-framework/ui": "^0.1.0",
    "@app-framework/app-config": "^0.1.0"
  },
  "devDependencies": {
    "@app-framework/dev-tools": "^0.1.0"
  },
  "appFramework": {
    "required": ["@app-framework/ui", "@app-framework/app-config", "@app-framework/dev-tools"]
  }
}
```

`appFramework.required` lists framework packages the starter considers mandatory. The checker reports a required package that is absent. It ignores unrelated dependencies such as React.

Optional flags: `--cwd`, `--timeout`, `--cache-path`, `--cache-ttl`, `--registry`, and `--no-cache`. Results are cached for 12 hours under `node_modules/.cache/framework-check.json`.

## Interface

Load the stylesheet and register the elements once. Style and markup use the tag names. Do not restyle them with utility classes.

```ts
import { defineAppElements } from "@app-framework/ui";
import "@app-framework/ui/styles.css";

defineAppElements();
```

```html
<af-theme name="light">
  <af-heading level="1">Title</af-heading>
  <af-panel>Content</af-panel>
</af-theme>
```

`af-theme` accepts `light` or `dark`. `af-heading` uses `level` from 1 to 6. The package does not include routing, tabs, accordions, graphs, calendars, modals, or menus.

## Configuration

```ts
import { defineConfig, loadConfig, loadPublicConfig } from "@app-framework/app-config";

const definition = defineConfig({
  server: {
    DATABASE_URL: { kind: "url" },
  },
  public: {
    APP_NAME: { kind: "string" },
    APP_URL: { kind: "url" },
  },
});

const config = loadConfig(definition, process.env);
const publicConfig = loadPublicConfig(definition, process.env);
```

`loadConfig` returns `{ server, public }` or throws `ConfigError` with every problem. Server error text does not include the rejected value. `loadPublicConfig` reads only public keys. In browser code, call `loadPublicConfig`. `loadConfig` with `{ runtime: "browser" }` throws before it reads server values.

Supported field kinds are `string`, `number`, `boolean`, `url`, and `enum`. A field is required unless it sets `default` or `required: false`. Empty strings are missing. A key cannot appear in both sections.

## What App-Template must not do

- Redefine `@app-framework/ui`, `@app-framework/app-config`, or `@app-framework/dev-tools`, or maintain a second copy of their behaviour.
- Import anything other than the package root, plus `@app-framework/ui/styles.css` for the interface.
- Treat the capability catalogue as a menu of packages to generate. The catalogue is maintained here. App-Template may link to it and document the subset the starter uses.
- Move a one-application feature into this repository. Extract it only when it is a general capability with a stable interface.
- Expect a publish from this repository to change an application's installed versions.

## Release awareness

After a version pull request is merged and the packages are published, `framework-check` reports a same-major upgrade as `compatible update` and a higher major as `major update`. Installing the new version remains a change in the consumer repository.
