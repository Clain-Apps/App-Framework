# Reusable Patterns Catalogue

**Purpose:** Maintain one inventory of recurring application needs, the *canonical place* where each solution or standard is maintained, how applications receive improvements, and what remains undecided. The goal is to solve common work once without building an unnecessary platform.

**Proposed home:** `App-Framework/docs/REUSABLE_PATTERNS.md` (the catalogue is owned centrally). `App-Template` should link to it and use it during project setup; individual apps should not maintain independent copies of this catalogue.

**Status:** Architecture proposal, informed by existing apps and prior Cursor reports; **not** a claim that the listed integrations or central distribution mechanisms already work.

## How to read this catalogue

There are **three exclusive ownership categories**:

1. **Framework package** — versioned reusable implementation distributed through a package registry, ordinarily an npm package from App Framework.
2. **Externally managed standard/service** — its canonical source is a shared workflow, configuration, rule distribution, provider console, policy, or infrastructure repository, **not** an application runtime package. Some definitions can still live alongside App Framework, but their delivery mechanism is not npm.
3. **Candidate / decision record** — a recurring concern with a documented strategy or checklist, but **no validated shared implementation or distribution choice yet**. It can later graduate into category 1 or 2.

These categories describe **where the single authoritative solution lives**, not whether a concern is important. Separately:

- **Use:** `Baseline` = every new app needs the convention/check; `Conditional` = only apps with that requirement.
- **Priority:** `Now` = verify as part of App Hub experiment; `Next` = demonstrated likely reuse; `Later` = retain on roadmap only.
- **State:** `Reported` = Cursor described code, not independently verified here; `Proposed` = design only; `Unverified` = needs investigation.

**Important:** A standard may be baseline even if its implementation is optional. The template establishes baseline conventions; applications select conditional capabilities. Some legal/security requirements must be assessed independently for each product and cannot be made compliant simply by installing code.

## Category 1 — Versioned framework packages

Packages encapsulate **reusable code or configuration with stable import/CLI interfaces**. Applications explicitly declare versions and update their lockfiles after testing. Never recreate Next.js, GitHub Actions, Cursor or other established tools as custom packages.

