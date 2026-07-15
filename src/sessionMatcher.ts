import type { TailoredSessionOption } from "./autofillApi.js";

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

export function matchTailoredSessions(
  sessions: TailoredSessionOption[],
  hostname: string,
  companyHint = "",
): TailoredSessionOption[] {
  const host = hostname.toLowerCase();
  const hint = normalizeToken(companyHint);

  const scored = sessions
    .map((session) => {
      let score = 0;
      if (session.url_host && host === session.url_host.toLowerCase()) score += 3;
      if (session.url_host && host.endsWith(session.url_host.toLowerCase())) score += 2;
      if (hint && normalizeToken(session.company).includes(hint)) score += 2;
      if (hint && hint.includes(normalizeToken(session.company))) score += 1;
      return { session, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];
  const topScore = scored[0]?.score ?? 0;
  return scored.filter((entry) => entry.score === topScore).map((entry) => entry.session);
}

export function pickSessionMatch(
  sessions: TailoredSessionOption[],
  hostname: string,
  companyHint = "",
): { kind: "single"; session: TailoredSessionOption } | { kind: "picker"; sessions: TailoredSessionOption[] } | { kind: "none" } {
  const matches = matchTailoredSessions(sessions, hostname, companyHint);
  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) return { kind: "single", session: matches[0]! };
  return { kind: "picker", sessions: matches };
}
