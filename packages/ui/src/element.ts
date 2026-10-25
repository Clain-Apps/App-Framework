const domElement = globalThis.HTMLElement;

export const ElementBase: typeof HTMLElement =
  typeof domElement === "undefined" ? (class {} as unknown as typeof HTMLElement) : domElement;
