import { calendars } from "../config/site";
import { addDays, londonDate } from "../period";
import type { GhlData, Periods } from "../types";

/*
  Trial bookings from GoHighLevel (API v2), using a Private Integration token for
  João's sub-account with the "View Calendars" and "View Calendar Events" scopes.

  To check against the live API once the token exists:
  - GET /calendars/?locationId=… lists calendars; each has the widgetSlug from its booking URL
  - GET /calendars/events?locationId&calendarId&startTime&endTime lists appointments,
    filtered by appointment time, not by when they were booked
*/

const API = "https://services.leadconnectorhq.com";
const VERSION = "2021-04-15";

/* Appointments that count as a trial booking. No-shows did book and pay, so they count. */
const excludedStatuses = new Set(["cancelled", "canceled", "invalid"]);

/* Bookings can be for a class weeks ahead, so look this far past the period for appointments. */
const LOOKAHEAD_DAYS = 90;

export const ghlConfigured = () => Boolean(process.env.GHL_TOKEN && process.env.GHL_LOCATION_ID);

async function ghl<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(path, API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.GHL_TOKEN}`, Version: VERSION, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GoHighLevel returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

interface GhlCalendar {
  id: string;
  widgetSlug?: string;
}

interface GhlEvent {
  appointmentStatus?: string;
  dateAdded?: string;
}

export interface Appointment {
  slug: string;
  status: string;
  bookedOn: string;
}

/* Counts bookings made in each period (by booking date, London time). */
export function countBookings(appointments: Appointment[], p: Periods): GhlData {
  const data: GhlData = { current: 0, previous: 0, byCalendar: {} };
  for (const a of appointments) {
    if (excludedStatuses.has(a.status.toLowerCase())) continue;
    if (a.bookedOn >= p.current.from && a.bookedOn <= p.current.to) {
      data.current += 1;
      data.byCalendar[a.slug] = (data.byCalendar[a.slug] ?? 0) + 1;
    } else if (a.bookedOn >= p.previous.from && a.bookedOn <= p.previous.to) {
      data.previous += 1;
    }
  }
  return data;
}

export async function fetchGhl(p: Periods): Promise<GhlData> {
  const locationId = process.env.GHL_LOCATION_ID!;
  const { calendars: ghlCalendars } = await ghl<{ calendars: GhlCalendar[] }>("/calendars/", { locationId });

  const start = Date.parse(`${p.previous.from}T00:00:00Z`) - 86_400_000;
  const end = Date.parse(`${addDays(p.current.to, LOOKAHEAD_DAYS)}T23:59:59Z`);

  const perCalendar = await Promise.all(
    calendars.map(async (c) => {
      const match = ghlCalendars.find((g) => g.widgetSlug === c.ghlWidgetSlug);
      if (!match) throw new Error(`No GoHighLevel calendar with booking link "${c.ghlWidgetSlug}" (${c.label})`);
      const { events } = await ghl<{ events: GhlEvent[] }>("/calendars/events", {
        locationId,
        calendarId: match.id,
        startTime: String(start),
        endTime: String(end),
      });
      return events
        .filter((e) => e.dateAdded)
        .map((e) => ({ slug: c.slug, status: e.appointmentStatus ?? "", bookedOn: londonDate(new Date(e.dateAdded!)) }));
    }),
  );

  return countBookings(perCalendar.flat(), p);
}
