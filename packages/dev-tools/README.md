# @app-framework/dev-tools

`framework-check` compares installed `@app-framework/*` packages with the latest stable versions on the npm registry. `framework-setup` reads an application's `framework.config.json`, validates it against the capability manifest, copies shared Cursor rules, and writes the static deployment caller.

Warnings and an unavailable registry exit 0. Neither command edits `package.json` or the lockfile.

The npm scope is not confirmed. The package is private and has no registry release. The repository's [`docs/consumer-contract.md`](../../docs/consumer-contract.md) is the application-facing contract.

`framework-check` options: `--cwd`, `--timeout`, `--cache-path`, `--cache-ttl`, `--registry`, and `--no-cache`. Results are cached for 12 hours under `node_modules/.cache/framework-check.json`.

`framework-setup` options: `--cwd <application>`, `--dry-run`, `--check`, and `--list`.
