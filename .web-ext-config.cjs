/** @type {import('web-ext').MultiExtensionRunnerOptions} */
const { homedir } = require("os");
const { execSync } = require("child_process");
const { existsSync } = require("fs");

function isSnapFirefox() {
  // /usr/bin/firefox is often a shell-script stub (not a symlink) that delegates
  // to the snap binary. readlink -f therefore returns the stub path itself, which
  // does not contain "/snap/". Check for the snap binary directly instead.
  try {
    if (existsSync("/snap/bin/firefox")) return true;
    const which = execSync("command -v firefox 2>/dev/null", { encoding: "utf8" }).trim();
    return which.includes("/snap/");
  } catch {
    return false;
  }
}

function snapFirefoxBinary() {
  // Use the project-local wrapper which calls `snap run firefox "$@"`.
  // This gives Firefox the correct snap runtime environment so the
  // -start-debugger-server handshake works. The raw snap binary path
  // (/snap/firefox/current/...) bypasses the snap sandbox and fails
  // with CLONE_NEWPID EPERM on systems that restrict user namespaces.
  const wrapper = `${__dirname}/scripts/firefox-snap.sh`;
  if (existsSync(wrapper)) return wrapper;
  // Fallback to the /usr/bin stub if wrapper is missing.
  return "/usr/bin/firefox";
}

const config = {
  sourceDir: "dist",
};

// Note: --firefox and --firefox-profile are sub-command options that web-ext
// does not accept at the top-level config. Those are set via CLI flags in the
// firefox:dev package.json script so they bypass config-file validation.
// This file only carries options that are valid at the global config level.

module.exports = config;
