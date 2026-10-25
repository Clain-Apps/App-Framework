# Reusable patterns catalogue

This is the only catalogue of recurring application patterns. App-Template and individual applications link here. They do not keep a copy.

A documented pattern is not an implemented capability. Status describes the central artifact in this repository:

- **implemented** — the canonical file or package is in this repository.
- **proposed** — a central home is identified, and the artifact is not ready to adopt.
- **deferred** — kept on the roadmap. This is not a commitment to build it.

Category is where that artifact would live:

- **package** — a versioned npm package.
- **standard** — a workflow, convention, or policy maintained here and consumed by reference. Not an npm package.
- **candidate** — no validated central implementation yet.

Use is **core** when every application should consider it, and **optional** when only some products need it. Priority is **now**, **next**, or **later**. Publishing a package, syncing a standards version, or moving a workflow tag does not change an existing application by itself.

## Packages

### UI primitives and design tokens

- Purpose: Tag-styled `af-theme`, `af-heading`, and `af-panel`, plus spacing, measure, type, and colour custom properties. Product branding stays in the application. Tabs, accordions, graphs, calendars, modals, menus, routing, and animation are not in this package.
- Category: package
- Location: `packages/ui` (`@app-framework/ui` and `@app-framework/ui/styles.css`)
- Status: implemented
- Use: core
- Priority: now
- Adoption: After a confirmed scope is published, bump the version and lockfile, then test. Until then there is no registry release to adopt. Upgrading does not rewrite existing screens.
- Dependencies: none

### Application configuration

- Purpose: Typed environment values, with server-only values kept out of browser-safe output. Empty strings are missing. This is not a secrets manager and it does not define an application's API.
- Category: package
- Location: `packages/config` (`@app-framework/app-config`)
- Status: implemented
- Use: core
- Priority: now
- Adoption: After publication, bump the version and lockfile. Call `loadPublicConfig` from browser code.
- Dependencies: none

### Framework update checker

- Purpose: Compare installed framework packages with the latest stable npm versions, including a required package that is absent. Compatible and major updates are reported separately. The command never edits dependency files, and it does not track conventions or workflows.
- Category: package
- Location: `packages/dev-tools` (`@app-framework/dev-tools`, command `framework-check`)
- Status: implemented
- Use: core
- Priority: now
- Adoption: After publication, bump the dev dependency. Run the command to see the report. Installing the new version remains a commit in the application.
- Dependencies: `semver`

### Lint and TypeScript presets

- Purpose: Share lint, TypeScript, and formatting configuration when the same preset is being copied. A template file is enough until that copy exists.
- Category: package
- Location: no package yet
- Status: proposed
- Use: core
- Priority: next
- Adoption: None until a package is published. Do not hide an application's compiler constraints inside a preset.
- Dependencies: none

### Database integration

- Purpose: Connection lifecycle, validation, migrations, and diagnostics around an established database client. Schema and data stay in the application. This will not be an ORM or a database engine, and unlike databases do not share one package.
- Category: package
- Location: no package yet
- Status: proposed
- Use: optional
- Priority: next
- Adoption: None until a package exists. Add it only when two applications would otherwise copy the same client setup.
- Dependencies: an established database client chosen by the application

### Identity and access

- Purpose: Provider-backed sign-in, sessions, and authorization helpers. Account profiles and roles are configuration. Do not hand-roll credentials or cryptography.
- Category: package
- Location: no package yet
- Status: proposed
- Use: optional
- Priority: next
- Adoption: None until a package exists.
- Dependencies: an identity provider

### Billing

- Purpose: Invoices, payment links, receipts, payment status, refunds, and reconciliation as one selectable capability. The provider collects card data.
- Category: package
- Location: no package yet
- Status: proposed
- Use: optional
- Priority: next
- Adoption: None until a package exists.
- Dependencies: a payment provider

### AI integration

- Purpose: Provider clients, structured outputs, tool calls, streaming, usage limits, and prompt hooks. Reasoning that is specific to one product stays in that application.
- Category: package
- Location: no package yet
- Status: proposed
- Use: optional
- Priority: next
- Adoption: None until a package exists.
- Dependencies: an AI provider

