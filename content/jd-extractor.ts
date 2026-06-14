import type { ExtractedJD, PopupMessage } from "../src/types.js";

const HEURISTIC_MIN_LENGTH = 100;
const EXTRACTION_TIMEOUT_MS = 5000;

interface SiteSelectors {
  matches: string[];
  title: string[];
  company: string[];
  description: string[];
}

interface SelectorsConfig {
  linkedin: SiteSelectors;
  greenhouse: SiteSelectors;
}

function queryFirst(selectors: string[]): string {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) {
        return (el.textContent ?? "").trim();
      }
    } catch {
      // Ignore invalid selectors.
    }
  }
  return "";
}

function extractHeuristic(): string {
  const candidates: Element[] = Array.from(
    document.querySelectorAll("p, div, section, article"),
  );

  let best = "";
  for (const el of candidates) {
    // Skip deeply nested containers that are likely layout wrappers.
    if (el.children.length > 20) continue;
    const text = (el.textContent ?? "").trim();
    if (text.length > best.length && text.length >= HEURISTIC_MIN_LENGTH) {
      best = text;
    }
  }
  return best;
}

function detectSite(config: SelectorsConfig): SiteSelectors | null {
  const host = window.location.hostname;
  for (const site of Object.values(config)) {
    for (const pattern of site.matches) {
      if (host.includes(pattern)) return site;
    }
  }
  return null;
}

function sanitizeText(raw: string): string {
  // Contract: callers MUST pass plain text (typically from element.textContent).
  // This function only normalises whitespace; it does NOT strip HTML. The XSS
  // guarantee comes from never reading innerHTML, never calling this on a
  // raw HTML string. If a future caller passes raw HTML, tags will leak through.
  return raw.replace(/\s+/g, " ").trim();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Extraction timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

async function _extractJDInner(): Promise<ExtractedJD> {
  const configUrl = chrome.runtime.getURL("content/jd-selectors.json");
  const configResponse = await fetch(configUrl);
  const config: SelectorsConfig = await configResponse.json();

  const site = detectSite(config);

  let title = "";
  let company = "";
  let text = "";
  let method: ExtractedJD["extraction_method"] = "heuristic";

  if (site) {
    title = sanitizeText(queryFirst(site.title));
    company = sanitizeText(queryFirst(site.company));
    text = sanitizeText(queryFirst(site.description));
    if (text.length >= HEURISTIC_MIN_LENGTH) {
      method = "structured";
    }
  }

  if (text.length < HEURISTIC_MIN_LENGTH) {
    text = sanitizeText(extractHeuristic());
    method = "heuristic";
  }

  return {
    title: title || document.title,
    company,
    text,
    url: window.location.href,
    extraction_method: method,
  };
}

function extractJD(): Promise<ExtractedJD> {
  return withTimeout(_extractJDInner(), EXTRACTION_TIMEOUT_MS);
}

chrome.runtime.onMessage.addListener(
  (message: PopupMessage, _sender, sendResponse) => {
    if (message.type !== "EXTRACT_JD") return false;

    extractJD()
      .then((jd) => {
        sendResponse({ type: "JD_RESULT", jd } as PopupMessage);
      })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err.message : "Extraction failed";
        sendResponse({ type: "JD_ERROR", error } as PopupMessage);
      });

    // Return true to keep the message channel open for the async response.
    return true;
  },
);
