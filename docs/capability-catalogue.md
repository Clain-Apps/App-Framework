# Capability catalogue

This is the authoritative map of recurring application requirements. App-Framework maintains it. App-Template may link to it and describe the subset a starter uses. It must not redefine these requirements or the packages that implement them.

The seven domains are organisational. They are not packages, and a row is not a promise to build one. A package is added only when a requirement has a reusable implementation and a stable interface.

There are 121 requirement groups. Only **dependency updates** is implemented. Everything else is planned or deferred.

## Classification

- **Core standard** — must be considered or satisfied when it applies to an application. That does not require a package.
- **Optional capability** — installed or enabled when a product needs it.
- **Policy assessment** — needs a project-specific or jurisdiction-specific decision.

Status:

- **Implemented** — this repository ships the capability.
- **Planned** — a core standard this repository expects to address when the requirement recurs.
- **Deferred** — an optional capability, a policy decision, or work owned by App-Template. It is not built speculatively.

Possible forms, used per domain: package, standard, template, adapter, integration, policy.

## A. Architecture and lifecycle

How an application is structured, how it stays compatible, and how it changes over its life.

Possible forms: standard, package, template.

### Platform architecture

The shape of an application and the contracts that keep modules interchangeable.

#### application structure

- Classification: Core standard
- Status: Planned

#### architecture patterns

- Classification: Core standard
- Status: Planned

#### domain design

- Classification: Core standard
- Status: Planned

#### type and API contracts

- Classification: Core standard
- Status: Planned
- Foundation: `@app-framework/app-config` defines typed environment contracts. Broader application API contracts are not implemented.

#### extension mechanisms

- Classification: Core standard
- Status: Planned

#### compatibility

- Classification: Core standard
- Status: Planned

#### application profiles

- Classification: Core standard
- Status: Planned

### Maintenance and lifecycle

How dependencies, migrations, and the framework itself are changed without surprising existing applications.

#### dependency updates

- Classification: Core standard
- Status: Implemented
- Implementation: `@app-framework/dev-tools` (`framework-check`) compares installed framework packages with the latest stable npm versions. It distinguishes compatible updates from major updates and reports required packages that are missing. It does not change dependency files.

#### controlled migrations

- Classification: Core standard
- Status: Planned

#### release governance

- Classification: Core standard
- Status: Planned

#### regression prevention

- Classification: Core standard
- Status: Planned

#### module decommissioning

- Classification: Core standard
- Status: Planned

#### platform evolution

- Classification: Core standard
- Status: Planned

#### project lifecycle

- Classification: Core standard
- Status: Planned

#### knowledge retention

- Classification: Core standard
- Status: Planned

## B. Development and quality

How people build the software and how the pipeline proves it.

Possible forms: standard, template, package, integration.

### Developer environment and AI

Local setup, editor integration, and the habits that keep changes reviewable.

#### project bootstrap

- Classification: Core standard
- Status: Deferred
- Note: App-Template owns the bootable project. This repository does not scaffold applications.

#### Cursor integration

- Classification: Core standard
- Status: Planned

#### code quality

- Classification: Core standard
- Status: Planned

#### development states

- Classification: Core standard
- Status: Planned

#### developer ergonomics

- Classification: Core standard
- Status: Planned

#### collaboration

- Classification: Core standard
- Status: Planned

#### automation safeguards

- Classification: Core standard
- Status: Planned

#### documentation

- Classification: Core standard
- Status: Planned

### Testing and quality

The checks that run before a change is trusted.

#### unit tests

- Classification: Core standard
- Status: Planned

#### integration tests

- Classification: Core standard
- Status: Planned

#### contract tests

- Classification: Core standard
- Status: Planned

#### end-to-end tests

- Classification: Core standard
- Status: Planned

#### visual tests

- Classification: Optional capability
- Status: Deferred

#### accessibility tests

- Classification: Core standard
- Status: Planned

#### performance tests

- Classification: Core standard
- Status: Planned

#### security tests

