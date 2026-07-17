#!/usr/bin/env node
/**
 * Patch dist/manifest.json for Firefox MV3 (background.scripts required).
 * Chrome must not load this patched manifest — use `npm run build` for Chrome.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve(process.cwd(), "dist/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

manifest.background ??= {};
manifest.background.service_worker ??= "background/service-worker.js";
manifest.background.type ??= "module";
manifest.background.scripts ??= [manifest.background.service_worker];

// Firefox has no chrome.action.onClicked-driven floating panel injection
// path yet (out of scope for this milestone) — keep the classic popup so
// the toolbar icon still opens something on click.
manifest.action ??= {};
manifest.action.default_popup ??= "popup/index.html";

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log("Patched dist/manifest.json for Firefox (background.scripts, default_popup)");
