import { describe, expect, it } from "vitest";
import { filterForSummaryKey, matchesStatusFilter, parseStatusFilter } from "@/domain/status-filter";

describe("filtro por estado del resumen", () => {
  const overlap = new Set(["b"]);

  it("reconoce solo filtros válidos", () => {
    expect(parseStatusFilter("por-confirmar")).toBe("por-confirmar");
    expect(parseStatusFilter("cualquiera")).toBeNull();
    expect(parseStatusFilter(undefined)).toBeNull();
    expect(filterForSummaryKey("overlaps")).toBe("conflicto");
  });

  it("filtra por estado y por conflicto", () => {
    expect(matchesStatusFilter({ id: "a", status: "not_confirmed" }, "por-confirmar", overlap)).toBe(true);
    expect(matchesStatusFilter({ id: "a", status: "confirmed" }, "por-confirmar", overlap)).toBe(false);
    expect(matchesStatusFilter({ id: "b", status: "confirmed" }, "conflicto", overlap)).toBe(true);
    expect(matchesStatusFilter({ id: "b", status: "cancelled" }, "conflicto", overlap)).toBe(false);
    expect(matchesStatusFilter({ id: "c", status: "cancelled" }, null, overlap)).toBe(true);
  });
});