### Realtime transport

- Purpose: Typed messages, connection lifecycle, reconnect, subscriptions, and server events. Game rules stay in the application.
- Category: package
- Location: no package yet
- Status: proposed
- Use: optional
- Priority: next
- Adoption: None until a package exists. Extract it from a working application rather than designing it in isolation.
- Dependencies: none

### Background jobs

- Purpose: Schedules, queues, retries, idempotency, and job visibility, using an established scheduler or queue.
- Category: package
- Location: no package yet
- Status: proposed
- Use: optional
- Priority: next
- Adoption: None until a package exists.
- Dependencies: an established scheduler or queue

### Web data acquisition

- Purpose: Fetch policy, per-source adapters, timestamps, provenance, deduplication, and errors. Analysis stays in the application. Collection has to be lawful for the source.
- Category: package
- Location: no package yet
- Status: proposed
- Use: optional
- Priority: next
- Adoption: None until a package exists.
- Dependencies: none

### File and media storage

- Purpose: Upload validation, storage adapters, retrieval, and cleanup. Public upload is not the default.
- Category: package
- Location: no package yet
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None. Build it only after a second consumer needs the same upload path.
- Dependencies: a storage provider

### Notifications and messaging

- Purpose: Delivery adapters, templates, queueing, and delivery status for email, push, SMS, or in-app messages.
- Category: package
- Location: no package yet
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None until a package exists.
- Dependencies: a delivery provider

### Client offline sync

- Purpose: A local store, queued mutations, sync cursors, and conflict handling for products that must edit while offline.
- Category: package
- Location: no package yet
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None until a product requires offline editing.
- Dependencies: none

### Analytics instrumentation

- Purpose: Consent-aware event hooks and provider adapters. Each application chooses the events that matter. Observation is not inference.
- Category: package
- Location: no package yet
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None until a package exists.
- Dependencies: an analytics provider, when one is chosen

### Game host

- Purpose: Lobbies, participants, presence, and session lifecycle for more than one game. Combat and game rules stay in the game.
- Category: package
- Location: no package yet
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None. Do not copy an unreviewed game into a package.
- Dependencies: none until a real extraction needs transport or identity

### Synchronised start

- Purpose: Estimate clock offset from delay and jitter, then share an absolute server time for a coordinated start. This does not promise exact simultaneity.
- Category: package
- Location: no package yet
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None until a second multiplayer product needs it.
- Dependencies: none

### Audio and speech

- Purpose: Capture, streaming, a transcription adapter, and optional speaker segmentation. Product-specific analysis stays in the application.
- Category: package
- Location: no package yet
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None until a second consumer needs the same audio path.
- Dependencies: a transcription provider

## Standards and workflows

### Development conventions

- Purpose: Shared guidance for naming, separation of concerns, TypeScript, code organisation, testing, and maintainability. Project-specific architecture stays in each application.
- Category: standard
- Location: `standards/cursor/` (`version.json` and `rules/`), copied by `scripts/sync-cursor-standards.mjs`
- Status: implemented
- Use: core
- Priority: now
- Adoption: Run the sync script against the application and commit `.cursor/rules/framework/` plus `.cursor/framework-standards.json`. A later version is a bump of `version.json`, a rerun, and a commit. The sync does not rewrite application source. `framework-check` does not report this version.
- Dependencies: the sync script. Not an npm package and not a remote Cursor rule import.

### Static deployment

- Purpose: Publish a caller-supplied static directory, refuse a root account and environment files, switch the `current` symlink, and point `current` back at `previous` on rollback. The caller supplies the Node version file, install command, build command, output directory, and entry file. The Next.js profile passes `.nvmrc`, `pnpm install --frozen-lockfile`, `pnpm check`, `out`, and `index.html`.
- Category: standard
- Location: `.github/workflows/deploy-static.yml`, called at tag `deploy-static-v1` after that tag exists
- Status: implemented
- Use: core
- Priority: now
- Adoption: After `deploy-static-v1` exists on the default branch, replace a copied workflow with a caller that passes the static profile, `rollback`, and the four secrets. Move that tag to adopt a compatible fix. A breaking caller contract uses a new tag. Until the tag exists, keep the working local workflow. The application does not copy the script.
- Dependencies: secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, and `VPS_KNOWN_HOSTS`, plus the caller's build profile. For the Next.js profile, `pnpm check` must write `out/index.html`.

