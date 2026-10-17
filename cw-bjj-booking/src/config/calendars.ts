/*
  The seven GHL booking calendars, one per programme.

  To update a calendar, change its embedUrl. The slug is what class pages use to
  deep link (?programme=gi). The label is what people see. The GHL URL slugs do
  not match the labels (for example "kids-4-6yrs" is the Kids 4 to 5 calendar),
  so never show the URL in the UI.
*/

export type Group = "adult" | "child";

export interface Calendar {
  slug: string;
  label: string;
  group: Group;
  embedUrl: string;
}

export const calendars: Calendar[] = [
  {
    slug: "adult-beginners",
    label: "Adult Beginners",
    group: "adult",
    embedUrl: "https://api.leadconnectorhq.com/widget/bookings/adults-beginners-1",
  },
  {
    slug: "gi",
    label: "Gi",
    group: "adult",
    embedUrl: "https://api.leadconnectorhq.com/widget/bookings/adults-intermediary",
  },
  {
    slug: "no-gi",
    label: "No-Gi",
    group: "adult",
    embedUrl: "https://api.leadconnectorhq.com/widget/bookings/adults-no-gi-intermediary",
  },
  {
    slug: "adult-striking",
    label: "Adult Striking",
    group: "adult",
    embedUrl: "https://api.leadconnectorhq.com/widget/bookings/adults-striking-1",
  },
  {
    slug: "kids-4-5",
    label: "Kids 4 to 5",
    group: "child",
    embedUrl: "https://api.leadconnectorhq.com/widget/bookings/kids-4-6yrs",
  },
  {
    slug: "kids-6-11",
    label: "Kids 6 to 11",
    group: "child",
    embedUrl: "https://api.leadconnectorhq.com/widget/bookings/kids-7",
  },
  {
    slug: "teens-12-15",
    label: "Teens 12 to 15",
    group: "child",
    embedUrl: "https://api.leadconnectorhq.com/widget/bookings/teens-12yrs-15yrs",
  },
];

/* GHL's script that auto-resizes booking widget iframes. Loaded once. */
export const ghlEmbedScript = "https://link.msgsndr.com/js/form_embed.js";

export const findCalendar = (slug: string | null): Calendar | undefined =>
  calendars.find((c) => c.slug === slug);
