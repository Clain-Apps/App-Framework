#!/usr/bin/env node
import { runFrameworkCli } from "../framework-cli.js";

try {
  const code = await runFrameworkCli(process.argv.slice(2));
  process.exit(code);
} catch (error) {
  console.error(error instanceof Error ? error.message : "framework failed.");
  process.exit(1);
}
