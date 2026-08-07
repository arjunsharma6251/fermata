// Client analytics bootstrap (Next instrumentation-client convention —
// runs once, before the app becomes interactive). PostHog only initializes
// when NEXT_PUBLIC_POSTHOG_KEY is set, so local dev and previews without
// the key are true no-ops.

import posthog from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

try {
  if (KEY) {
    posthog.init(KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      defaults: "2025-05-24",
      capture_pageview: true, // pageviews + UTM capture come free
      capture_pageleave: true,
      autocapture: false, // we track the funnel with explicit events only
    });
  }
} catch {
  /* analytics must never take the app down */
}