| Pattern / capability | Standard generic solution / boundary | Use | Priority | Canonical home and update route | Evidence / likely consumers | State |
|---|---|---|---|---|---|---|
| **UI primitives & design tokens** | Base typography, spacing, colour, surfaces and reusable accessible components (navigation, panel, grid, button, date picker). App-specific branding remains local. | Baseline | **Now** | `App-Framework/packages/ui` → versioned `@app-framework/ui` → package update | All new apps; App Hub proves change propagation | **Reported:** existing `af-theme`, `af-heading`, `af-panel`; requested controls not verified |
| **Application configuration helper** | Typed environment/public configuration and defaults; no credentials in client output. | Baseline | **Now** | `packages/app-config` → `@app-framework/app-config` | App Template uses it | **Reported:** package exists locally; registry publication not verified |
| **Framework update checker** | Show package versions and available stable releases; never silently alter apps. This is tooling, not a substitute for pnpm. | Baseline | **Now** | `packages/dev-tools` → `@app-framework/dev-tools` CLI | App Template `framework-check` | **Reported:** locally developed; registry publishing not verified |
| **Shared lint / TypeScript / formatting presets** | Versionable configuration for project checks when genuinely duplicated; template selects presets. Avoid hiding major per-app compiler constraints. | Baseline | Next | Possible `@app-framework/config-*` package(s) | All TypeScript applications | Proposed; initially template files suffice |
| **Database integration** | Standard connection lifecycle, validation, migrations and diagnostics using an established library; adapter for chosen database; **app schema and data remain app-owned**. | Conditional | Next | Future `@app-framework/database` or database-specific adapter(s) | PoolComp (MongoDB), Personal Quiz (Firebase), Demand Identifier, App Hub if needed | Proposed; don't force unlike databases into one ORM |
| **Identity & access** | Provider-backed sign-in, sessions, optional SSO and secure authorization utilities; account profiles, roles and tenancy as configurations/extensions. | Conditional | Next | Future `@app-framework/identity` | Personal Quiz; private Demand Identifier; potential PoolComp, War Theatre | Proposed; never hand-roll credentials/cryptography |
| **Billing (payments + invoicing)** | One user-facing capability covering invoices, payment links/checkout, receipts, payment status, refunds and reconciliation; internal submodules can stay separate. Provider manages sensitive card collection. | Conditional | Next | Future `@app-framework/billing` | Invoice Payment Service, future PoolComp fees | Proposed; accounting/provider adapters as needed |
| **AI integration** | Provider clients, structured outputs, tool calls, streaming, usage limits and prompt/version hooks; app-specific reasoning stays in each app. | Conditional | **Next (high)** | Future `@app-framework/ai` | War Theatre, Auto-Debater, Demand Identifier, IntTrader, prior client use | Proposed; strong reuse case |
| **Realtime transport** | Typed messages, connection lifecycle, reconnect, subscriptions and server events; no game rules. | Conditional | Next | Future `@app-framework/realtime` | PoolComp, Auto-Debater, GameHost, Gambit, War Theatre | Proposed; extract from working implementations |
| **Background jobs** | Schedules, queues, retries, idempotency and job observability; use established scheduler/queue. | Conditional | Next | Future `@app-framework/jobs` | Demand Identifier, IntTrader, AI workflows | Proposed |
| **Web data acquisition** | Fetch policies, per-source adapters, timestamps, provenance, deduplication, error handling and lawful access; analysis remains app-specific. | Conditional | Next | Future `@app-framework/data-collection` | Demand Identifier, IntTrader, Auto-Debater research | Proposed |
| **File & media storage** | Secure upload validation, storage adapters, retrieval, cleanup and optional image processing; no arbitrary public upload defaults. | Conditional | Later | Future `@app-framework/storage` | Auto-Debater recordings, future apps | Proposed |
| **Notifications & messaging** | Delivery adapters (email, push, SMS, in-app), templates, queueing and delivery status. | Conditional | Later | Future `@app-framework/notifications` | Billing receipts, PoolComp alerts, Demand Identifier | Proposed |
| **Client offline sync** | Local store, queued mutations, sync cursors and conflict handling; only when product needs offline editing. | Conditional | Later | Future `@app-framework/offline-sync` | PoolComp or mobile tools | Proposed |
| **Analytics instrumentation** | Reusable event interfaces, consent-safe instrumentation hooks and observability adapters; each app defines meaningful KPIs. | Conditional | Later | Future `@app-framework/analytics` | Demand Identifier, IntTrader, App Hub, PoolComp | Proposed |
| **Game Host** | Multiplayer lobbies, participants, presence and game session lifecycle; transport/identity integrations when needed. No combat or game rules. | Conditional | **Later** | Future `@app-framework/game-host` | Existing GameHost and Gambit code; future War Theatre | Proposed extraction; don't copy unreviewed code |
| **Synchronised Start / Playback** | Measure RTT/jitter, estimate clock offset, distribute absolute server-time start, handle lateness; not a guarantee of exact simultaneity. | Conditional | **Later** | Future `@app-framework/synchronised-start` | Gambit, potential other multiplayer games | Proposed |
| **Audio / speech** | Audio capture/streaming, transcription adapter and optional speaker segmentation; debate analysis stays app-specific. | Conditional | Later | Future `@app-framework/audio` | Auto-Debater | Proposed; likely defer until 2nd consumer |

**Package design rule:** Keep public APIs narrow; prefer established libraries/provider adapters; extract after genuine reuse. A package's dependencies should be acyclic. Billing may be **one selectable capability** without separate compulsory invoice↔payments package cycles.

## Category 2 — Central standards, workflows, tools and infrastructure (not app runtime packages)

Applications should hold **thin pointers/configuration** to shared definitions wherever practical. These are the recurring patterns most likely to be accidentally frozen into a copied template.

