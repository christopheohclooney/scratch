import posthog from "posthog-js/dist/module.slim";
import { analytics, utmKeys } from "./config/analytics";

/*
  Cookieless tracking. PostHog keeps its IDs in page memory only, so nothing is
  stored on the visitor's device. The Framer snippet passes the visitor's PostHog
  IDs in the iframe URL (ph_did, ph_sid); bootstrapping with them makes the Framer
  visit and this form one person and one session in PostHog.
*/
const params = new URLSearchParams(location.search);

export const utms: Record<string, string> = {};
for (const key of utmKeys) {
  const value = params.get(key);
  if (value) utms[key] = value;
}

export const debug = params.has("debug");

const enabled = analytics.projectKey !== "";

if (enabled) {
  const distinctID = params.get("ph_did") ?? undefined;
  const sessionID = params.get("ph_sid") ?? undefined;
  posthog.init(analytics.projectKey, {
    api_host: analytics.apiHost,
    persistence: "memory",
    person_profiles: "never",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    bootstrap: distinctID ? { distinctID, sessionID } : undefined,
  });
  /* Every event carries the UTMs, so channels can be read from form events alone. */
  posthog.register(utms);
}

export function track(event: string, props: Record<string, string> = {}) {
  if (debug) console.info("[cwbjj] track", event, props);
  if (enabled) posthog.capture(event, props);
}
