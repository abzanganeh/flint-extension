# ADR-002 — Extension ↔ Desktop IPC Mechanism

**Status:** Accepted  
**Date:** 2026-06-05  
**Deciders:** @abzanganeh  
**Phase:** Strategy B Phase 2

---

## Context

The Flint browser extension (MV3) needs to hand a job description context token to
the Flint desktop application so the user can start a session pre-filled with the
captured JD. Two IPC mechanisms are viable:

### Option A — `flint://` Deep Link (URL scheme)

The extension constructs `flint://import?token=<uuid>` and opens it via
`chrome.tabs.create({ url })`. The OS intercepts the `flint://` scheme and
launches (or focuses) the registered Tauri application, which receives the URL as
a launch argument or via `tauri-plugin-deep-link`.

**Pros**
- Zero extension-to-native-host setup; no manifest registration for each OS.
- Already implemented in Phase 1 (`deep_link.rs`); extension reuses the same
  entry point that the Smart Resume web app uses.
- Works across Chrome, Firefox, and Edge without separate host manifests.
- Token is one-time and expires in 600 s — exposure window is small.

**Cons**
- One-way: desktop cannot reply to the extension.
- Token travels as a URL query parameter, visible in OS process lists and Tauri
  cold-start args. Mitigated: token is an opaque UUID, not payload content.
- Requires Flint to be installed and have registered the `flint://` scheme.
  Missing install → user sees browser "no handler" error. A 3-second fallback
  in the extension popup shows a download prompt.
- Unavailable on Wayland without XDG portal support (same as Phase 1 constraint).

### Option B — Native Messaging

The extension communicates with a native host binary via `chrome.runtime.sendNativeMessage`.
The host proxies calls to Tauri via stdin/stdout.

**Pros**
- Bidirectional: desktop can return acknowledgement or error to extension popup.
- Token never appears in a URL.

**Cons**
- Requires a platform-specific native host manifest installed in a system path
  (`/etc/opt/chrome/…` on Linux, registry key on Windows, `~/Library/…` on macOS).
- Adds a separate versioned native host binary that must be bundled with the
  Tauri installer and kept in sync.
- Non-trivial Chromium extension review risk: native messaging increases attack
  surface scrutiny from the Chrome Web Store.
- Complex to test in CI without a real OS install.

---

## Decision

**Use `flint://` deep link for Phase 2.**

The Phase 1 deep-link infrastructure is already in place. The extension can
reuse the existing single-use token/redeem flow without any Flint desktop changes.
The one-way communication constraint is acceptable for Phase 2 because the only
data flowing is a short-lived token; the desktop redeems it and pre-fills the
session independently.

**Defer native messaging to Phase 4+**, contingent on a user need for
bidirectional feedback (e.g., autofill confirmation or session status reply).
At that point, the native host can be bundled with Phase 1.5 signed installers.

---

## Consequences

- Extension popup opens `flint://import?token=<uuid>` via `chrome.tabs.create`.
- Token value is **never** written to `console`, `chrome.storage`, or any log.
- Extension shows a 3-second fallback UI if Flint is not installed.
- No native messaging host manifest, binary, or installer changes in Phase 2.
- ADR-003 (native messaging) to be written at Phase 4 kickoff.
