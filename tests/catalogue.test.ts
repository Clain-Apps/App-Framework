import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const formerRequirements = [
  "application structure",
  "architecture patterns",
  "domain design",
  "type and API contracts",
  "extension mechanisms",
  "compatibility",
  "application profiles",
  "dependency updates",
  "controlled migrations",
  "release governance",
  "regression prevention",
  "module decommissioning",
  "platform evolution",
  "project lifecycle",
  "knowledge retention",
  "project bootstrap",
  "Cursor integration",
  "code quality",
  "development states",
  "developer ergonomics",
  "collaboration",
  "automation safeguards",
  "documentation",
  "unit tests",
  "integration tests",
  "contract tests",
  "end-to-end tests",
  "visual tests",
  "accessibility tests",
  "performance tests",
  "security tests",
  "pipeline gates",
  "relational storage",
  "access layer",
  "data validation",
  "schema evolution",
  "offline persistence",
  "synchronisation",
  "caching and search",
  "data lifecycle",
  "database operations",
  "registration",
  "authentication",
  "session management",
  "authorisation",
  "account management",
  "team access",
  "age assurance",
  "identity verification",
  "application protection",
  "network and transport",
  "secrets",
  "supply-chain security",
  "abuse controls",
  "trust assurance",
  "privacy engineering",
  "incident response",
  "privacy and terms",
  "consumer law",
  "payment compliance",
  "age and identity compliance",
  "accessibility law",
  "intellectual property",
  "open-source obligations",
  "operational records",
  "regional regulation",
  "design tokens",
  "shared primitives",
  "brandable themes",
  "experience modes",
  "navigation",
  "information hierarchy",
  "responsive behaviour",
  "accessibility",
  "sensory safety",
  "localisation",
  "interaction states",
  "usability measurement",
  "landing page",
  "discovery journeys",
  "SEO",
  "conversion",
  "trust signals",
  "content publishing",
  "communication",
  "dashboard",
  "workflows",
  "data management",
  "keyboard efficiency",
  "role-specific views",
  "administration",
  "operational correctness",
  "Realtime systems",
  "payments",
  "billing",
  "file storage",
  "media safety",
  "notifications",
  "jobs and scheduling",
  "search and discovery",
  "collaboration",
  "external APIs",
  "AI integration",
  "build artifacts",
  "deployment pipelines",
  "environment isolation",
  "hosting",
  "application separation",
  "release management",
  "resource management",
  "backup and recovery",
  "infrastructure as code",
  "developer permissions",
  "application logs",
  "monitoring",
  "tracing",
  "product analytics",
  "business KPIs",
  "meta-analytics",
  "experimentation",
  "alerting",
];

const implementedPatterns = [
  "UI primitives and design tokens",
  "Application configuration",
  "Framework update checker",
  "Development conventions",
  "Static deployment",
  "Package release",
];

describe("reusable patterns catalogue", () => {
  const catalogue = readFileSync(path.join(root, "REUSABLE_PATTERNS_CATALOGUE.md"), "utf8");
  const [patternsText, indexText] = catalogue.split("## Former requirement index");
  const blocks = (patternsText ?? "").split(/^### /m).slice(1);
  const headings = blocks.map((block) => block.split("\n")[0]?.trim() ?? "");

  it("is the only catalogue and states that a row is not an implementation", () => {
    expect(existsSync(path.join(root, "docs/capability-catalogue.md"))).toBe(false);
    expect(patternsText).toContain("A documented pattern is not an implemented capability.");
    expect(indexText).toBeDefined();
  });

  it("gives every pattern one category, status, use, and adoption path", () => {
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).toMatch(/^- Purpose: .+/m);
      expect(block).toMatch(/^- Category: (package|standard|candidate)$/m);
      expect(block).toMatch(/^- Location: .+/m);
      expect(block).toMatch(/^- Status: (implemented|proposed|deferred)$/m);
      expect(block).toMatch(/^- Use: (core|optional)$/m);
      expect(block).toMatch(/^- Priority: (now|next|later)$/m);
      expect(block).toMatch(/^- Adoption: .+/m);
      expect(block).toMatch(/^- Dependencies: .+/m);
    }
  });

  it("marks only the existing central artifacts as implemented", () => {
    const implemented = blocks
      .filter((block) => /^- Status: implemented$/m.test(block))
      .map((block) => block.split("\n")[0]?.trim());
    expect(implemented).toEqual(implementedPatterns);
  });

  it("points every former requirement at one pattern", () => {
    expect(formerRequirements).toHaveLength(121);
    const rows = (indexText ?? "")
      .split("\n")
      .filter((line) => line.startsWith("| ") && !line.startsWith("| Former") && !line.startsWith("| ---"));
    expect(rows).toHaveLength(121);

    const counts = new Map<string, number>();
    for (const name of formerRequirements) counts.set(name, (counts.get(name) ?? 0) + 1);

    for (const [name, count] of counts) {
      const found = rows.filter((row) => row.startsWith(`| ${name} |`));
      expect(found, name).toHaveLength(count);
      for (const row of found) {
        const pattern = row.split("|")[2]?.trim();
        expect(headings, row).toContain(pattern);
      }
    }
  });
});
