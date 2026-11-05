# @app-framework/dev-tools

`framework` adopts App-Framework in an existing application, reports integration status, lists implemented capabilities, adds a compatible module, and applies selected compatible updates.

```bash
framework doctor --cwd <application>
framework adopt --cwd <application> --dry-run
framework adopt --cwd <application>
framework modules --cwd <application>
framework add <module> --cwd <application>
framework upgrade --cwd <application>
framework deploy enable --cwd <application> --dry-run
framework deploy enable --cwd <application>
```

`framework-setup` applies the current `framework.config.json`. `framework-check` compares installed `@app-framework/*` packages with the latest stable versions on the npm registry. Both remain aliases.

`framework doctor` does not treat an unpublished package or an application-owned deploy workflow as successfully integrated. It reports which deploy profiles the application can use. `framework adopt`, `framework add`, and `framework upgrade` edit `package.json` and the lockfile only when the manifest marks that package `available`. They do not apply a major update. Setup does not edit dependency files. Adopt does not write a deploy caller.

Applications install the published package. They do not clone this repository or use `npm link`:

```bash
npm exec --yes --package=@app-framework/dev-tools -- framework adopt
```

The npm scope is not confirmed, so that command cannot succeed yet. The package is private and has no registry release. Framework contributors can run the built CLI from a checkout after `pnpm build`:

```bash
node packages/dev-tools/dist/bin/framework.js adopt --cwd <application>
```

The repository's [`docs/consumer-contract.md`](../../docs/consumer-contract.md) is the application-facing contract.

`framework-check` options: `--cwd`, `--timeout`, `--cache-path`, `--cache-ttl`, `--registry`, and `--no-cache`. Results are cached for 12 hours under `node_modules/.cache/framework-check.json`.
