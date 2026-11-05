# @app-framework/dev-tools

## 0.2.0

### Minor Changes

- 0680918: Support static, Node.js, and Next.js standalone deploy profiles in one shared workflow, default to /apps/<app-name>/, and write the caller only through framework deploy enable.
- 6cd907d: Add the framework CLI so an existing application can adopt shared capabilities without copying the starter or enabling deploy by default.
- 6c67491: Add framework-setup so an application can validate its framework configuration, sync shared Cursor standards, and write a static deployment caller.
- 0bf2d6b: Make the framework command run from an installed package, including a symlinked bin, and install available capabilities during adoption.

## 0.1.0

### Minor Changes

- Initial unpublished release of the framework version check.
