import type { ConfigIssue } from "./types.js";

export class ConfigError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    super(formatConfigIssues(issues));
    this.name = "ConfigError";
    this.issues = issues;
  }
}

function formatConfigIssues(issues: readonly ConfigIssue[]): string {
  const details = issues.map((issue) => `  - ${issue.key} (${issue.visibility}): ${issue.message}`);
  return `Invalid configuration:\n${details.join("\n")}`;
}
