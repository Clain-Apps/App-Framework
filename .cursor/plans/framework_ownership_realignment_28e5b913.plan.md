---
name: Framework ownership realignment
overview: "Realign App-Framework around the three ownership kinds already sketched in the patterns catalogue: keep the three packages, make that catalogue the only inventory, and add a verified Cursor plugin plus a reusable static deploy workflow. No new packages or management platform."
todos:
  - id: ownership-docs
    content: Rewrite responsibilities and align AGENTS.md, architecture, and README to the three ownership kinds.
    status: completed
  - id: catalogue
    content: Make REUSABLE_PATTERNS_CATALOGUE.md the only catalogue, preserve the 121 names as an index, and retarget the catalogue test and App-Template links.
    status: completed
  - id: conventions-plugin
    content: Add the conventions Cursor plugin, keep ui-elements local, document adoption, and verify local plugin loading.
    status: completed
  - id: static-workflow
    content: Add the reusable static deploy workflow and contract, then replace App-Template's deploy.yml with the thin caller.
    status: completed
  - id: ui-next
    content: Make the UI package import-safe without a DOM, test it, and document the Next.js client initialization.
    status: completed
  - id: publish-gate
    content: Record the verified npm 404 result and keep publishing blocked until scope ownership is confirmed.
    status: completed
isProject: false
---

# Framework ownership realignment

## Already in place

- Three private packages, independent Changesets, and `framework-check`: [`packages/ui`](packages/ui), [`packages/config`](packages/config), [`packages/dev-tools`](packages/dev-tools). None depend on each other. Publish is skipped while [`framework.scope.json`](framework.scope.json) has `scopeConfirmed: false` ([`scripts/publish.mjs`](scripts/publish.mjs)).
- Framework CI and the Changesets release workflow in [`.github/workflows`](.github/workflows). These stay as this repository's own checks. They are not the application deployment workflow.
- Static deploy behaviour lives in [App-Template `.github/workflows/deploy.yml`](f:/Repos/App-Template/.github/workflows/deploy.yml): non-root SSH, `out/index.html` checks, release directories under `/root/apps/<repo>/releases/<sha-run-attempt>`, `current`/`previous` symlinks, and a rollback dispatch. App-Template does not deploy itself.
- [`REUSABLE_PATTERNS_CATALOGUE.md`](REUSABLE_PATTERNS_CATALOGUE.md) already defines the three ownership kinds. [`docs/capability-catalogue.md`](docs/capability-catalogue.md) is a second inventory of 121 groups, and [`tests/catalogue.test.ts`](tests/catalogue.test.ts) locks that file. App-Template also has its own copy of the patterns catalogue.
- [`docs/Responsibilities.md`](docs/Responsibilities.md) is the only responsibility file. Docs link to `docs/RESPONSIBILITIES.md`; on Windows that is the same file. It still says this repository is not a deployment system and that only dependency updates are implemented.
- Anonymous npm lookups on 25 Oct 2026 returned 404 for `@app-framework/ui`, `@app-framework/app-config`, and `@app-framework/dev-tools`. A 404 does not prove the scope is free or owned. The packages stay private.

## Ownership model

Update [`docs/RESPONSIBILITIES.md`](docs/RESPONSIBILITIES.md) into a short explanation of three kinds of recurring work:

- **Reusable packages** — the three existing npm packages.
- **Centrally managed standards and workflows** — Cursor conventions and the reusable static deploy workflow. Not npm packages.
- **Documented candidates** — catalogue entries with no central implementation. A row is not a promise to build it.

App-Template still assembles the starter: landing page, per-app configuration, secrets, and a thin workflow caller. Applications still own product behaviour and pin their own versions. This repository still must not depend on App-Template.

Align [`AGENTS.md`](AGENTS.md), [`docs/architecture.md`](docs/architecture.md), and [`README.md`](README.md) with that split. Remove the decision-test line that sends deployment configuration to App-Template. Keep bootstrap, the landing page, and per-app secrets there. Do not restate the convention text or the catalogue inside `AGENTS.md`.

## One catalogue

Keep [`REUSABLE_PATTERNS_CATALOGUE.md`](REUSABLE_PATTERNS_CATALOGUE.md) at the repository root and make it the only inventory. Delete [`docs/capability-catalogue.md`](docs/capability-catalogue.md).

Reshape each existing pattern so it has: name, short purpose, one ownership category, canonical location, status (`implemented`, `proposed`, or `deferred`), core or optional, priority, how an existing application adopts a change, and dependencies where they matter. State at the top that a documented pattern is not an implemented capability.

Mark implemented only where this repository already has the artifact:

- the three packages (source exists; registry install remains blocked)
- the shared conventions, after the plugin check below succeeds
- the static deploy workflow, once its caller contract is in the repo

Leave server hosting, a Node deploy profile, CI extraction, lint presets, and every future package as proposed or deferred. Do not add those implementations.

Preserve the 121 former requirement names as an index inside the same file, each pointing at one pattern. That index is not a second status system. Update [`tests/catalogue.test.ts`](tests/catalogue.test.ts) to require those names, the new fields, and the absence of the old catalogue.

In App-Template, replace the copied catalogue and the links in [`docs/capability-overview.md`](f:/Repos/App-Template/docs/capability-overview.md) with a pointer to this file.

## Shared development conventions

Cursor's current rules documentation says rules in another GitHub repository are not applied on their own. The supported distribution path is a Cursor plugin from a marketplace manifest. Remote Rule import is not the mechanism: it copies files into the project, and it has a separate, conflicting doc page.

