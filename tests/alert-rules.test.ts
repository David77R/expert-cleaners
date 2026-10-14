import { describe, expect, it } from "vitest";
import { buildAlerts } from "@/domain/alert-rules";

describe("buildAlerts", () => {
  it("returns nothing when there is nothing to flag", () => {
    expect(buildAlerts({ dayAppointments: [], overlapIds: [], unpaidCompletedIds: [] })).toEqual([]);
  });

  it("groups not_confirmed appointments as a warning", () => {
    const result = buildAlerts({
      dayAppointments: [
        { id: "a", status: "not_confirmed" },
        { id: "b", status: "confirmed" },
      ],
      overlapIds: [],
      unpaidCompletedIds: [],
    });
    expect(result).toEqual([{ type: "not_confirmed", level: "warning", count: 1, appointmentIds: ["a"] }]);
  });

  it("groups overlaps as an attention-level alert", () => {
    const result = buildAlerts({
      dayAppointments: [
        { id: "a", status: "confirmed" },
        { id: "b", status: "confirmed" },
      ],
      overlapIds: ["a", "b"],
      unpaidCompletedIds: [],
    });
    expect(result).toEqual([{ type: "overlap", level: "attention", count: 2, appointmentIds: ["a", "b"] }]);
  });

  it("only counts overlap ids that are actually in today's appointments", () => {
    const result = buildAlerts({
      dayAppointments: [{ id: "a", status: "confirmed" }],
      overlapIds: ["a", "stale-id-from-another-day"],
      unpaidCompletedIds: [],
    });
    expect(result).toEqual([{ type: "overlap", level: "attention", count: 1, appointmentIds: ["a"] }]);
  });

  it("completed_unpaid comes straight from its own id list, independent of status", () => {
    const result = buildAlerts({
      dayAppointments: [],
      overlapIds: [],
      unpaidCompletedIds: ["x", "y"],
    });
    expect(result).toEqual([{ type: "completed_unpaid", level: "attention", count: 2, appointmentIds: ["x", "y"] }]);
  });

  it("groups rescheduled appointments as info", () => {
    const result = buildAlerts({
      dayAppointments: [{ id: "a", status: "rescheduled" }],
      overlapIds: [],
      unpaidCompletedIds: [],
    });
    expect(result).toEqual([{ type: "rescheduled", level: "info", count: 1, appointmentIds: ["a"] }]);
  });

  it("can report every type at once, each independently", () => {
    const result = buildAlerts({
      dayAppointments: [
        { id: "a", status: "not_confirmed" },
        { id: "b", status: "confirmed" },
        { id: "c", status: "rescheduled" },
      ],
      overlapIds: ["b"],
      unpaidCompletedIds: ["z"],
    });
    expect(result.map((item) => item.type)).toEqual(["not_confirmed", "overlap", "completed_unpaid", "rescheduled"]);
  });

  it("never auto-resolves anything: cancelled appointments are simply absent from the input, not filtered here", () => {
    // buildAlerts trusts its caller for status filtering; this test documents that contract
    // so a future caller change doesn't silently start flagging cancelled appointments.
    const result = buildAlerts({
      dayAppointments: [{ id: "a", status: "cancelled" }],
      overlapIds: [],
      unpaidCompletedIds: [],
    });
    expect(result).toEqual([]);
  });
});