- Classification: Core standard
- Status: Planned

#### pipeline gates

- Classification: Core standard
- Status: Planned

## C. Data and identity

How application data is stored and how callers are identified and authorised.

Possible forms: package, adapter, standard, integration.

### Data and persistence

Storage, validation, and the operational life of data.

#### relational storage

- Classification: Core standard
- Status: Planned

#### access layer

- Classification: Core standard
- Status: Planned

#### data validation

- Classification: Core standard
- Status: Planned

#### schema evolution

- Classification: Core standard
- Status: Planned

#### offline persistence

- Classification: Optional capability
- Status: Deferred

#### synchronisation

- Classification: Optional capability
- Status: Deferred

#### caching and search

- Classification: Optional capability
- Status: Deferred

#### data lifecycle

- Classification: Core standard
- Status: Planned

#### database operations

- Classification: Core standard
- Status: Planned

### Identity and permissions

Accounts, sessions, and the rules for who can do what.

#### registration

- Classification: Core standard
- Status: Planned

#### authentication

- Classification: Core standard
- Status: Planned

#### session management

- Classification: Core standard
- Status: Planned

#### authorisation

- Classification: Core standard
- Status: Planned

#### account management

- Classification: Core standard
- Status: Planned

#### team access

- Classification: Optional capability
- Status: Deferred

#### age assurance

- Classification: Policy assessment
- Status: Deferred

#### identity verification

- Classification: Policy assessment
- Status: Deferred

## D. Security and governance

How the application is protected, and which legal or business rules a project has to decide for itself.

Possible forms: standard, package, policy, integration.

### Security, trust and privacy

Technical protection of the application, its traffic, and its users.

#### application protection

- Classification: Core standard
- Status: Planned

#### network and transport

- Classification: Core standard
- Status: Planned

#### secrets

- Classification: Core standard
- Status: Planned
- Foundation: `@app-framework/app-config` keeps server-only values out of browser-safe configuration. It is not a secrets manager.

#### supply-chain security

- Classification: Core standard
- Status: Planned

#### abuse controls

- Classification: Core standard
- Status: Planned

#### trust assurance

- Classification: Core standard
- Status: Planned

#### privacy engineering

- Classification: Core standard
- Status: Planned

#### incident response

- Classification: Core standard
- Status: Planned

### Legal and business governance

Obligations that depend on the product, the customer, and the jurisdiction.

#### privacy and terms

- Classification: Policy assessment
- Status: Deferred

#### consumer law

- Classification: Policy assessment
- Status: Deferred

#### payment compliance

- Classification: Policy assessment
- Status: Deferred

#### age and identity compliance

- Classification: Policy assessment
- Status: Deferred

#### accessibility law

- Classification: Policy assessment
- Status: Deferred

#### intellectual property

- Classification: Policy assessment
- Status: Deferred

#### open-source obligations

- Classification: Policy assessment
- Status: Deferred

#### operational records

- Classification: Policy assessment
- Status: Deferred

#### regional regulation

- Classification: Policy assessment
- Status: Deferred

## E. User experiences

How people see, navigate, and complete work, including public sites and internal tools.

Possible forms: package, template, standard.

### Design system and UX

Shared visual and interaction rules for applicable interfaces.

#### design tokens

- Classification: Core standard
- Status: Planned
- Foundation: `@app-framework/ui` defines spacing, measure, type, and color custom properties in its tag stylesheet. A full token system is not implemented.

#### shared primitives

- Classification: Core standard
- Status: Planned
- Foundation: `@app-framework/ui` provides `af-theme`, `af-heading`, and `af-panel`. Tabs, accordions, graphs, calendars, modals, and menus are not implemented.

#### brandable themes

- Classification: Optional capability
- Status: Deferred

#### experience modes

- Classification: Optional capability
- Status: Deferred

#### navigation

- Classification: Core standard
- Status: Planned

#### information hierarchy

- Classification: Core standard
- Status: Planned

#### responsive behaviour

