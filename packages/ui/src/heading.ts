const DEFAULT_LEVEL = 2;

export class HeadingElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return ["level"];
  }

  get level(): number {
    return headingLevel(this.getAttribute("level"));
  }

  set level(value: number) {
    this.setAttribute("level", String(headingLevel(String(value))));
  }

  connectedCallback(): void {
    this.#apply();
  }

  attributeChangedCallback(): void {
    this.#apply();
  }

  #apply(): void {
    if (this.getAttribute("role") !== "heading") this.setAttribute("role", "heading");
    const level = String(this.level);
    if (this.getAttribute("aria-level") !== level) this.setAttribute("aria-level", level);
  }
}

function headingLevel(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 6) return DEFAULT_LEVEL;
  return parsed;
}
