import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  enumerateDates,
  isRealDate,
  minutesNowIn,
  periodBounds,
  todayIn,
} from "@/domain/date-rules";

describe("isRealDate", () => {
  it("accepts a real calendar date", () => {
    expect(isRealDate("2026-10-13")).toBe(true);
  });

  it("rejects an out-of-range month", () => {
    expect(isRealDate("2026-13-01")).toBe(false);
  });

  it("rejects a day that doesn't exist that month", () => {
    expect(isRealDate("2026-02-30")).toBe(false);
  });

  it("accepts Feb 29 on a leap year and rejects it otherwise", () => {
    expect(isRealDate("2028-02-29")).toBe(true);
    expect(isRealDate("2026-02-29")).toBe(false);
  });

  it("rejects malformed strings", () => {
    expect(isRealDate("10/13/2026")).toBe(false);
    expect(isRealDate("not-a-date")).toBe(false);
  });
});

describe("addDays / daysBetween", () => {
  it("adds and subtracts days within a month", () => {
    expect(addDays("2026-10-13", 1)).toBe("2026-10-14");
    expect(addDays("2026-10-13", -1)).toBe("2026-10-12");
  });

  it("rolls over a month boundary", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("rolls over a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("measures the days between two dates", () => {
    expect(daysBetween("2026-10-01", "2026-10-13")).toBe(12);
    expect(daysBetween("2026-10-13", "2026-10-01")).toBe(-12);
    expect(daysBetween("2026-10-13", "2026-10-13")).toBe(0);
  });
});

describe("enumerateDates", () => {
  it("returns an inclusive list of dates", () => {
    expect(enumerateDates("2026-10-13", "2026-10-15")).toEqual(["2026-10-13", "2026-10-14", "2026-10-15"]);
  });

  it("returns a single date when from equals to", () => {
    expect(enumerateDates("2026-10-13", "2026-10-13")).toEqual(["2026-10-13"]);
  });
});

describe("periodBounds", () => {
  it("day bounds are the same date twice", () => {
    expect(periodBounds("day", "2026-10-13")).toEqual({ from: "2026-10-13", to: "2026-10-13" });
  });

  it("week bounds run Sunday through Saturday", () => {
    // 2026-10-13 is a Tuesday
    expect(periodBounds("week", "2026-10-13")).toEqual({ from: "2026-10-11", to: "2026-10-17" });
  });

  it("month bounds cover the first through the last day, leap year included", () => {
    expect(periodBounds("month", "2026-10-13")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodBounds("month", "2028-02-15")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(periodBounds("month", "2026-02-15")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("todayIn", () => {
  it("formats a fixed instant in a given timezone as YYYY-MM-DD", () => {
    // 2026-10-13T02:30:00Z is still Oct 12 in New York (UTC-4 in October)
    const now = new Date("2026-10-13T02:30:00Z");
    expect(todayIn("America/New_York", now)).toBe("2026-10-12");
    expect(todayIn("UTC", now)).toBe("2026-10-13");
  });
});

describe("minutesNowIn", () => {
  it("converts a fixed instant to minutes-since-midnight in a given timezone", () => {
    const now = new Date("2026-10-13T14:05:00Z"); // 10:05 America/New_York (UTC-4)
    expect(minutesNowIn("America/New_York", now)).toBe(10 * 60 + 5);
    expect(minutesNowIn("UTC", now)).toBe(14 * 60 + 5);
  });
});
