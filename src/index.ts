#!/usr/bin/env node
import { run } from "./cli/main.js";

run().catch((e) => {
  process.stderr.write(String(e?.stack || e) + "\n");
  process.exit(2);
});
