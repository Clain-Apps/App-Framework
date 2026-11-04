# App-Framework

The shared source for application packages, Cursor standards, and the application deployment workflow used across [Clain-Apps](https://github.com/Clain-Apps). An improvement is made here once. Each application adopts it by a version, a standards pin, or a workflow reference.

[App-Template](https://github.com/Clain-Apps/App-Template) assembles a bootable application: the landing page, product configuration, and a thin caller for the shared workflow. This repository does not depend on App-Template.

The npm packages are private. [`framework.scope.json`](framework.scope.json) has `scopeConfirmed: false`, so the release workflow does not publish, and an application cannot install the packages from the registry yet.

## Develop

Node.js 24 is the supported LTS line (`.nvmrc`). The packages also run on Node.js 22 or newer. pnpm is pinned with `packageManager` to 12.15.0.

```bash
pnpm install
pnpm check
```

`pnpm check` typechecks, lints, runs unit tests, builds, and checks the published files. `pnpm changeset` records a change against only the packages that changed.

## Deploy

Every application calls the same workflow:

```yaml
uses: Clain-Apps/App-Framework/.github/workflows/deploy.yml@deploy-v1
```

A change on `main` applies on the next deployment for callers that follow `main`. Production callers pin `deploy-v1`. The workflow stays in this repository. The caller passes organisation variables `VPS_HOST`, `VPS_USER`, and `DEPLOY_ROOT` (`/apps`), and organisation secrets `VPS_SSH_KEY` and `VPS_KNOWN_HOSTS`. The published directory is `/apps/<app-name>/`. `app-name` may be set independently of the GitHub repository. Profiles are static, Node.js server, and Next.js standalone. The caller, the checks, and rollback are in [`docs/consumer-contract.md`](docs/consumer-contract.md).

## Read next

- [`docs/PROJECT-DEFINITION.md`](docs/PROJECT-DEFINITION.md) — what this repository is, what it leaves to App-Template and to applications, and how updates reach an application.
- [`docs/consumer-contract.md`](docs/consumer-contract.md) — `framework.config.json`, `framework adopt`, and the deployment caller App-Template should use.
- [`docs/architecture.md`](docs/architecture.md) — package boundaries, release rules, and the first-publication checklist.
- [`REUSABLE_PATTERNS_CATALOGUE.md`](REUSABLE_PATTERNS_CATALOGUE.md) — the inventory of recurring patterns. A row is not an implemented capability.
- [`capabilities/manifest.json`](capabilities/manifest.json) — the machine-readable contract for implemented capabilities.
- [`AGENTS.md`](AGENTS.md) — how to decide whether a request belongs in this repository.
