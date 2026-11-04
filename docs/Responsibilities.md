# Responsibilities

Who owns a change is defined in [`PROJECT-DEFINITION.md`](PROJECT-DEFINITION.md). This page is the boundary to apply before adding a module.

## App-Framework

Recurring solutions with a stable contract live here: the three packages, Cursor standards, the static deployment workflow, and the capability manifest. Candidates live in [`REUSABLE_PATTERNS_CATALOGUE.md`](../REUSABLE_PATTERNS_CATALOGUE.md) until an implementation exists. Setup configures standards and the deploy caller. It leaves dependency files unchanged while the packages are unpublished.

This repository is not a product, a landing page, or a host. It does not hold one product's business rules or the organisation's deploy credentials. Product secrets stay in the application.

## App-Template

The bootable starter. It owns project setup, the landing page, the starter's configuration values, and the thin deploy caller. It consumes published packages and the shared workflow. The shared deploy connection is a Clain-Apps organisation setting. It does not keep a second copy of the workflow.

## Applications

Product behaviour, the choice of optional capabilities, pinned versions, the committed standards pin, and product secrets. Framework sync replaces files in `.cursor/rules/framework` and leaves the application's other Cursor rules in place.

## Adoption

Package, standards, and workflow updates are adopted inside the application repository. The mechanisms are in [`consumer-contract.md`](consumer-contract.md). A candidate has nothing to install.