### Package release

- Purpose: Version the framework packages independently with Changesets. Publish is skipped until the npm scope is confirmed. One package does not force the others to the same version.
- Category: standard
- Location: `.github/workflows/release.yml` and `.changeset/config.json`
- Status: implemented
- Use: core
- Priority: now
- Adoption: Applications do not call this workflow. They adopt a package by bumping a published version after `framework-check` reports it. Publication is blocked while `scopeConfirmed` is false.
- Dependencies: Changesets

### CI pipeline

- Purpose: A reusable check workflow for applications. `.github/workflows/ci.yml` in this repository checks the framework only and is not that shared caller.
- Category: standard
- Location: no reusable application workflow yet
- Status: proposed
- Use: core
- Priority: now
- Adoption: None. Applications keep their own check job until a tagged reusable workflow exists.
- Dependencies: none

### Secrets and deploy access

- Purpose: Per-application deploy credentials and a non-root deploy account. The static workflow checks the four secret names and refuses to deploy as root. Rotation, hosting access, and other secret classes are not a shared workflow.
- Category: standard
- Location: the secret contract in `docs/consumer-contract.md`
- Status: proposed
- Use: core
- Priority: now
- Adoption: Set `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, and `VPS_KNOWN_HOSTS` on the application. Do not commit those values.
- Dependencies: Static deployment for the static profile

### Git practices

- Purpose: Repository permissions, branch protection, and review expectations. Each repository keeps its own access list.
- Category: standard
- Location: no shared ruleset yet
- Status: proposed
- Use: core
- Priority: next
- Adoption: None until a documented ruleset exists. Applying it is a GitHub setting, not a package install.
- Dependencies: none

### Dependency update policy

- Purpose: Policy for dependencies that are not framework packages, including vulnerability review. Framework package versions stay with `framework-check`.
- Category: standard
- Location: no shared bot configuration yet
- Status: proposed
- Use: core
- Priority: next
- Adoption: None. An application adopts a framework package update by editing its own manifest.
- Dependencies: Framework update checker for `@app-framework/*` only

### Automated test policy

- Purpose: Where unit, integration, contract, and end-to-end tests live, and that application tests stay in the application. This repository's tests cover the framework.
- Category: standard
- Location: no shared test workflow yet
- Status: proposed
- Use: core
- Priority: next
- Adoption: None until the policy is written as a convention or a reusable check. Shipping this repository's tests does not test an application.
- Dependencies: CI pipeline, once that workflow exists

### Documentation structure

- Purpose: Where an application's README, decisions, and link to this catalogue live. Product description stays in the application.
- Category: standard
- Location: no shared documentation template yet
- Status: proposed
- Use: core
- Priority: now
- Adoption: Link to this catalogue. Do not copy it. A documentation layout change is a migration in each application that wants it.
- Dependencies: none

### Security baseline

- Purpose: A checklist for transport, input validation, access, headers, secret handling, supply chain, and incident response. Installing a package does not make a product compliant.
- Category: standard
- Location: no checklist file yet
- Status: proposed
- Use: core
- Priority: next
- Adoption: None until the checklist exists. Each application still has to implement and review the controls.
- Dependencies: Application configuration for the server and browser split

### Accessibility standard

- Purpose: Keyboard access, semantics, contrast, reduced motion, and screen-reader expectations, including tests at the component boundary. Semantic attributes stay enabled.
- Category: standard
- Location: no shared checklist yet. `af-heading` sets a heading role when it connects.
- Status: proposed
- Use: core
- Priority: next
- Adoption: UI package updates follow the package path. Other accessibility work stays in the application until a shared rule exists.
- Dependencies: UI primitives and design tokens for the elements that exist

### Responsive layout

- Purpose: Layout that remains usable on a narrow viewport. The UI stylesheet already reduces theme padding below 40rem. A shared breakpoint policy is not a separate artifact.
- Category: standard
- Location: the viewport rule in `packages/ui/styles.css`; no separate policy file
- Status: proposed
- Use: core
- Priority: next
- Adoption: A stylesheet change follows the UI package. Applications still test their own layouts.
- Dependencies: UI primitives and design tokens

## Candidates

### Technology baseline

- Purpose: The supported Next.js, TypeScript, Node, and pnpm line for a new application. The starter manifest is the current copy. It is not a centrally updated pin.
- Category: candidate
- Location: App-Template
- Status: deferred
- Use: core
- Priority: now
- Adoption: New applications inherit the template. An existing application changes its own toolchain. This repository does not synchronise copied starter files.
- Dependencies: none

### Repository structure

- Purpose: The starter folder layout. Application-specific modules stay in the application. A structural change needs an explicit migration.
- Category: candidate
- Location: App-Template
- Status: deferred
- Use: core
- Priority: now
- Adoption: New applications inherit the template. Existing applications are not rearranged from here.
- Dependencies: none

### Project bootstrap

- Purpose: The bootable starter, including the landing page shell. This repository does not scaffold applications.
- Category: candidate
- Location: App-Template
- Status: deferred
- Use: core
- Priority: now
- Adoption: Create the application from the template. Later template commits do not change repositories already created.
- Dependencies: none

### Development scripts

- Purpose: Local `dev`, `check`, and `build` commands. They should stay thin wrappers around the tools an application already runs.
- Category: candidate
- Location: App-Template
- Status: deferred
- Use: core
- Priority: now
- Adoption: New applications inherit the scripts. Changing them later is a commit in that application.
- Dependencies: Framework update checker when `dev` calls `framework-check`

### Quality checks

- Purpose: Local formatting and lint on staged files, with the full check in CI. A shared preset waits on Lint and TypeScript presets.
- Category: candidate
- Location: App-Template
- Status: deferred
- Use: core
- Priority: now
- Adoption: New applications inherit the local check. A hook change is a migration, not a package bump.
- Dependencies: Lint and TypeScript presets, if that package is added

### Server provisioning

- Purpose: Host, TLS, reverse proxy, and process setup that turn a release directory into a served site. Copying files into `/root/apps` does not serve them.
- Category: candidate
- Location: no infrastructure repository yet
- Status: deferred
- Use: optional
- Priority: next
- Adoption: None. Provision the host by hand until a reviewed infrastructure source exists. This repository does not select a provider.
- Dependencies: Static deployment for the artifact layout

### Server deployment profile

- Purpose: A deployment path for a long-running Node.js process. It is not built. The only shared profile is static export.
- Category: candidate
- Location: no workflow yet
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None. Do not point a server application at `deploy-static-v1`.
- Dependencies: none

### Developer test state

- Purpose: Seed and fixture conventions for local development. Fixture data stays in the application unless two applications share a helper.
- Category: candidate
- Location: no playbook yet
- Status: deferred
- Use: optional
- Priority: next
- Adoption: None.
- Dependencies: none

### Branding and experience modes

- Purpose: Guidance for a public marketing surface versus an operational product, and for themes beyond light and dark. `af-theme` implements light and dark only.
- Category: candidate
- Location: no design guide yet
- Status: deferred
- Use: optional
- Priority: next
- Adoption: None. Each application controls its own presentation.
- Dependencies: UI primitives and design tokens for the tokens that exist

### Observability

- Purpose: Process logs, metrics, traces, uptime checks, and where alerts go. Applications would expose a documented health or log surface. No collector is shared.
- Category: candidate
- Location: no monitoring service yet
- Status: deferred
- Use: core
- Priority: next
- Adoption: None.
- Dependencies: none

### Backups and restore

- Purpose: Backup schedule, encryption, retention, and a restore drill. Each dataset has its own policy.
- Category: candidate
- Location: no runbook yet
- Status: deferred
- Use: optional
- Priority: next
- Adoption: None. Verify restores against the real dataset.
- Dependencies: none

### Legal and compliance review

- Purpose: A pre-launch checklist for privacy, terms, consumer law, retention, age, and jurisdiction. A shared checklist cannot make a product compliant.
- Category: candidate
- Location: no checklist yet
- Status: deferred
- Use: core
- Priority: next
- Adoption: None. Assess each product and jurisdiction separately.
- Dependencies: none

### IP and licensing

- Purpose: Ownership, contractor terms, trademarks, dependency licences, and claims that have been independently checked.
- Category: candidate
- Location: no checklist yet
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None. The assessment is individual.
- Dependencies: none

### App onboarding

- Purpose: A checklist for choosing optional capabilities while creating an application. A wizard is not part of this catalogue.
- Category: candidate
- Location: App-Template, as a short checklist when the starter documents one
- Status: deferred
- Use: core
- Priority: later
- Adoption: None. Do not add an installer that selects or provisions capabilities.
- Dependencies: this catalogue

### Domain modelling

- Purpose: Entities and invariants stay beside the application's business logic. Promote a method only when two applications use it.
- Category: candidate
- Location: the application
- Status: deferred
- Use: core
- Priority: later
- Adoption: None.
- Dependencies: none

### API design

- Purpose: Choose the API the product needs, validate input, paginate, and handle deprecation. Broader than environment configuration.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: Application configuration for environment values only

### Event-driven design

- Purpose: Start with simple typed events. Add a queue when retries or durability require it.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: Background jobs, if a queue is later shared

### Scale and caching

- Purpose: Measure a bottleneck before caching it. Invalidation and concurrency have to be explicit.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: none

### Database selection

- Purpose: Choose a database for the workload. Do not assume every application can use the same engine.
- Category: candidate
- Location: an application decision
- Status: deferred
- Use: optional
- Priority: next
- Adoption: None until Database integration exists for the chosen engine.
- Dependencies: Database integration, when that package exists

### Migrations and data integrity

- Purpose: Version data changes, test a rollback, enforce constraints, and keep retries idempotent.
- Category: candidate
- Location: the application's migration tool
- Status: deferred
- Use: optional
- Priority: next
- Adoption: None. Migrations stay with the application's schema.
- Dependencies: Database integration, when that package exists

### Multi-tenancy

- Purpose: Enforce tenant isolation on the server. Design roles and the data model together.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: Identity and access, and the database the application chose

### Data retention and export

- Purpose: Deletion, archive, backup, restore, and export duties for each dataset.
- Category: candidate
- Location: the application, with the legal review
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: Legal and compliance review

### Search and indexing

- Purpose: Use ordinary filters or full-text first. Add a search provider only when that is insufficient.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: none

### Feature flags

- Purpose: Flags only when a release or an experiment needs them. They should not become permanent branches in the product.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: none

### User journeys

- Purpose: Reuse a reviewed identity flow. Onboarding that is unique to the product stays in the application.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: next
- Adoption: None until Identity and access exists.
- Dependencies: Identity and access

### Age assurance and identity checks

- Purpose: Age or formal identity checks only when the law or a contract requires them. Collect as little sensitive data as possible.
- Category: candidate
- Location: a specialist provider, chosen per product
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None. This cannot be satisfied by installing a package.
- Dependencies: Legal and compliance review

### Abuse prevention

- Purpose: Rate limits, spam controls, and a security audit trail, with thresholds chosen for the product.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: next
- Adoption: None.
- Dependencies: none

### Compliance certification

- Purpose: Trust claims only when an independent assessment supports them.
- Category: candidate
- Location: an external assessor
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: none

### Content management

- Purpose: Publishing, revisions, approval, and moderation, only for a product that needs them.
- Category: candidate
- Location: the application or a provider
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: none

### Navigation and technical SEO

- Purpose: Route meaning, metadata, canonical URLs, and a sitemap for public pages. Private pages do not use the same rules.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: next
- Adoption: None. The starter does not add a public-site SEO package.
- Dependencies: none

### Landing page and conversion

- Purpose: The starter's generic first page, and any later marketing page. There is no shared marketing interface. This repository does not build a landing page.
- Category: candidate
- Location: App-Template for the starter page
- Status: deferred
- Use: optional
- Priority: later
- Adoption: New applications inherit the starter page and then replace it.
- Dependencies: none

### Search analytics and redirects

- Purpose: Keep public URLs and record organic performance when a site is replaced.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: none

### Internationalisation

- Purpose: Standard date, number, and currency formatting, plus translation and right-to-left layout when a product asks for them.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: UI primitives and design tokens only for text those elements already render

### Advanced widgets

- Purpose: Tables, charts, calendars, and other widgets. Add one to `@app-framework/ui` only after an application needs that element, and keep it accessible.
- Category: candidate
- Location: `@app-framework/ui`, when a consumer needs the element
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None until that element is published.
- Dependencies: UI primitives and design tokens

### Feedback and loading states

- Purpose: Consistent empty, loading, and error feedback. Domain-specific errors stay in the application.
- Category: candidate
- Location: the application, or `@app-framework/ui` if a primitive is repeated
- Status: deferred
- Use: core
- Priority: next
- Adoption: None until a repeated primitive is added to the UI package.
- Dependencies: UI primitives and design tokens

### Collaboration and shared editing

- Purpose: Decide consistency, ownership, and conflict handling before choosing locks or a merge structure.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: Realtime transport, if live collaboration is later shared

### Scheduling and booking

- Purpose: Bookings and reminders for a product. This is separate from background job scheduling.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: none

### Maps and geospatial

- Purpose: A provider map and the application's own geospatial rules.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: a map provider

### Provider integrations

- Purpose: Adapters, idempotency, retries, signature checks, and secret isolation for webhooks and third-party APIs.
- Category: candidate
- Location: the application, until two applications share an adapter
- Status: deferred
- Use: optional
- Priority: next
- Adoption: None.
- Dependencies: none

### Analytics definitions

- Purpose: Define measures with a purpose, consent, and a check on data quality. Do not treat observation as a conclusion.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: Analytics instrumentation, if that package exists

### Experiments

- Purpose: A/B tests and staged rollouts only when traffic and the decision justify them.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: Feature flags, if flags are adopted

### Monitoring and incident response

- Purpose: Who receives an alert, what they do, and the recovery target. No on-call tool is shared.
- Category: candidate
- Location: an operations note in the application
- Status: deferred
- Use: core
- Priority: next
- Adoption: None.
- Dependencies: Observability

### Manual and device QA

- Purpose: Risk-based checks on a browser, a device, performance, and security, in addition to automated tests.
- Category: candidate
- Location: no shared matrix yet
- Status: deferred
- Use: core
- Priority: next
- Adoption: None.
- Dependencies: Automated test policy

### Customer support

- Purpose: A path for help and issue triage. The replies and the roadmap belong to the product.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: none

### Application lifecycle

- Purpose: Export data, revoke secrets, and retire DNS and infrastructure on purpose. Also the point at which a shared module is removed.
- Category: candidate
- Location: no shared checklist yet
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None. Retiring an application is a change in that application and its host.
- Dependencies: Legal and compliance review for export and deletion duties

### Cost controls

- Purpose: Budgets and capacity decisions after there is usage to measure. Do not add capacity from a catalogue entry.
- Category: candidate
- Location: the application's hosting account
- Status: deferred
- Use: optional
- Priority: next
- Adoption: None.
- Dependencies: none

### Operational product interface

- Purpose: Dashboards, operational task flows, administration screens, and role-specific views. These are product interfaces, not a shared package.
- Category: candidate
- Location: the application
- Status: deferred
- Use: optional
- Priority: later
- Adoption: None.
- Dependencies: Identity and access, when a product needs roles

## Moving a pattern

1. Name a second real use, or a strong first one, as repeated behaviour.
2. Decide whether the canonical artifact is a package, a standard or workflow, or still only a candidate.
3. Record the location, the consumers, the dependencies, and how an existing application adopts the change.
4. Build the smallest version and try it from a consuming application, not only inside this repository.
5. Mark it implemented only after that central artifact exists. A written row is not enough.

## Former requirement index

These names are the previous 121-item inventory. The pattern column is the status that applies. This index is not a second catalogue.

| Former requirement | Pattern |
| --- | --- |
| application structure | Repository structure |
| architecture patterns | Development conventions |
| domain design | Domain modelling |
| type and API contracts | Application configuration |
| extension mechanisms | Technology baseline |
| compatibility | Package release |
| application profiles | Server deployment profile |
| dependency updates | Framework update checker |
| controlled migrations | Migrations and data integrity |
| release governance | Package release |
| regression prevention | Automated test policy |
| module decommissioning | Application lifecycle |
| platform evolution | Technology baseline |
| project lifecycle | Application lifecycle |
| knowledge retention | Documentation structure |
| project bootstrap | Project bootstrap |
| Cursor integration | Development conventions |
| code quality | Development conventions |
| development states | Developer test state |
| developer ergonomics | Development scripts |
| collaboration | Git practices |
| automation safeguards | Development conventions |
| documentation | Documentation structure |
| unit tests | Automated test policy |
| integration tests | Automated test policy |
| contract tests | Automated test policy |
| end-to-end tests | Automated test policy |
| visual tests | Manual and device QA |
| accessibility tests | Accessibility standard |
| performance tests | Manual and device QA |
| security tests | Security baseline |
| pipeline gates | CI pipeline |
| relational storage | Database integration |
| access layer | Database integration |
| data validation | Application configuration |
| schema evolution | Migrations and data integrity |
| offline persistence | Client offline sync |
| synchronisation | Client offline sync |
| caching and search | Scale and caching |
| data lifecycle | Data retention and export |
| database operations | Database integration |
| registration | Identity and access |
| authentication | Identity and access |
| session management | Identity and access |
| authorisation | Identity and access |
| account management | Identity and access |
| team access | Identity and access |
| age assurance | Age assurance and identity checks |
| identity verification | Age assurance and identity checks |
| application protection | Security baseline |
| network and transport | Security baseline |
| secrets | Secrets and deploy access |
| supply-chain security | Dependency update policy |
| abuse controls | Abuse prevention |
| trust assurance | Compliance certification |
| privacy engineering | Security baseline |
| incident response | Monitoring and incident response |
| privacy and terms | Legal and compliance review |
| consumer law | Legal and compliance review |
| payment compliance | Legal and compliance review |
| age and identity compliance | Legal and compliance review |
| accessibility law | Legal and compliance review |
| intellectual property | IP and licensing |
| open-source obligations | IP and licensing |
| operational records | Legal and compliance review |
| regional regulation | Legal and compliance review |
| design tokens | UI primitives and design tokens |
| shared primitives | UI primitives and design tokens |
| brandable themes | Branding and experience modes |
| experience modes | Branding and experience modes |
| navigation | Navigation and technical SEO |
| information hierarchy | UI primitives and design tokens |
| responsive behaviour | Responsive layout |
| accessibility | Accessibility standard |
| sensory safety | Accessibility standard |
| localisation | Internationalisation |
| interaction states | Feedback and loading states |
| usability measurement | Analytics definitions |
| landing page | Landing page and conversion |
| discovery journeys | Landing page and conversion |
| SEO | Navigation and technical SEO |
| conversion | Landing page and conversion |
| trust signals | Landing page and conversion |
| content publishing | Content management |
| communication | Notifications and messaging |
| dashboard | Operational product interface |
| workflows | Operational product interface |
| data management | Database integration |
| keyboard efficiency | Accessibility standard |
| role-specific views | Operational product interface |
| administration | Operational product interface |
| operational correctness | Automated test policy |
| Realtime systems | Realtime transport |
| payments | Billing |
| billing | Billing |
| file storage | File and media storage |
| media safety | File and media storage |
| notifications | Notifications and messaging |
| jobs and scheduling | Background jobs |
| search and discovery | Search and indexing |
| collaboration | Collaboration and shared editing |
| external APIs | Provider integrations |
| AI integration | AI integration |
| build artifacts | Static deployment |
| deployment pipelines | Static deployment |
| environment isolation | Secrets and deploy access |
| hosting | Server provisioning |
| application separation | Repository structure |
| release management | Static deployment |
| resource management | Cost controls |
| backup and recovery | Backups and restore |
| infrastructure as code | Server provisioning |
| developer permissions | Git practices |
| application logs | Observability |
| monitoring | Observability |
| tracing | Observability |
| product analytics | Analytics instrumentation |
| business KPIs | Analytics definitions |
| meta-analytics | Analytics definitions |
| experimentation | Experiments |
| alerting | Monitoring and incident response |
