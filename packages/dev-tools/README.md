# @app-framework/dev-tools

Command-line check for published App-Framework updates.

`framework-check` reads the consumer manifest, ignores unrelated dependencies, and compares installed framework packages with the latest stable versions on the npm registry. Compatible updates and major updates are reported separately. Required packages named in `appFramework.required` are reported when they are missing.

Warnings and registry failures exit 0 so a development script can keep going. The command never edits dependency files.

The npm scope is not confirmed. The package is private and is not published yet. See the repository README before the first publish.
