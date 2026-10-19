/*
  PostHog settings, shared with the Framer site snippet so the site and this form
  report into one project.

  The project API key (starts "phc_") is safe to publish: it can only send events.
  Find it in PostHog under Project settings > General > Project API key.
  Leave it empty and the form sends nothing.
*/
export const analytics = {
  projectKey: "",
  apiHost: "https://eu.i.posthog.com",
};

/* Marketing parameters copied from the Framer page onto every event and onto the GHL calendar. */
export const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