| Pattern / concern | Canonical management location / strategy | How existing apps get changes | Use | Priority | State |
|---|---|---|---|---|---|
| **Technology baseline** | `App-Template` starter manifest: Next.js, TS, Node, pnpm and supported versions | New apps inherit; existing apps get controlled dependency updates or migration PRs | Baseline | Now | Reported Next.js starter |
| **Repository structure / naming** | Template folder layout + central architecture rules; keep application-specific modules in app | New apps inherit; existing apps need structural codemod/migration if necessary | Baseline | Now | Reported template structure |
| **Cursor / AI coding rules** | Version-controlled canonical rule set, distributed via supported Cursor mechanism, symlink/sync or plugin; local project-specific rules remain local | Rules version/sync update; doesn't rewrite old code | Baseline | **Now** | Proposed distribution; PoolComp has useful starting rules |
| **AI agent guidance & permissions** | Shared `AGENTS.md` policy and selected Cursor rules; app-specific instructions beside app | Shared guidance update/sync; scoped override | Baseline | Next | Reported template rules; shared distribution unverified |
| **CI pipeline** | Reusable GitHub Actions workflow with `workflow_call` (or referenced shared action) | Consumer job points to released workflow; version/tag updated intentionally | Baseline | **Now** | Existing copied CI reported; reusable workflow not confirmed |
| **Deployment pipeline** | Reusable GitHub Actions workflow(s), initially static; later separate Node/server profile | Thin app workflow calls shared release; centrally improved logic | Baseline | **Now** | Reported static pipeline in template; shared reusable workflow unverified |
| **Secrets & deploy access** | GitHub environments/secrets, server access policy, least-privilege deploy account; each app's values isolated | Policy and reusable workflow update; credentials remain per-app/environment | Baseline | Now | Server configuration not validated |
| **Server provisioning, HTTPS, routing** | Infrastructure-as-code or server configuration repo (potentially separate from App Framework), reverse proxy, TLS, process manager | Apply reviewed infrastructure changes centrally; apps supply domain/runtime metadata | Conditional | Next | Proposed; deploy artifacts alone don't serve a site |
| **Git practices & repository access** | GitHub repository templates, permissions, branch protections/rulesets, code ownership and review policy | Organisation/repository settings automation where supported; per-repo permissions remain scoped | Baseline | Next | Proposed |
| **Dependency update & vulnerability policy** | Renovate/Dependabot configuration preset + registry/dependency review; release policy | Bot-created per-app PRs; tests gate adoption | Baseline | Next | Proposed |
| **Quality checks / pre-commit** | Template hook bootstrap + centrally versioned config where worthwhile; quick checks locally, complete checks in CI | Central config / workflow updates; hook bootstrap changes may need migration | Baseline | Now | Reported local check scripts |
| **Automated test policy** | Shared CI test matrix and test conventions; actual tests live with application | Central workflow updates; app tests always remain app-owned | Baseline | Next | Test infrastructure reported |
| **Development scripts / local bootstrap** | App Template scripts (`dev`, `check`, `build`, etc.), ideally thin calls to stable tools | Template for new apps; script migrations or common tool updates for old apps | Baseline | Now | Reported scripts |
| **Release, versions, rollback** | GitHub workflow + release versioning convention, artifact naming, compatibility check and rollback documentation | Reusable workflow updates; lockfile/package changes controlled | Baseline | Now | Static release layout reported |
| **Documentation structure** | Template README, architecture decision records, contribution docs and link to this catalogue; app descriptions stay app-owned | New apps inherit; policy update linked centrally; doc structure migrations as needed | Baseline | Now | Reported responsibility documents |
| **Developer test state** | Shared seed/mock conventions documented centrally; fixture scripts remain application-specific unless reused | Referenced playbook; optionally package a tested helper later | Conditional | Next | Proposed |
| **Security baseline** | Central secure-development standard and checklists (TLS, validation, access, headers, secure secrets, supply chain, incident response) | Central checklist/workflow; app implementation and audit required | Baseline | Next | Proposed |
| **Accessibility / inclusive design standard** | Shared accessibility policy and component-level tests; keyboard, semantics, contrast, reduced motion, screen readers | UI package changes + app-level accessibility checks; never disable semantic attributes | Baseline | Next | Proposed |
| **Responsive / device compatibility policy** | Breakpoint and interaction guidelines centrally; UI package implements primitives; test matrix in CI/manual QA | Style package updates plus app-specific regression testing | Baseline | Next | Proposed |
| **Branding and UX modes** | Design guidance for customer-discovery vs operational-product interfaces; framework UI themes where repeatable | Shared design tokens / reference guidance; each app controls experience | Conditional | Next | Proposed |
| **Observability infrastructure** | VPS/system monitoring, log aggregation, uptime checks and alert routing | Central service/policy change; apps expose documented health/log interfaces | Baseline | Next | Proposed |
| **Backups & restore procedure** | Infrastructure backup schedules, encryption, retention and restore drills; each dataset has own policy | Centrally managed schedules/runbooks; verify app-specific restores | Conditional | Next | Proposed |
| **Legal / compliance review** | Shared pre-launch checklist and decision log, covering privacy, terms, consumer law, data retention, licences, age and identity requirements | Central policy/checklist; per-product and jurisdiction-specific assessment | Baseline | Next | Proposed; no universal compliance package |
| **IP / licensing / third-party assurance** | Shared business/legal checklist: ownership, contractor agreements, trademarks, dependency licences, verified claims/certifications | Policy/document updates; actual assessment is individual | Conditional | Later | Proposed |
| **App onboarding / capability selection** | App Template's optional guided CLI/checklist, reading this catalogue or a machine-readable derivative | New app setup only; existing app can rerun diagnostics, but no automatic migrations | Baseline | **Later** | Proposed, **do not implement wizard yet** |

