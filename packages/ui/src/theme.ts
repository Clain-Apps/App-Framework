import { ElementBase } from "./element.js";

const THEME_NAMES = ["light", "dark"] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export class ThemeElement extends ElementBase {
  static get observedAttributes(): readonly string[] {
    return ["name"];
  }

  get name(): ThemeName {
    return themeName(this.getAttribute("name"));
  }

  set name(value: ThemeName) {
    this.setAttribute("name", themeName(value));
  }

  connectedCallback(): void {
    this.#apply();
  }

  attributeChangedCallback(): void {
    this.#apply();
  }

  #apply(): void {
    const name = this.name;
    if (this.getAttribute("name") !== name) this.setAttribute("name", name);
  }
}

function themeName(value: string | null): ThemeName {
  return THEME_NAMES.find((name) => name === value) ?? "light";
}
