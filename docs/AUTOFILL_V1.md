# Autofill v1 — Detect, confidence-scored fill, multi-step continuation

> **Status:** Greenhouse beta shipped on branch `feature/autofill-v1-full` (overlay + continuation + popup probe). LinkedIn deferred (slice 12 gate).  
> **Strategy B:** §4 · **Manual gate passed for Greenhouse fixtures;** live Greenhouse retest still recommended before store release.

## Goals

1. Map Smart Resume tailored resume fields → ATS application forms (Greenhouse, LinkedIn Easy Apply).
2. Keep selectors **data-only** (`content/autofill/selectors.json`) so DOM churn does not require code deploys.
3. Weekly regression CI against snapshot HTML fixtures (when fixtures exist).

## Module layout

```
content/autofill/
  selectors.json    Host patterns + field maps (stub)
  types.ts          AutofillPayload, FillResult
  greenhouse.ts     fillGreenhouse() — stub returns empty FillResult
  linkedin.ts       fillLinkedIn() — stub returns empty FillResult
src/autofillApi.ts  GET /api/job-descriptions/{id}/autofill-payload client
background/         FETCH_AUTOFILL_PAYLOAD message handler
popup/              Disabled "Autofill (beta)" button
```

## Selector maintenance policy

- One JSON entry per ATS target; version field bumped on breaking selector changes.
- Never hardcode CSS classes in TypeScript — only read from `selectors.json`.
- LinkedIn/Greenhouse class rotation: update JSON + fixture snapshot, run weekly workflow.
- Do **not** add broad `host_permissions` until a platform passes manual validation.

## API contract (Smart Resume)

```
GET /api/job-descriptions/{id}/autofill-payload
Authorization: Bearer {sr_jwt}
→ { jd_id, platform, fields: [{ selector, value, label? }] }
```

Scaffold: endpoint may 404 until Smart Resume implements payload generation.

## FillResult semantics

| Field | Meaning |
|-------|---------|
| `fields_attempted` | Selectors tried |
| `fields_filled` | Successfully written |
| `fields_failed` | Selector keys that failed |

Scaffold stubs return zeros — no DOM access.

## Security

- No autofill without authenticated SR session.
- Payload values are user resume data only — never execute page scripts from payload.
- Content script injection limited to validated job-application hosts (future).

## Next steps (post-scaffold)

1. User provides Greenhouse + LinkedIn test job URLs / accounts.
2. Capture HTML fixtures → `.github/workflows/autofill-regression.yml` runs diff.
3. Implement real `fillGreenhouse` / `fillLinkedIn` with ≥90% field fill target.
4. Enable popup button behind feature flag.
