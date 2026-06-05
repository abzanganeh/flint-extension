# Chrome Web Store Listing Template

> This file is a template only. Do not submit to the Chrome Web Store until
> Phase 2 manual review gate passes (login + Save JD + Open in Flint work
> end-to-end, web-ext lint clean, Playwright smoke green).

---

## Name

Flint — AI Interview Copilot

## Short description (132 chars max)

Capture job descriptions from LinkedIn and Greenhouse and send them to Flint
for AI-powered interview preparation.

## Category

Productivity

## Language

English (United States)

## Detailed description

Flint is a real-time AI co-pilot for job interviews. This extension connects
your browser to the Flint desktop application so you can capture job
descriptions in one click and start a session pre-filled with the role details.

**How it works**
1. Browse to any LinkedIn or Greenhouse job posting.
2. Click the Flint extension icon.
3. Click "Save JD" to save the job description to your Smart Resume account.
4. Click "Open in Flint" to launch Flint desktop pre-filled with the role.

**Requirements**
- A Smart Resume account (free tier available at smartresume.app)
- Flint desktop installed

**Privacy**
- We never capture audio, video, or screen content from your browser.
- Job description text is sent only to Smart Resume's servers (your own account).
- No analytics or third-party trackers are included.
- See our full privacy policy at: https://flint.app/privacy

## Screenshots

> Add 1280×800 or 640×400 screenshots before submission.
> Required: login view, job page with "Save JD" button, "Open in Flint" confirmation.

## Permissions justification

| Permission | Justification |
|---|---|
| `storage` | Store authentication tokens locally so users stay logged in |
| `activeTab` | Read the URL and page content of the active job page |
| `scripting` | Inject the JD extraction script on demand when the popup opens |
| `alarms` | Refresh authentication tokens every 25 minutes in the background |

## Host permissions justification

| Host | Justification |
|---|---|
| `http://localhost:8000/*` | Development: Smart Resume API on localhost |
| `https://www.linkedin.com/jobs/*` | Extract job descriptions from LinkedIn |
| `https://*.greenhouse.io/*` | Extract job descriptions from Greenhouse ATS |
