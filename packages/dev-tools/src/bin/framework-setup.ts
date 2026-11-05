#!/usr/bin/env node
import { runSetupCli } from "../setup-cli.js";

try {
  process.exit(runSetupCli(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : "framework-setup failed.");
  process.exit(1);
}
