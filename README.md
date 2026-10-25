# App-Framework

The central source of recurring application patterns, so an improvement can be made once and adopted by existing and future applications.

Three kinds of pattern live here. Reusable packages are versioned npm dependencies. Cursor conventions are a versioned copy produced by `scripts/sync-cursor-standards.mjs`. The reusable static deployment workflow is called by a pinned GitHub Actions tag. Documented candidates in [`REUSABLE_PATTERNS_CATALOGUE.md`](REUSABLE_PATTERNS_CATALOGUE.md) are a roadmap: a written pattern is not an implemented capability.

[App-Template](https://github.com/daniel-clain/App-Template) assembles a bootable application. It keeps the landing page, per-application secrets, and its current deploy workflow until the tag `deploy-static-v1` exists. Application repositories depend on published packages and pinned references, not on this git history. This repository does not depend on App-Template.

The npm scope is a placeholder until its ownership is confirmed:

```json
{
  "npmScope": "@app-framework",
  "scopeConfirmed": false
}
```

See [`framework.scope.json`](framework.scope.json). While `scopeConfirmed` is false the packages stay private and the release workflow does not publish.

## Packages

- [`@app-framework/app-config`](packages/config) — typed environment configuration with separate server and public values. This is one of the two MVP packages.
- [`@app-framework/dev-tools`](packages/dev-tools) — `framework-check`, a non-blocking comparison of installed framework packages against the npm registry. This is the other MVP package.
- [`@app-framework/ui`](packages/ui) — frontend elements and tag-name styles. It is not an MVP install. App-Template does not add it until a registry release exists.

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

The scope name `@app-framework` matches the two MVP packages, `@app-framework/app-config` and `@app-framework/dev-tools`. `@app-framework/ui` uses the same scope and is not part of that MVP install. Setting `scopeConfirmed` to `true` does not create those packages or prove the scope is owned. `scripts/publish.mjs` skips the registry while the flag is false. If the flag were true, that script would refuse to publish while any of the three packages is still private, so confirming the scope would also require a decision about UI before any publish.

An anonymous lookup on 26 October 2026 received HTTP 404 for `@app-framework/ui`, `@app-framework/app-config`, and `@app-framework/dev-tools`. A 404 means those names were not visible. It does not show that this account owns `@app-framework`, and it does not show that the scope is free. `scopeConfirmed` stays `false`. The packages stay private. Publish stays skipped. Nobody publishes under `@app-framework` until the npm account owner confirms the scope in npm's UI.

1. Confirm that the npm scope is owned and available. If the name is not `@app-framework`, change `framework.scope.json` and the package names together, and update the docs that mention the scope.
2. Set `scopeConfirmed` to `true`.
3. Set `"private": false` on each package.
4. Set Changesets `access` to `"public"`.
5. From a logged-in machine, build and publish each package once (`pnpm build`, then `pnpm exec npm publish --access public` in each package directory). Trusted publishing cannot create the first version of a package.
6. On npm, for each package, add a GitHub Actions trusted publisher: user `daniel-clain`, repository `App-Framework`, workflow filename `release.yml`. Allow `npm publish`. A new trusted-publisher configuration must complete a successful publish within npm's current window (2 days at the time of writing).
7. Later version pulls publish through `.github/workflows/release.yml`. Only changed packages, and packages that depend on them, are released. Each published package gets its own tag.

Choose a license before the first public publish. The private packages are marked `UNLICENSED`.

## Further reading

- [`docs/Responsibilities.md`](docs/Responsibilities.md) — what belongs in this repository, in App-Template, and in an application.
- [`docs/architecture.md`](docs/architecture.md) — boundaries, dependency rules, and releases.
- [`REUSABLE_PATTERNS_CATALOGUE.md`](REUSABLE_PATTERNS_CATALOGUE.md) — the only catalogue of recurring patterns. A row is not a promise that the pattern is implemented.
- [`docs/consumer-contract.md`](docs/consumer-contract.md) — how an application installs a package, syncs conventions, and calls the static deployment workflow.
- [`AGENTS.md`](AGENTS.md) — how to decide whether a request belongs in this repository.
