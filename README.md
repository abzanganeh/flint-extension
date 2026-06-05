# Flint Browser Extension

Chrome MV3 extension (Firefox-compatible) that captures job descriptions from
LinkedIn and Greenhouse and opens them in Flint desktop with one click.

## Phase 2 scope

- Email/password login against Smart Resume API
- JD extraction from LinkedIn and Greenhouse job pages
- Save JD to Smart Resume (`POST /api/job-descriptions`)
- Open in Flint via `flint://import?token=` deep link

Not in Phase 2: autofill, Supabase SSO, bidirectional IPC.

## Requirements

- Node.js >= 18
- Flint desktop installed and `flint://` scheme registered
- Smart Resume API running at `http://localhost:8000` (or configure via `.env`)

## Setup

```bash
cp .env.example .env
npm install
npm run build
```

Load `dist/` as an unpacked extension in `chrome://extensions/` (Developer mode on).

## Development

```bash
npm run dev        # watch mode
npm test           # vitest unit tests
npm run lint:ext   # web-ext lint against dist/
```

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Smart Resume API base URL |

## Security notes

- Tokens are stored in `chrome.storage.local` (not `sessionStorage` or cookies).
- Token value is never written to `console.*` or any log.
- JD text is sent only via `Bearer` header to the API, never embedded in URLs.
- The `flint://` URL carries only an opaque single-use token (UUID), not payload content.
- No `eval`, no `innerHTML` assignment anywhere in the extension.

## Permissions justification

| Permission | Reason |
|---|---|
| `storage` | Persist auth tokens across SW restarts |
| `activeTab` | Read current tab URL and inject content script on demand |
| `scripting` | Inject content script when popup opens on a job page |
| `alarms` | Schedule token refresh every 25 minutes |

## Architecture (Phase 2 IPC)

See [ADR-002](docs/adr/002-extension-desktop-ipc.md) — `flint://` deep link
selected over native messaging; native messaging deferred to Phase 4+.
