export type StringField = {
  kind: "string";
  required?: boolean;
  default?: string;
};

export type NumberField = {
  kind: "number";
  required?: boolean;
  default?: number;
};

export type BooleanField = {
  kind: "boolean";
  required?: boolean;
  default?: boolean;
};

export type UrlField = {
  kind: "url";
  required?: boolean;
  default?: string;
};

export type EnumField = {
  kind: "enum";
  values: readonly string[];
  required?: boolean;
  default?: string;
};

export type ConfigField = StringField | NumberField | BooleanField | UrlField | EnumField;

export type ConfigDefinition = {
  server?: Readonly<Record<string, ConfigField>>;
  public?: Readonly<Record<string, ConfigField>>;
};

export type EnvSource = Readonly<Record<string, string | undefined>>;

export type LoadOptions = {
  runtime?: "server" | "browser";
};

export type ConfigVisibility = "server" | "public";

export type ConfigIssue = {
  key: string;
  visibility: ConfigVisibility;
  message: string;
};

type FieldValue<F extends ConfigField> = F extends { kind: "number" }
  ? number
  : F extends { kind: "boolean" }
    ? boolean
    : string;

type FieldOutput<F extends ConfigField> = F extends { default: unknown }
  ? FieldValue<F>
  : F extends { required: false }
    ? FieldValue<F> | undefined
    : FieldValue<F>;

export type SectionOutput<S> = S extends Readonly<Record<string, ConfigField>>
  ? { [K in keyof S]: FieldOutput<S[K]> }
  : Record<string, never>;

export type LoadedConfig<T extends ConfigDefinition> = {
  server: SectionOutput<T["server"]>;
  public: SectionOutput<T["public"]>;
};

export type PublicConfig<T extends ConfigDefinition> = SectionOutput<T["public"]>;
