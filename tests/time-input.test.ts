import { describe, expect, it } from "vitest";
import { fromParts, toParts } from "@/components/time-input";

describe("hora en formato AM/PM", () => {
  it("convierte de 24 horas a AM/PM", () => {
    expect(toParts("09:30")).toEqual({ hour: "9", minute: "30", period: "AM" });
    expect(toParts("13:05")).toEqual({ hour: "1", minute: "05", period: "PM" });
    expect(toParts("00:15")).toEqual({ hour: "12", minute: "15", period: "AM" });
    expect(toParts("12:00")).toEqual({ hour: "12", minute: "00", period: "PM" });
    expect(toParts("")).toEqual({ hour: "", minute: "", period: "AM" });
  });

  it("vuelve a 24 horas para guardar", () => {
    expect(fromParts({ hour: "9", minute: "30", period: "AM" })).toBe("09:30");
    expect(fromParts({ hour: "1", minute: "05", period: "PM" })).toBe("13:05");
    expect(fromParts({ hour: "12", minute: "00", period: "AM" })).toBe("00:00");
    expect(fromParts({ hour: "12", minute: "45", period: "PM" })).toBe("12:45");
    expect(fromParts({ hour: "7", minute: "", period: "PM" })).toBe("19:00");
    expect(fromParts({ hour: "", minute: "30", period: "PM" })).toBe("");
  });
});
