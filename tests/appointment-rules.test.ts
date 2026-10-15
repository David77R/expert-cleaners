import { describe, expect, it } from "vitest";
import {
  DomainError,
  assertTransition,
  blocksOverlap,
  canTransition,
  diffFields,
  findConflicts,
  formatMinutes,
  requireReason,
  resolveCancelReason,
  type TimeBlock,
} from "@/domain/appointment-rules";

describe("canTransition / assertTransition", () => {
  it("allows the documented transitions", () => {
    expect(canTransition("not_confirmed", "confirmed")).toBe(true);
    expect(canTransition("not_confirmed", "cancelled")).toBe(true);
    expect(canTransition("confirmed", "rescheduled")).toBe(true);
    expect(canTransition("rescheduled", "confirmed")).toBe(true);
  });

  it("blocks transitions out of terminal states", () => {
    expect(canTransition("completed", "confirmed")).toBe(false);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
  });

  it("blocks transitions the state machine does not list", () => {
    expect(canTransition("completed", "not_confirmed")).toBe(false);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
  });

  it("allows undoing a confirmation", () => {
    expect(canTransition("confirmed", "not_confirmed")).toBe(true);
  });

  it("assertTransition throws a DomainError for an invalid move", () => {
    expect(() => assertTransition("completed", "confirmed")).toThrow(DomainError);
    try {
      assertTransition("cancelled", "completed");
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe("invalid_transition");
    }
  });

  it("assertTransition does not throw for a valid move", () => {
    expect(() => assertTransition("not_confirmed", "completed")).not.toThrow();
  });
});

describe("blocksOverlap", () => {
  it("detects an overlap when ranges intersect", () => {
    expect(blocksOverlap({ startMin: 60, durationMin: 60 }, { startMin: 90, durationMin: 30 })).toBe(true);
  });

  it("does not count back-to-back blocks as overlapping", () => {
    expect(blocksOverlap({ startMin: 60, durationMin: 60 }, { startMin: 120, durationMin: 30 })).toBe(false);
  });

  it("does not count separated blocks as overlapping", () => {
    expect(blocksOverlap({ startMin: 60, durationMin: 30 }, { startMin: 200, durationMin: 30 })).toBe(false);
  });

  it("is symmetric", () => {
    const a = { startMin: 60, durationMin: 60 };
    const b = { startMin: 90, durationMin: 30 };
    expect(blocksOverlap(a, b)).toBe(blocksOverlap(b, a));
  });
});

function block(partial: Partial<TimeBlock> & Pick<TimeBlock, "id">): TimeBlock {
  return {
    technicianId: "tech-1",
    date: "2026-10-13",
    startMin: 540,
    durationMin: 60,
    status: "confirmed",
    ...partial,
  };
}

describe("findConflicts", () => {
  it("never throws: an overlap is surfaced as data, never blocked", () => {
    const candidate = block({ id: "new", startMin: 540, durationMin: 60 });
    const existing = [block({ id: "existing", startMin: 570, durationMin: 60 })];
    expect(() => findConflicts(candidate, existing)).not.toThrow();
    expect(findConflicts(candidate, existing)).toHaveLength(1);
  });

  it("ignores cancelled appointments", () => {
    const candidate = block({ id: "new", startMin: 540, durationMin: 60 });
    const existing = [block({ id: "existing", startMin: 570, durationMin: 60, status: "cancelled" })];
    expect(findConflicts(candidate, existing)).toHaveLength(0);
  });

  it("ignores other technicians and other days", () => {
    const candidate = block({ id: "new", startMin: 540, durationMin: 60 });
    const existing = [
      block({ id: "other-tech", startMin: 540, durationMin: 60, technicianId: "tech-2" }),
      block({ id: "other-day", startMin: 540, durationMin: 60, date: "2026-10-14" }),
    ];
    expect(findConflicts(candidate, existing)).toHaveLength(0);
  });

  it("excludes the candidate's own id (editing in place is not a self-conflict)", () => {
    const candidate = block({ id: "same", startMin: 540, durationMin: 60 });
    const existing = [block({ id: "same", startMin: 540, durationMin: 60 })];
    expect(findConflicts(candidate, existing)).toHaveLength(0);
  });
});

describe("resolveCancelReason", () => {
  it("passes through non-'other' reasons unchanged", () => {
    expect(resolveCancelReason("weather")).toBe("weather");
    expect(resolveCancelReason("duplicate")).toBe("duplicate");
  });

  it("requires an explanation for 'other'", () => {
    expect(() => resolveCancelReason("other")).toThrow(DomainError);
    expect(() => resolveCancelReason("other", "   ")).toThrow(DomainError);
  });

  it("accepts 'other' with a real explanation", () => {
    expect(resolveCancelReason("other", "cliente se mudó")).toBe("other: cliente se mudó");
  });

  it("'other' error carries the explanation_required code", () => {
    try {
      resolveCancelReason("other");
      throw new Error("should have thrown");
    } catch (error) {
      expect((error as DomainError).code).toBe("explanation_required");
    }
  });
});

describe("requireReason", () => {
  it("throws on empty or whitespace-only input", () => {
    expect(() => requireReason(undefined, "reason_required", "falta motivo")).toThrow(DomainError);
    expect(() => requireReason("   ", "reason_required", "falta motivo")).toThrow(DomainError);
  });

  it("returns the trimmed reason otherwise", () => {
    expect(requireReason("  cliente pidió otra fecha  ", "reason_required", "falta motivo")).toBe(
      "cliente pidió otra fecha",
    );
  });
});

describe("diffFields", () => {
  it("only reports fields that actually changed", () => {
    const before = { startMin: 540, durationMin: 60, notes: "igual" };
    const after = { startMin: 600, durationMin: 60, notes: "igual" };
    const changes = diffFields(before, after, { startMin: "Hora", durationMin: "Duración", notes: "Notas" });
    expect(changes).toEqual([{ field: "Hora", from: "540", to: "600" }]);
  });

  it("represents missing values as null, not the string 'undefined'", () => {
    const before = { notes: undefined as string | undefined };
    const after = { notes: "nueva nota" };
    const changes = diffFields(before, after, { notes: "Notas" });
    expect(changes).toEqual([{ field: "Notas", from: null, to: "nueva nota" }]);
  });

  it("returns an empty list when nothing in the tracked fields changed", () => {
    const before = { a: 1, b: 2 };
    const after = { a: 1, b: 2 };
    expect(diffFields(before, after, { a: "A", b: "B" })).toEqual([]);
  });
});

describe("formatMinutes", () => {
  it("formats midnight and noon correctly", () => {
    expect(formatMinutes(0)).toBe("12:00 AM");
    expect(formatMinutes(12 * 60)).toBe("12:00 PM");
  });

  it("formats a standard afternoon time", () => {
    expect(formatMinutes(13 * 60 + 30)).toBe("1:30 PM");
  });

  it("pads single-digit minutes", () => {
    expect(formatMinutes(9 * 60 + 5)).toBe("9:05 AM");
  });
});
