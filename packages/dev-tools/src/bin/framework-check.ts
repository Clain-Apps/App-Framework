#!/usr/bin/env node
import { runCli } from "../cli.js";

try {
  const code = await runCli(process.argv.slice(2));
  process.exit(code);
} catch (error) {
  console.error(error instanceof Error ? error.message : "framework-check failed.");
  process.exit(1);
}
