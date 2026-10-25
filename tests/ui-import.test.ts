import { describe, expect, it } from "vitest";
import { defineAppElements } from "../packages/ui/src/index.js";

describe("ui import without a DOM", () => {
  it("loads and does not register elements", () => {
    expect(typeof HTMLElement).toBe("undefined");
    expect(() => defineAppElements()).not.toThrow();
  });
});
