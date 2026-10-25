import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const groups: Array<[string, string, string]> = [
  ["application structure", "Core standard", "Planned"],
  ["architecture patterns", "Core standard", "Planned"],
  ["domain design", "Core standard", "Planned"],
  ["type and API contracts", "Core standard", "Planned"],
  ["extension mechanisms", "Core standard", "Planned"],
  ["compatibility", "Core standard", "Planned"],
  ["application profiles", "Core standard", "Planned"],
  ["dependency updates", "Core standard", "Implemented"],
  ["controlled migrations", "Core standard", "Planned"],
  ["release governance", "Core standard", "Planned"],
  ["regression prevention", "Core standard", "Planned"],
  ["module decommissioning", "Core standard", "Planned"],
  ["platform evolution", "Core standard", "Planned"],
  ["project lifecycle", "Core standard", "Planned"],
  ["knowledge retention", "Core standard", "Planned"],
  ["project bootstrap", "Core standard", "Deferred"],
  ["Cursor integration", "Core standard", "Planned"],
  ["code quality", "Core standard", "Planned"],
  ["development states", "Core standard", "Planned"],
  ["developer ergonomics", "Core standard", "Planned"],
  ["collaboration", "Core standard", "Planned"],
  ["automation safeguards", "Core standard", "Planned"],
  ["documentation", "Core standard", "Planned"],
  ["unit tests", "Core standard", "Planned"],
  ["integration tests", "Core standard", "Planned"],
  ["contract tests", "Core standard", "Planned"],
  ["end-to-end tests", "Core standard", "Planned"],
  ["visual tests", "Optional capability", "Deferred"],
  ["accessibility tests", "Core standard", "Planned"],
  ["performance tests", "Core standard", "Planned"],
  ["security tests", "Core standard", "Planned"],
  ["pipeline gates", "Core standard", "Planned"],
  ["relational storage", "Core standard", "Planned"],
  ["access layer", "Core standard", "Planned"],
  ["data validation", "Core standard", "Planned"],
  ["schema evolution", "Core standard", "Planned"],
  ["offline persistence", "Optional capability", "Deferred"],
  ["synchronisation", "Optional capability", "Deferred"],
  ["caching and search", "Optional capability", "Deferred"],
  ["data lifecycle", "Core standard", "Planned"],
  ["database operations", "Core standard", "Planned"],
  ["registration", "Core standard", "Planned"],
  ["authentication", "Core standard", "Planned"],
  ["session management", "Core standard", "Planned"],
  ["authorisation", "Core standard", "Planned"],
  ["account management", "Core standard", "Planned"],
  ["team access", "Optional capability", "Deferred"],
  ["age assurance", "Policy assessment", "Deferred"],
  ["identity verification", "Policy assessment", "Deferred"],
  ["application protection", "Core standard", "Planned"],
  ["network and transport", "Core standard", "Planned"],
  ["secrets", "Core standard", "Planned"],
  ["supply-chain security", "Core standard", "Planned"],
  ["abuse controls", "Core standard", "Planned"],
  ["trust assurance", "Core standard", "Planned"],
  ["privacy engineering", "Core standard", "Planned"],
  ["incident response", "Core standard", "Planned"],
  ["privacy and terms", "Policy assessment", "Deferred"],
  ["consumer law", "Policy assessment", "Deferred"],
  ["payment compliance", "Policy assessment", "Deferred"],
  ["age and identity compliance", "Policy assessment", "Deferred"],
  ["accessibility law", "Policy assessment", "Deferred"],
  ["intellectual property", "Policy assessment", "Deferred"],
  ["open-source obligations", "Policy assessment", "Deferred"],
  ["operational records", "Policy assessment", "Deferred"],
  ["regional regulation", "Policy assessment", "Deferred"],
  ["design tokens", "Core standard", "Planned"],
  ["shared primitives", "Core standard", "Planned"],
  ["brandable themes", "Optional capability", "Deferred"],
  ["experience modes", "Optional capability", "Deferred"],
  ["navigation", "Core standard", "Planned"],
  ["information hierarchy", "Core standard", "Planned"],
  ["responsive behaviour", "Core standard", "Planned"],
  ["accessibility", "Core standard", "Planned"],
  ["sensory safety", "Optional capability", "Deferred"],
  ["localisation", "Optional capability", "Deferred"],
  ["interaction states", "Core standard", "Planned"],
  ["usability measurement", "Optional capability", "Deferred"],
  ["landing page", "Optional capability", "Deferred"],
  ["discovery journeys", "Optional capability", "Deferred"],
  ["SEO", "Optional capability", "Deferred"],
  ["conversion", "Optional capability", "Deferred"],
  ["trust signals", "Optional capability", "Deferred"],
  ["content publishing", "Optional capability", "Deferred"],
  ["communication", "Optional capability", "Deferred"],
  ["dashboard", "Optional capability", "Deferred"],
  ["workflows", "Optional capability", "Deferred"],
  ["data management", "Optional capability", "Deferred"],
  ["keyboard efficiency", "Optional capability", "Deferred"],
  ["role-specific views", "Optional capability", "Deferred"],
  ["administration", "Optional capability", "Deferred"],
  ["operational correctness", "Optional capability", "Deferred"],
  ["Realtime systems", "Optional capability", "Deferred"],
  ["payments", "Optional capability", "Deferred"],
  ["billing", "Optional capability", "Deferred"],
  ["file storage", "Optional capability", "Deferred"],
  ["media safety", "Optional capability", "Deferred"],
  ["notifications", "Optional capability", "Deferred"],
  ["jobs and scheduling", "Optional capability", "Deferred"],
  ["search and discovery", "Optional capability", "Deferred"],
  ["collaboration", "Optional capability", "Deferred"],
  ["external APIs", "Optional capability", "Deferred"],
  ["AI integration", "Optional capability", "Deferred"],
  ["build artifacts", "Core standard", "Planned"],
  ["deployment pipelines", "Core standard", "Deferred"],
  ["environment isolation", "Core standard", "Planned"],
  ["hosting", "Core standard", "Deferred"],
  ["application separation", "Core standard", "Planned"],
  ["release management", "Core standard", "Planned"],
  ["resource management", "Core standard", "Planned"],
  ["backup and recovery", "Core standard", "Planned"],
  ["infrastructure as code", "Optional capability", "Deferred"],
  ["developer permissions", "Core standard", "Planned"],
  ["application logs", "Core standard", "Planned"],
  ["monitoring", "Core standard", "Planned"],
  ["tracing", "Core standard", "Planned"],
  ["product analytics", "Optional capability", "Deferred"],
  ["business KPIs", "Optional capability", "Deferred"],
  ["meta-analytics", "Optional capability", "Deferred"],
  ["experimentation", "Optional capability", "Deferred"],
  ["alerting", "Core standard", "Planned"],
];

describe("capability catalogue", () => {
  it("retains all 121 groups with their classification and status", () => {
    const scope = JSON.parse(readFileSync(path.join(root, "framework.scope.json"), "utf8")) as {
      npmScope: string;
    };
    const catalogue = readFileSync(path.join(root, "docs/capability-catalogue.md"), "utf8");
    const blocks = catalogue.split(/^#### /m).slice(1);

    expect(groups).toHaveLength(121);
    expect(blocks).toHaveLength(121);
    expect(blocks.map((block) => block.split("\n")[0]?.trim())).toEqual(groups.map(([name]) => name));

    blocks.forEach((block, index) => {
      const group = groups[index];
      expect(group).toBeDefined();
      if (group === undefined) return;
      const [, classification, status] = group;
      expect(block).toContain(`Classification: ${classification}`);
      expect(block).toContain(`Status: ${status}`);
    });

    expect(catalogue.match(/Status: Implemented/g)).toEqual(["Status: Implemented"]);
    expect(catalogue).toContain(`${scope.npmScope}/app-config`);
    expect(catalogue).toContain(`${scope.npmScope}/dev-tools`);
    expect(catalogue).toContain("App-Template owns the starter landing page");
    expect(catalogue).toContain("App-Template owns hosting");
  });
});
