import { describe, expect, it } from "vitest";
import { ConfigError, defineConfig, loadConfig, loadPublicConfig } from "../src/index.js";

const definition = defineConfig({
  server: {
    DATABASE_URL: { kind: "string" },
    PORT: { kind: "number", default: 3000 },
    DEBUG: { kind: "boolean", default: false },
    TOKEN: { kind: "string", required: false },
  },
  public: {
    APP_NAME: { kind: "string" },
    APP_URL: { kind: "url" },
    THEME: { kind: "enum", values: ["light", "dark"], default: "light" },
  },
});

describe("defineConfig", () => {
  it("rejects a key declared as both server and public", () => {
    expect(() =>
      defineConfig({
        server: { API_URL: { kind: "string" } },
        public: { API_URL: { kind: "url" } },
      }),
    ).toThrow(/both server and public/);
  });

  it("rejects an empty enum and a default outside the enum", () => {
    expect(() => defineConfig({ public: { MODE: { kind: "enum", values: [] } } })).toThrow(/at least one enum/);
    expect(() =>
      defineConfig({ public: { MODE: { kind: "enum", values: ["a"], default: "b" } } }),
    ).toThrow(/default is not an enum/);
  });

  it("rejects a default that is not a URL", () => {
    expect(() => defineConfig({ public: { APP_URL: { kind: "url", default: "not-a-url" } } })).toThrow(
      /default is not a valid URL/,
    );
  });
});

describe("loadConfig", () => {
  it("parses present values and applies defaults", () => {
    const config = loadConfig(definition, {
      DATABASE_URL: "postgres://localhost/app",
      APP_NAME: "Demo",
      APP_URL: "https://example.com",
      DEBUG: "1",
    });

    expect(config.server.DATABASE_URL).toBe("postgres://localhost/app");
    expect(config.server.PORT).toBe(3000);
    expect(config.server.DEBUG).toBe(true);
    expect(config.server.TOKEN).toBeUndefined();
    expect(config.public).toEqual({
      APP_NAME: "Demo",
      APP_URL: "https://example.com",
      THEME: "light",
    });
  });

  it("ignores unrelated environment keys", () => {
    const config = loadConfig(definition, {
      DATABASE_URL: "postgres://localhost/app",
      APP_NAME: "Demo",
      APP_URL: "https://example.com",
      EXTRA: "ignored",
    });

    expect(config).not.toHaveProperty("EXTRA");
    expect(JSON.stringify(config)).not.toContain("ignored");
  });

  it("reports every missing and invalid value together", () => {
    expect.assertions(5);
    try {
      loadConfig(definition, {
        DATABASE_URL: "   ",
        PORT: "abc",
        APP_NAME: "",
        APP_URL: "not-a-url",
        THEME: "blue",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as ConfigError;
      expect(configError.issues.map((issue) => issue.key)).toEqual([
        "DATABASE_URL",
        "PORT",
        "APP_NAME",
        "APP_URL",
        "THEME",
      ]);
      expect(configError.message).toContain("DATABASE_URL (server): Required value is missing.");
      expect(configError.message).toContain('APP_URL (public): Expected a valid URL, received "not-a-url".');
      expect(configError.message).not.toContain("abc");
    }
  });

  it("parses booleans, numbers, and enums", () => {
    const config = loadConfig(
      defineConfig({
        server: {
          ENABLED: { kind: "boolean" },
          RATIO: { kind: "number" },
        },
        public: {
          MODE: { kind: "enum", values: ["a", "b"] },
        },
      }),
      { ENABLED: "FALSE", RATIO: "1.5", MODE: "b" },
    );

    expect(config.server.ENABLED).toBe(false);
    expect(config.server.RATIO).toBe(1.5);
    expect(config.public.MODE).toBe("b");
  });

  it("does not echo server values when a server field is invalid", () => {
    const secret = "super-secret-database-password";
    expect.assertions(2);
    try {
      loadConfig(defineConfig({ server: { DATABASE_URL: { kind: "url" } } }), { DATABASE_URL: secret });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it("refuses to load server configuration in a browser runtime", () => {
    const secret = "super-secret-database-password";
    const env = new Proxy(
      { DATABASE_URL: secret, APP_NAME: "Demo", APP_URL: "https://example.com" },
      {
        get(target, property, receiver) {
          if (property === "DATABASE_URL") throw new Error("server env was read");
          return Reflect.get(target, property, receiver);
        },
      },
    );

    expect.assertions(3);
    try {
      loadConfig(definition, env, { runtime: "browser" });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as Error).message).not.toContain(secret);
      expect((error as Error).message).toContain("loadPublicConfig");
    }
  });
});

describe("loadPublicConfig", () => {
  it("returns only public values and does not read server keys", () => {
    const env = new Proxy(
      { APP_NAME: " Demo ", APP_URL: " https://example.com/welcome ", THEME: "dark" },
      {
        get(target, property, receiver) {
          if (property === "DATABASE_URL") throw new Error("server env was read");
          return Reflect.get(target, property, receiver);
        },
      },
    );

    const config = loadPublicConfig(definition, env);
    expect(config).toEqual({
      APP_NAME: "Demo",
      APP_URL: "https://example.com/welcome",
      THEME: "dark",
    });
    expect(config).not.toHaveProperty("DATABASE_URL");
  });
});
