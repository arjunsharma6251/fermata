// Explicit-event analytics, wrapped so call sites stay one-liners and the
// whole layer is a no-op without NEXT_PUBLIC_POSTHOG_KEY. The launch funnel
// is six events:
//   landing_view          any entry, with entry kind (home / song_link / moment_link)
//   share_card_clicked    inbound via a shared /song/ or /m/ link, with utm_*
//   first_analysis_run    the first analysis this browser ever started
//   analysis_completed    an analysis rendered (cached flag + duration)
//   return_visit          same browser back after 6+ hours
//   share_card_generated  any share artifact made (png / copied link), with kind

import posthog from "posthog-js";

const enabled = () =>
  typeof window !== "undefined" && !!process.env.NEXT_PUBLIC_POSTHOG_KEY;

export function track(event: string, props?: Record<string, unknown>): void {
  try {
    if (process.env.NODE_ENV === "development") {
      console.log("[track]", event, props ?? {});
    }
    if (enabled()) posthog.capture(event, props);
  } catch {
    /* never let analytics break the product */
  }
}

/** utm_* params on the current URL (inbound share attribution). */
export function utmProps(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const out: Record<string, string> = {};
  new URLSearchParams(window.location.search).forEach((v, k) => {
    if (k.startsWith("utm_")) out[k] = v;
  });
  return out;
}

/** Tag an outbound share URL so inbound clicks attribute to the share
 *  surface (utm_medium: moment_link / song_link) — utm_source stays
 *  "fermata_share" so organic search traffic never mixes in. */
export function tagShareUrl(url: string, medium: string): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", "fermata_share");
  u.searchParams.set("utm_medium", medium);
  return u.toString();
}

const FIRST_KEY = "fermata.analytics.first_analysis";
const SEEN_KEY = "fermata.analytics.last_seen";
const RETURN_GAP_MS = 6 * 60 * 60 * 1000;

/** True (and latches) only for the first analysis this browser ever ran. */
export function isFirstAnalysis(): boolean {
  try {
    if (localStorage.getItem(FIRST_KEY)) return false;
    localStorage.setItem(FIRST_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/** Call once per page entry: fires return_visit when this browser was last
 *  seen 6+ hours ago, and stamps the visit either way. */
export function trackVisit(): void {
  try {
    const last = Number(localStorage.getItem(SEEN_KEY) ?? 0);
    const now = Date.now();
    if (last && now - last > RETURN_GAP_MS) {
      track("return_visit", {
        hours_since_last: Math.round((now - last) / 36e5),
      });
    }
    localStorage.setItem(SEEN_KEY, String(now));
  } catch {
    /* private mode etc. */
  }
}
