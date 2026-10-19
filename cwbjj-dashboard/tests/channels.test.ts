import { describe, expect, it } from "vitest";
import { channelTotals, classify, type SourceRow } from "../lib/config/channels";

const row = (r: Partial<SourceRow>): SourceRow => ({
  referringDomain: null,
  utmSource: null,
  utmMedium: null,
  inApp: null,
  visits: 1,
  reachedCalendar: 0,
  booked: 0,
  ...r,
});

describe("classify", () => {
  it("groups Instagram's link shim, in-app browser and UTMs together", () => {
    expect(classify(row({ referringDomain: "l.instagram.com" })).channel).toBe("instagram");
    expect(classify(row({ inApp: "instagram" })).channel).toBe("instagram");
    expect(classify(row({ utmSource: "Instagram" })).channel).toBe("instagram");
  });

  it("recognises Facebook", () => {
    expect(classify(row({ referringDomain: "m.facebook.com" })).channel).toBe("facebook");
    expect(classify(row({ inApp: "facebook" })).channel).toBe("facebook");
  });

  it("recognises Google search on any country domain", () => {
    expect(classify(row({ referringDomain: "www.google.co.uk" })).channel).toBe("google");
  });

  it("treats no referrer and self-referrals as direct", () => {
    expect(classify(row({ referringDomain: "$direct" })).channel).toBe("direct");
    expect(classify(row({ referringDomain: "canarywharfbjj.com" })).channel).toBe("direct");
  });

  it("puts everything else in Other", () => {
    expect(classify(row({ referringDomain: "bjjglobetrotters.com" })).channel).toBe("other");
  });

  it("marks paid traffic", () => {
    expect(classify(row({ utmSource: "facebook", utmMedium: "paid" })).paid).toBe(true);
  });
});

describe("channelTotals", () => {
  it("keeps Instagram and Facebook whole when nothing is paid", () => {
    const keys = channelTotals([row({ utmSource: "instagram" }), row({ utmSource: "facebook" })]).map((t) => t.key);
    expect(keys.sort()).toEqual(["facebook", "instagram"]);
  });

  it("splits organic and ads once any traffic is paid", () => {
    const totals = channelTotals([
      row({ utmSource: "instagram", visits: 5 }),
      row({ utmSource: "instagram", utmMedium: "paid", visits: 3 }),
      row({ utmSource: "facebook", visits: 2 }),
    ]);
    const byKey = Object.fromEntries(totals.map((t) => [t.key, t.visits]));
    expect(byKey).toEqual({ "instagram-organic": 5, "instagram-paid": 3, "facebook-organic": 2 });
  });
});