**Ownership nuance:** The catalogue may live in App Framework, but a policy being *listed there* does not mean its executable canonical source must be in an npm package or that every secret/settings value should be shared. The app template is the assembler and reference point, **not** the continuing owner of copied configurations.

## Category 3 — Unverified patterns and decision placeholders

These are intentionally retained so the original comprehensive list is not lost. Do **not** build implementations simply to make the catalogue complete. For each, identify the trigger, principle, likely owner and future delivery mechanism before prioritising.

| Pattern / decision | Default principle / decision to make when needed | Likely eventual owner / delivery | Use | Priority |
|---|---|---|---|---|
| **Domain modelling** | Keep entities and invariants beside app business logic; promote only generic methods used by 2+ apps | Shared policy; specific domain code in app | Baseline | Later |
| **Separation of concerns & module extraction** | Keep interface, domain, persistence and infrastructure boundaries clear; resist premature extraction | Shared architecture guidance | Baseline | Next |
| **API design / versioning** | Pick APIs appropriate to app; validate input, paginate, handle deprecation/compatibility | API policy + possible client helpers | Conditional | Later |
| **Event-driven design** | Begin with simple typed events; queue only when retries/durability justify it | App design + future package | Conditional | Later |
| **Scale / caching / load distribution** | Measure bottlenecks first; explicit cache invalidation and concurrency policy | App-specific architecture; future utilities | Conditional | Later |
| **Database selection / data relationships** | Choose provider according to workloads; relational schema where useful; don't assume every app can use the same engine | Architecture decision + provider; adapter later | Conditional | Next |
| **Migrations / transactions / integrity** | Version data changes, test rollback/forward compatibility, enforce constraints, account for idempotency | Database tool + app migrations | Conditional | Next |
| **Multi-tenancy** | Tenant isolation must be enforced server-side; role and data model designed together | Identity + database or app architecture | Conditional | Later |
| **Data retention / export / portability** | Define deletion, archive, backup, restore and export obligations per dataset | Legal/data checklist + app code | Conditional | Later |
| **Search and indexing** | Use basic SQL filters/full-text first; add search provider only if necessary | Future package or service | Conditional | Later |
| **Feature flags** | Adopt flags only when releases/experiments need them; avoid permanent complexity | Future small package/provider | Conditional | Later |
| **User journeys, registration and profile UX** | Reuse identity flows where secure; only app-specific onboarding varies | Identity package + UI patterns | Conditional | Next |
| **Age assurance and formal ID checks** | Enable only when legally/contractually appropriate; minimise sensitive data | Specialist provider + compliance decision | Conditional | Later |
| **Abuse prevention & audit trail** | Rate limits, spam controls, security event audit; define risk thresholds | App infra + potential middleware | Conditional | Next |
| **Third-party compliance/security certification** | Make only independently substantiated trust claims; arrange audit when warranted | External assessor, policy | Conditional | Later |
| **Content management & moderation** | Publishing, revisions, approvals and moderation only if app requires it | Provider or future package | Conditional | Later |
| **Navigation / deep links / technical SEO** | Route semantics, metadata, canonical, sitemap and rendering depend on public/private page | Next.js template policy + app implementation | Conditional | Next |
| **Landing page and conversion funnel** | Audience-first call to action, progressive disclosure, branding and trust signals; no one-size-fits-all marketing UI | UI patterns + app content | Conditional | Later |
| **Search analytics & migration redirects** | Preserve URLs and track organic performance when replacing existing public sites | App SEO checklist + provider tools | Conditional | Later |
| **Internationalisation / locale / currencies** | Use standard formatting and date/time zone APIs; RTL and translation where requested | UI helpers, app locale config | Conditional | Later |
| **Tables, charts, calendars and advanced widgets** | Introduce through shared UI package only once demanded; preserve accessibility | Framework UI package | Conditional | Later |
| **Feedback / error / loading patterns** | Consistent states and accessible feedback; classify reusable primitives vs domain-specific errors | UI package + app logic | Baseline | Next |
| **Collaboration & shared editing** | Clarify consistency, ownership and conflict resolution before selecting CRDT/locks | Potential realtime extension | Conditional | Later |
| **Scheduling / booking / reminders** | Distinguish business bookings from background job scheduling | Future domain package | Conditional | Later |
| **Maps / geospatial** | Prefer provider integration and app-specific geospatial policy | Future adapter + app logic | Conditional | Later |
| **Provider integrations and webhooks** | Stable adapters, idempotency, retries, signature validation and secret isolation | Future integration package(s) | Conditional | Next |
| **Analytics/KPI definitions & meta-analytics** | Instrument only with purpose, consent and data quality checks; distinguish observation from inference | Analytics standards + app KPI logic | Conditional | Later |
| **A/B testing & rollouts** | Adopt only when volume and decision quality justify experiments | Analytics service / feature flags | Conditional | Later |
| **Monitoring and incident response** | Define alert ownership, response steps, recovery objectives | Operations policy / monitoring service | Baseline | Next |
| **Manual/browser/device/performance/security QA** | Risk-based test matrix and smoke tests, beyond purely automated unit tests | Shared QA checklist + CI | Baseline | Next |
| **Customer support, feedback, roadmap** | Keep standard pathways for help, issues and triage, but content belongs to product | Template doc pattern + external provider | Conditional | Later |
| **App lifecycle/offboarding** | Export user data, revoke secrets and retire DNS/infrastructure deliberately | Central lifecycle checklist | Conditional | Later |
| **Cost controls / capacity planning** | Monitor hosting/API spend, set budgets and scale only after usage evidence | Shared runbook + provider alerts | Conditional | Next |

