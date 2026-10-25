# @app-framework/app-config

Typed environment configuration for Node.js applications.

Define server-only and browser-safe values, then load them from an environment record. Invalid and missing values are reported together. `loadPublicConfig` never reads server keys. `loadConfig` refuses to run when the runtime is `browser`.

This package has no runtime dependencies and does not read a secrets manager or remote configuration service.

The npm scope is not confirmed. The package is private and is not published yet. See the repository README before the first publish.
