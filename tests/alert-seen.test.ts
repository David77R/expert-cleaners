import { describe, expect, it } from "vitest";
import { alertKeys, mergeSeen, parseSeen, unseenCount } from "@/domain/alert-seen";

const A = "3f2a9c1e-0000-4000-8000-000000000001";
const B = "7b1d2e3f-0000-4000-8000-000000000002";

describe("alertas vistas", () => {
  const items = [
    { type: "not_confirmed", appointmentIds: [A] },
    { type: "overlap", appointmentIds: [A, B] },
  ];

  it("cuenta todas como nuevas si nunca se vieron", () => {
    expect(unseenCount(items, undefined)).toBe(2);
  });

  it("al verlas el contador queda en cero", () => {
    const seen = mergeSeen("", alertKeys(items));
    expect(unseenCount(items, seen)).toBe(0);
  });

  it("una alerta nueva vuelve a encender el contador", () => {
    const seen = mergeSeen("", alertKeys([items[0]]));
    expect(unseenCount(items, seen)).toBe(1);
  });

  it("ignora basura en la cookie y limita el tamaño", () => {
    expect(parseSeen("hola.<script>.no").size).toBe(0);
    const many = Array.from({ length: 200 }, (_, i) => `no${i.toString(16).padStart(8, "0")}`);
    expect(mergeSeen("", many).split(".")).toHaveLength(150);
  });
});