## Rules for moving items between categories

1. **Identify a second real use case** (or a very strong first one) and describe the repeated behaviour rather than implementation details.
2. Decide whether the canonical thing is **reusable code**, a **shared workflow/configuration/service**, or merely a **policy/decision**.
3. Record the authoritative location (repository/path/service), consuming apps, an owner, dependencies and release/update mechanism.
4. Make the smallest implementation and verify it from a clean consuming application, not just inside its source workspace.
5. Define the update path for **existing** apps (package bump, pinned workflow update, rules sync, migration PR, provider-side change).
6. Keep application overrides, credentials, database schemas and product-specific business logic in the app unless truly generalisable.
7. Mark a pattern as implemented **only after** the central source and one consumer pass an end-to-end test.

## How a new app should consume the catalogue

**Now: a lightweight checklist, not a wizard.** App Template's README should link here and include a short capability-selection checklist. It ships standard Next.js scaffolding, project checks, thin workflow callers and known working framework dependencies. On creation, the developer:

1. Creates the app from App Template.
2. Chooses deployment profile: **static** or **server-backed** (server-backed must remain unsupported/unchecked until built).
3. Selects optional capabilities: database, identity, billing, AI, realtime, jobs, etc. Only currently released modules are installable; pending capabilities link to their design checklist.
4. Supplies per-app provider configuration, domain and access permissions through the documented secure setup.
5. Runs install, checks, deploy validation and verifies that shared update mechanisms are active.

**Later: an optional CLI wizard**, only after this manual process has been repeated enough to justify automation. It should read a **versioned capability manifest derived from the catalogue**, show required vs optional dependencies, install released packages, produce a per-app `capabilities` declaration or setup checklist, and create action-specific instructions. It must not silently provision secrets, change server permissions or pretend to implement placeholder features.

