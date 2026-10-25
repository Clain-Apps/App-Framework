import { HeadingElement } from "./heading.js";
import { PanelElement } from "./panel.js";
import { ThemeElement } from "./theme.js";

export { HeadingElement } from "./heading.js";
export { PanelElement } from "./panel.js";
export { ThemeElement, type ThemeName } from "./theme.js";

export const appElementTags = {
  theme: "af-theme",
  heading: "af-heading",
  panel: "af-panel",
} as const;

export function defineAppElements(): void {
  if (typeof customElements === "undefined") return;
  define(appElementTags.theme, ThemeElement);
  define(appElementTags.heading, HeadingElement);
  define(appElementTags.panel, PanelElement);
}

function define(name: string, constructor: CustomElementConstructor): void {
  if (customElements.get(name) === undefined) customElements.define(name, constructor);
}
