# Changesets

This repository versions packages independently. A changeset names only the packages that changed. A package that depends on a changed package receives a patch bump, including when its current range would still accept the new version. Unrelated packages do not.

Do not add a changeset for the initial 0.1.0 versions already recorded in each package.

Packages stay private, and publish is skipped, until `framework.scope.json` has `"scopeConfirmed": true`. Private packages are still versioned. They are not tagged until they are public.
