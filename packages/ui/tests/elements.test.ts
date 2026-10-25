// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { defineAppElements } from "../src/index.js";

const stylesheet = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../styles.css"),
  "utf8",
);

describe("tag stylesheet", () => {
  it("styles the base elements by tag name", () => {
    for (const tag of ["af-theme", "af-heading", "af-panel"]) {
      expect(stylesheet).toContain(tag);
    }
    expect(stylesheet).not.toMatch(/\.af-/);
    expect(stylesheet).toContain("--af-space-3");
    expect(stylesheet).toContain("--af-measure-min");
    expect(stylesheet).toContain("--af-measure-max");
    expect(stylesheet).toContain("clamp(");
    expect(stylesheet).toContain('af-theme[name="dark"]');
  });
});

describe("custom elements", () => {
  it("registers the base tags once", () => {
    defineAppElements();
    defineAppElements();
    expect(customElements.get("af-theme")).toBeTypeOf("function");
    expect(customElements.get("af-heading")).toBeTypeOf("function");
    expect(customElements.get("af-panel")).toBeTypeOf("function");
  });

  it("exposes an af-heading level to assistive tech", () => {
    defineAppElements();
    const heading = document.createElement("af-heading");
    heading.setAttribute("level", "3");
    document.body.append(heading);

    expect(heading.getAttribute("role")).toBe("heading");
    expect(heading.getAttribute("aria-level")).toBe("3");
    expect(heading.textContent).toBe("");

    heading.setAttribute("level", "9");
    expect(heading.getAttribute("aria-level")).toBe("2");
  });

  it("keeps theme names to light and dark", () => {
    defineAppElements();
    const theme = document.createElement("af-theme");
    document.body.append(theme);
    expect(theme.getAttribute("name")).toBe("light");

    theme.setAttribute("name", "dark");
    expect(theme.getAttribute("name")).toBe("dark");

    theme.setAttribute("name", "blue");
    expect(theme.getAttribute("name")).toBe("light");
  });
});
