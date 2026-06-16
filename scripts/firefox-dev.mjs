#!/usr/bin/env node
/**
 * Helper that runs `web-ext run` for Firefox with the correct binary and
 * profile path, handling both snap and non-snap Firefox installations.
 *
 * Snap Firefox cannot write profiles outside ~/snap/firefox/common/ and needs
 * to be launched through `snap run firefox` (the wrapper in scripts/firefox-snap.sh)
 * rather than the raw binary at /snap/firefox/current/.../firefox, which
 * bypasses the snap runtime and fails with CLONE_NEWPID EPERM.
 */
import { execSync, spawn } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const webExtBin = resolve(projectRoot, "node_modules", ".bin", "web-ext");
const profilePath = `${homedir()}/snap/firefox/common/.mozilla/firefox/flint-web-ext`;

function isSnapFirefox() {
  if (existsSync("/snap/bin/firefox")) return true;
  try {
    const which = execSync("command -v firefox 2>/dev/null", { encoding: "utf8" }).trim();
    return which.includes("/snap/");
  } catch {
    return false;
  }
}

const extraArgs = process.argv.slice(2);

const args = ["run", "--source-dir=dist", ...extraArgs];

if (isSnapFirefox()) {
  const wrapper = resolve(__dirname, "firefox-snap.sh");
  if (!existsSync(wrapper)) {
    console.error(`Missing snap wrapper: ${wrapper}`);
    process.exit(1);
  }
  const profile = `${homedir()}/snap/firefox/common/.mozilla/firefox/flint-web-ext`;
  args.push(
    `--firefox=${wrapper}`,
    `--firefox-profile=${profile}`,
    "--profile-create-if-missing",
    "--keep-profile-changes",
  );
}

if (!existsSync(webExtBin)) {
  console.error("web-ext not found — run npm install in flint-extension first.");
  process.exit(1);
}

console.log(`web-ext ${args.join(" ")}`);

// detached:true puts web-ext (+ Firefox) in its own process group on Unix so
// Ctrl+C can terminate the whole tree, not just this Node wrapper.
const child = spawn(webExtBin, args, {
  stdio: "inherit",
  cwd: projectRoot,
  detached: process.platform !== "win32",
});

let shuttingDown = false;

function killProcessTree(signal) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    child.kill(signal);
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

/**
 * snap-confine isolates Firefox in its own process group, so killing web-ext's
 * group never reaches Firefox. As a fallback, pkill any Firefox process that
 * mounted our dev profile path. Profile paths are unique per session so this
 * cannot affect a normal Firefox window the user has open.
 */
function killFirefoxByProfile() {
  if (process.platform === "win32") return;
  try {
    execSync(`pkill -TERM -f "${profilePath}"`, { stdio: "ignore" });
  } catch {
    // pkill returns non-zero when no process matched — not an error.
  }
}

function shutdown(signal) {
  if (shuttingDown) {
    killProcessTree("SIGKILL");
    killFirefoxByProfile();
    process.exit(1);
    return;
  }
  shuttingDown = true;
  killProcessTree(signal);
  killFirefoxByProfile();
  setTimeout(() => {
    killProcessTree("SIGKILL");
    try {
      execSync(`pkill -KILL -f "${profilePath}"`, { stdio: "ignore" });
    } catch {
      // Best-effort.
    }
    process.exit(0);
  }, 2000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code, sig) => {
  if (shuttingDown) {
    process.exit(0);
    return;
  }
  if (sig === "SIGINT" || sig === "SIGTERM") {
    process.exit(0);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  console.error(err.message);
  process.exit(1);
});