Add one small plugin, not a toolkit:

- [`.cursor-plugin/marketplace.json`](.cursor-plugin/marketplace.json) listing a single plugin
- [`conventions/.cursor-plugin/plugin.json`](conventions/.cursor-plugin/plugin.json) with a `version` field
- short `.mdc` rules for naming, separation of concerns, TypeScript, code organisation, testing, and maintainability

Those rules are generic. They must not say to edit `packages/ui` or describe this repository's architecture. [`/.cursor/rules/ui-elements.mdc`](.cursor/rules/ui-elements.mdc) stays a project rule for this repo only.

Adoption, to document in the consumer contract:

- An existing project installs the plugin once from this repository's marketplace manifest (Customize → From GitHub Repository, or a team marketplace with auto-refresh).
- Later edits are picked up by refreshing that plugin. `framework-check` does not track it. The plugin version is not an npm version.
- Installing it does not rewrite existing source. Project-specific rules stay in that application's `.cursor/rules`.
- Opening a consumer repository does not apply these rules until the plugin is installed.

Verify before marking the pattern implemented: confirm the rule files are outside `.cursor/rules`, then load the plugin through Cursor's local plugin check (`~/.cursor/plugins/local`) and record whether the rules show up in Customize. If that check fails, leave the pattern as proposed and write the observed blocker. Do not add a sync script or installer.

## Reusable static deployment

Add [`.github/workflows/deploy-static.yml`](.github/workflows/deploy-static.yml) with `on: workflow_call` only, so this repository does not deploy itself. Move the current App-Template behaviour into it, including the refusal to deploy `daniel-clain/App-Template`.

Contract:

- Caller input `rollback` (boolean). The shared workflow branches on that input, not on `github.event_name`, because a called workflow does not see the caller's event name reliably.
- Required secrets, passed by name: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`. No `secrets: inherit`.
- Workflow permission `contents: read` only.
- The caller checks out its own app. `pnpm check` must already have produced `out/index.html` (the existing static export). No Node process profile, no new hosting platform.
- Keep the template's action majors (`actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`) so this move does not also upgrade the deploy toolchain. Do not float those actions to a branch.
- Consumer ref is the git tag `deploy-static-v1`, not `@main` and not an npm release. A breaking caller change gets `deploy-static-v2`. Document that in [`docs/consumer-contract.md`](docs/consumer-contract.md).

The thin caller, in App-Template's `deploy.yml`, keeps `push` to `main`, `workflow_dispatch`, and the four secrets:

```yaml
jobs:
  deploy:
    permissions:
      contents: read
    uses: daniel-clain/App-Framework/.github/workflows/deploy-static.yml@deploy-static-v1
    with:
      rollback: ${{ github.event_name == 'workflow_dispatch' && inputs.rollback }}
    secrets:
      VPS_HOST: ${{ secrets.VPS_HOST }}
      VPS_USER: ${{ secrets.VPS_USER }}
      VPS_SSH_KEY: ${{ secrets.VPS_SSH_KEY }}
      VPS_KNOWN_HOSTS: ${{ secrets.VPS_KNOWN_HOSTS }}
```

Also update App-Template's responsibility doc and architecture rule so they no longer claim to own the deploy implementation. Do not change AppHub or other application workflows; their pipelines are not this static profile.

Remaining GitHub constraints to record, not to invent around:

- Another repository can call the workflow only after this file is on the default branch and the tag exists. Do not push or tag unless you ask for that.
- For a private repository, GitHub still needs Actions access set so repositories owned by `daniel-clain` may call it. That setting is outside the workflow file.
- A live VPS deploy is not part of this change. Add a source test that the workflow is `workflow_call`, declares those secrets, and keeps `contents: read`.

## Packages, UI, and publish gate

Leave the three packages, Changesets, and `framework-check` as they are. Do not add a package.

Record the 404 lookup in the README publish section and state the strategy explicitly: `scopeConfirmed` stays false; nobody publishes under `@app-framework` until the npm account owner confirms the scope in npm's UI; a 404 is not that confirmation. The existing first-publish checklist stays the procedure after that confirmation.

The UI classes extend `HTMLElement` at import time. Next.js still evaluates a client component on the server, where `HTMLElement` is absent, so the current package is not safe to import from the App Router. Make the smallest guard: base the elements on `HTMLElement` only when it exists, and make `defineAppElements()` return without registering when `customElements` is absent. Add a Node-environment test that importing the package does not throw. Keep the happy-dom registration tests.

Document this in [`packages/ui/README.md`](packages/ui/README.md) and the consumer contract, without adding a React component or a Next.js dependency:

- Load `@app-framework/ui` and `@app-framework/ui/styles.css` from a client component.
- Call `defineAppElements()` inside `useEffect`.
- Render `<af-theme>`, `<af-heading>`, and `<af-panel>` as tags. Registration upgrades them in the browser; `af-heading` sets its heading role after connection.
- Do not install the package in App-Template while it is unpublished.

## How an existing application adopts a change

- Package: publish a version, then bump that app's range and lockfile. `framework-check` reports the difference and does not edit files. This path stays blocked until a confirmed scope is published.
- Rules: refresh the installed conventions plugin. Old code stays until someone edits it.
- Static deploy: change the caller's `@deploy-static-v1` ref when a new workflow tag is cut. The app does not keep a copy of the release or rollback script.
- Candidates: no adoption path until a pattern becomes a package or a standard.