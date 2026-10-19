/*
  Everything specific to the Canary Wharf BJJ site lives here.
  Calendar slugs and labels match cw-bjj-booking/src/config/calendars.ts.
*/

/* The site's own domain, so internal links aren't counted as a referral. */
export const siteDomain = "canarywharfbjj.com";

/* Friendly names for the Top pages table. Paths not listed show as the raw path. */
export const pageNames: Record<string, string> = {
  "/": "Home",
  "/about": "About",
  "/classes": "Classes",
  "/classes/gi": "Gi",
  "/classes/no-gi": "No Gi",
  "/classes/kids-teens": "Kids & Teens",
  "/classes/beginners": "Beginners",
  "/classes/striking": "MMA & Striking",
  "/schedule": "Schedule",
  "/membership": "Membership",
  "/support": "Support",
  "/book": "Book a trial",
};

export const normalisePath = (path: string) => {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "");
  return clean === "" ? "/" : clean.toLowerCase();
};

export const pageName = (path: string) => pageNames[normalisePath(path)] ?? normalisePath(path);

export interface Calendar {
  slug: string;
  label: string;
  /* The GHL booking widget slug, from the calendar's embed URL. Used to find its calendar ID. */
  ghlWidgetSlug: string;
}

export const calendars: Calendar[] = [
  { slug: "adult-beginners", label: "Beginners", ghlWidgetSlug: "adults-beginners-1" },
  { slug: "gi", label: "Gi", ghlWidgetSlug: "adults-intermediary" },
  { slug: "no-gi", label: "No-Gi", ghlWidgetSlug: "adults-no-gi-intermediary" },
  { slug: "adult-striking", label: "Striking", ghlWidgetSlug: "adults-striking-1" },
  { slug: "kids-4-5", label: "Kids 4 to 5", ghlWidgetSlug: "kids-4-6yrs" },
  { slug: "kids-6-11", label: "Kids 6 to 11", ghlWidgetSlug: "kids-7" },
  { slug: "teens-12-15", label: "Teens 12 to 15", ghlWidgetSlug: "teens-12yrs-15yrs" },
];

/*
  Class pages and the calendars they lead to, for "Programme journeys".
  `key` matches the programme sent with cta_clicked by the Framer snippet.
*/
export interface Programme {
  key: string;
  label: string;
  classPage: string;
  calendars: string[];
}

export const programmes: Programme[] = [
  { key: "beginners", label: "Beginners", classPage: "/classes/beginners", calendars: ["adult-beginners"] },
  { key: "gi", label: "Gi", classPage: "/classes/gi", calendars: ["gi"] },
  { key: "no-gi", label: "No-Gi", classPage: "/classes/no-gi", calendars: ["no-gi"] },
  { key: "striking", label: "Striking", classPage: "/classes/striking", calendars: ["adult-striking"] },
  {
    key: "kids-teens",
    label: "Kids & Teens",
    classPage: "/classes/kids-teens",
    calendars: ["kids-4-5", "kids-6-11", "teens-12-15"],
  },
];
