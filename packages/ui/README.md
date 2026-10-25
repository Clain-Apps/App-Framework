# @app-framework/ui

Base interface for App Framework applications: custom elements styled by tag name.

```html
<link rel="stylesheet" href="node_modules/@app-framework/ui/styles.css" />
<af-theme name="light">
  <af-heading level="1">Title</af-heading>
  <af-panel>Content</af-panel>
</af-theme>
<script type="module">
  import { defineAppElements } from "@app-framework/ui";
  defineAppElements();
</script>
```

`af-theme` sets light or dark color variables. `af-heading` exposes a heading level from 1 to 6. `af-panel` is a padded surface. Spacing, measure, type, and color live as custom properties in `styles.css`.

See `examples/base.html` after `pnpm build`.

Tabs, accordions, graphs, calendars, modals, menus, routing, and animation are not part of this version. Add an element here only when an application needs it. State stays on attributes, properties, and events.

This package does not depend on the other framework packages. The npm scope is not confirmed, so the package is private and is not published yet.