Possible app-level tracking (illustrative, not a new dependency manager):

```json
{
  "deploymentProfile": "static",
  "capabilities": {
    "ui": "installed",
    "ai": "not-needed",
    "identity": "planned",
    "billing": "not-needed"
  }
}
```

**Avoid duplicate state:** Actual installed package versions live in `package.json` and its lockfile; GitHub workflow revisions live in the calling YAML; runtime configuration is validated by its respective tool. A capability manifest is a **human-readable record of decisions**, not a competing package database.

## Where to make future changes

| Change request | Edit the single source of truth | How App Hub / other apps adopt it |
|---|---|---|
| Default font or panel spacing | `@app-framework/ui` | Publish → update package + lockfile → test and deploy |
| Database connection bug | Relevant framework database adapter | Publish → update package → run migrations/tests if relevant |
| Global Cursor naming rule | Version-controlled shared rules source | Sync/update installed rules; future AI edits follow them; old code needs explicit refactor |
| GitHub static deploy bug | Shared reusable workflow | Update released workflow reference or centrally maintained version, test deployment |
| Node hosting strategy | Separate server deployment profile + infrastructure source | Opt into server profile; migrate app only when necessary |
| Security/legal rule | Canonical policy/checklist | Reassess affected apps and perform needed changes; no false claim of automatic compliance |
| Next.js version or repo architecture | Template for new apps + documented migration | Dependency PR / codemod for existing apps; no magical synchronisation of copied files |

## Small immediate milestone — App Hub proof

**Do not build the wizard or new capabilities first.** Prove three pathways:

- **Package:** publish an updated UI token/component and see App Hub inherit it through a tested package update.
- **Shared workflow:** change central GitHub Actions deployment logic and verify App Hub's thin caller adopts the released update without duplicating the workflow.
- **Shared rules:** improve one central Cursor rule and verify the app obtains the new rule via the chosen distribution method; document that old source code is unchanged until refactored.

**Then** decide whether a central installer, rules packaging and capability dependency UI would actually save work.

## Coverage index back to the original full taxonomy

- **A. Software architecture and engineering:** baseline tech, structure, code conventions, configuration, APIs, events, compatibility, scaling, modularity.
- **B. Developer and AI-assisted development:** bootstrap, IDE/Cursor/AGENTS, tooling, checks, testing data, debugging, onboarding and agent governance.
- **C. Data management:** database selection/access, migrations, transactions, tenants, local storage, offline sync, backups, lifecycle, search, portability.
- **D. Identity:** registration, sessions, login/SSO/MFA, permissions, profiles, teams, age/ID, security logging.
- **E. Security, privacy and trust:** baseline secure coding, transport, secrets, supply chain, vulnerability management, abuse, incident response, assurance, recovery.
- **F. UI, usability and design:** tokens, primitives, responsive accessibility, reduced motion, localisation, customer/operational UX, navigation and feedback.
- **G. Shared product capabilities:** billing, notifications, realtime, jobs, files/media, CMS, collaboration, location, scheduling, AI, integrations, game sessions and synchronised start.
- **H. Testing:** unit, integration, contracts, end-to-end, visual, accessibility, cross-platform, performance, security, regression and release verification.
- **I. Infrastructure and operations:** artifact builds, CI/CD, environments, provisioning, access, release/rollback, networking, processes, persistent storage, scheduled tasks, DR, cost controls.
- **J. Observability and analytics:** metrics, logging, tracing, errors, product/business KPIs, experiments, alerts and analytics governance.
- **K. Public web and SEO:** rendering, crawlers, canonical/meta, URLs, structured data, search discoverability, speed, landing pages, conversion, SEO migration.
- **L. Legal and governance:** privacy, terms, consumer, payments/tax, age/identity, accessibility, IP/licences, contracting, records and sector/jurisdiction review.
- **M. Documentation and product lifecycle:** product/developer/API docs, runbooks, decisions, release notes, support, issue tracking, version migrations, shutdown.

*Maintenance principle: keep this single catalogue comprehensive, while keeping the implementation roadmap deliberately small.*
