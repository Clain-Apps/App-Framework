# App-Framework

Shared capabilities, package contracts, and architectural standards for applications that should not reimplement the same foundations.

This repository publishes independently versioned packages. [App-Template](https://github.com/daniel-clain/App-Template) is the consumer that assembles a bootable application. Application repositories depend on the published packages, not on this git history. This repository does not depend on App-Template.

The npm scope is a placeholder until its ownership is confirmed:

```json
{
  "npmScope": "@app-framework",
  "scopeConfirmed": false
}
```

See [`framework.scope.json`](framework.scope.json). While `scopeConfirmed` is false the packages stay private and the release workflow does not publish.

## Packages

- [`@app-framework/ui`](packages/ui) — frontend elements and tag-name styles. App-Template installs this package.
- [`@app-framework/app-config`](packages/config) — typed environment configuration with separate server and public values.
- [`@app-framework/dev-tools`](packages/dev-tools) — `framework-check`, a non-blocking comparison of installed framework packages against the npm registry.

How App-Template should install and call them is written in [`docs/consumer-contract.md`](docs/consumer-contract.md).

## Develop

Node.js 24 is the supported LTS line (`.nvmrc`). The packages also run on Node.js 22 or newer. pnpm is pinned with `packageManager` to 12.15.0.

```bash
pnpm install
pnpm check
```

`pnpm check` typechecks, lints, runs unit tests, builds, and checks the published files. `pnpm changeset` records a change against only the packages that changed.

## Releases

Changesets versions packages independently. `fixed` and `linked` are empty, so one package does not drag the other along. A package that depends on a changed package receives a patch bump.

On every push to `main`:

1. The release workflow opens or updates a version pull request when changesets are present.
2. Merging that pull request runs the publish step.
3. Publish exits without contacting npm while `scopeConfirmed` is false.

The workflow requests `id-token: write` and does not use `NPM_TOKEN` or `NODE_AUTH_TOKEN`. After trusted publishing is configured, npm provenance is attached automatically. Consumers are not upgraded automatically. `framework-check` only reports newer versions.

## First publication

Do this once, by hand, after the scope is real. Do not publish the placeholder scope.

1. Confirm that the npm scope is owned and available. If the name is not `@app-framework`, change `framework.scope.json` and both package names together, and update the docs that mention the scope.
2. Set `scopeConfirmed` to `true`.
3. Set `"private": false` on both packages.
4. Set Changesets `access` to `"public"`.
5. From a logged-in machine, build and publish each package once (`pnpm build`, then `pnpm exec npm publish --access public` in each package directory). Trusted publishing cannot create the first version of a package.
6. On npm, for each package, add a GitHub Actions trusted publisher: user `daniel-clain`, repository `App-Framework`, workflow filename `release.yml`. Allow `npm publish`. A new trusted-publisher configuration must complete a successful publish within npm's current window (2 days at the time of writing).
7. Later version pulls publish through `.github/workflows/release.yml`. Only changed packages, and packages that depend on them, are released. Each published package gets its own tag.

Choose a license before the first public publish. The private packages are marked `UNLICENSED`.

## Further reading

- [`docs/RESPONSIBILITIES.md`](docs/RESPONSIBILITIES.md) — what belongs in this repository, in App-Template, and in an application.
- [`docs/architecture.md`](docs/architecture.md) — boundaries, dependency rules, and releases.
- [`docs/capability-catalogue.md`](docs/capability-catalogue.md) — the 121 recurring requirements. Only dependency updates is implemented.
- [`AGENTS.md`](AGENTS.md) — how to decide whether a request belongs in this repository.