- Classification: Core standard
- Status: Planned

#### accessibility

- Classification: Core standard
- Status: Planned

#### sensory safety

- Classification: Optional capability
- Status: Deferred

#### localisation

- Classification: Optional capability
- Status: Deferred

#### interaction states

- Classification: Core standard
- Status: Planned

#### usability measurement

- Classification: Optional capability
- Status: Deferred

### Customer-facing experiences

Public acquisition and content surfaces. A normal application can ship without them.

#### landing page

- Classification: Optional capability
- Status: Deferred
- Note: App-Template owns the starter landing page. This repository does not build one.

#### discovery journeys

- Classification: Optional capability
- Status: Deferred

#### SEO

- Classification: Optional capability
- Status: Deferred

#### conversion

- Classification: Optional capability
- Status: Deferred

#### trust signals

- Classification: Optional capability
- Status: Deferred

#### content publishing

- Classification: Optional capability
- Status: Deferred

#### communication

- Classification: Optional capability
- Status: Deferred

### Internal operational experiences

Tools for people operating the product. They are added when the product needs an internal console.

#### dashboard

- Classification: Optional capability
- Status: Deferred

#### workflows

- Classification: Optional capability
- Status: Deferred

#### data management

- Classification: Optional capability
- Status: Deferred

#### keyboard efficiency

- Classification: Optional capability
- Status: Deferred

#### role-specific views

- Classification: Optional capability
- Status: Deferred

#### administration

- Classification: Optional capability
- Status: Deferred

#### operational correctness

- Classification: Optional capability
- Status: Deferred

## F. Application services

Product capabilities an application adds when the product needs them.

Possible forms: package, adapter, integration.

#### Realtime systems

- Classification: Optional capability
- Status: Deferred

#### payments

- Classification: Optional capability
- Status: Deferred

#### billing

- Classification: Optional capability
- Status: Deferred

#### file storage

- Classification: Optional capability
- Status: Deferred

#### media safety

- Classification: Optional capability
- Status: Deferred

#### notifications

- Classification: Optional capability
- Status: Deferred

#### jobs and scheduling

- Classification: Optional capability
- Status: Deferred

#### search and discovery

- Classification: Optional capability
- Status: Deferred

#### collaboration

- Classification: Optional capability
- Status: Deferred

#### external APIs

- Classification: Optional capability
- Status: Deferred

#### AI integration

- Classification: Optional capability
- Status: Deferred

## G. Delivery and operations

How an application is built, deployed, operated, and observed.

Possible forms: template, standard, integration, package.

### Infrastructure and deployment

Build outputs, environments, and the path to a running application.

#### build artifacts

- Classification: Core standard
- Status: Planned

#### deployment pipelines

- Classification: Core standard
- Status: Deferred
- Note: App-Template owns application deployment configuration.

#### environment isolation

- Classification: Core standard
- Status: Planned

#### hosting

- Classification: Core standard
- Status: Deferred
- Note: App-Template owns hosting and deployment configuration. This repository does not select a provider.

#### application separation

- Classification: Core standard
- Status: Planned

#### release management

- Classification: Core standard
- Status: Planned

#### resource management

- Classification: Core standard
- Status: Planned

#### backup and recovery

- Classification: Core standard
- Status: Planned

#### infrastructure as code

- Classification: Optional capability
- Status: Deferred

#### developer permissions

- Classification: Core standard
- Status: Planned

### Observability and analytics

What operators and the product need to see after release.

#### application logs

- Classification: Core standard
- Status: Planned

#### monitoring

- Classification: Core standard
- Status: Planned

#### tracing

- Classification: Core standard
- Status: Planned

#### product analytics

- Classification: Optional capability
- Status: Deferred

#### business KPIs

- Classification: Optional capability
- Status: Deferred

#### meta-analytics

- Classification: Optional capability
- Status: Deferred

#### experimentation

- Classification: Optional capability
- Status: Deferred

#### alerting

- Classification: Core standard
- Status: Planned
