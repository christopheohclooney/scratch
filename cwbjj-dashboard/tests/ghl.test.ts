import { describe, expect, it } from "vitest";
import { countBookings } from "../lib/sources/ghl";

const periods = {
  current: { from: "2026-10-12", to: "2026-10-18" },
  previous: { from: "2026-10-05", to: "2026-10-11" },
};

describe("countBookings", () => {
  it("counts by booking date and skips cancelled appointments, keeping no-shows", () => {
    const data = countBookings(
      [
        { slug: "gi", status: "confirmed", bookedOn: "2026-10-12" },
        { slug: "gi", status: "noshow", bookedOn: "2026-10-13" },
        { slug: "gi", status: "cancelled", bookedOn: "2026-10-14" },
        { slug: "kids-6-11", status: "showed", bookedOn: "2026-10-08" },
        { slug: "kids-6-11", status: "confirmed", bookedOn: "2026-09-01" },
      ],
      periods,
    );
    expect(data).toEqual({ current: 2, previous: 1, byCalendar: { gi: 2 } });
  });
});
