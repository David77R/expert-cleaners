import { describe, expect, it } from "vitest";
import { readAgentForm, validateAgentForm, withoutPassword } from "@/domain/agent-form";

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("formulario de agentes", () => {
  it("normaliza el correo y lee el acceso", () => {
    const values = readAgentForm(
      formData({ name: " Laura ", email: " Laura@Expert.COM ", password: "x", active: "on" }),
    );
    expect(values).toEqual({ name: "Laura", email: "laura@expert.com", password: "x", active: true });
  });

  it("al crear exige contraseña de al menos 8 caracteres", () => {
    const base = { name: "Laura", email: "laura@expert.com", active: true };
    expect(validateAgentForm({ ...base, password: "" }, { passwordRequired: true }).password).toBeDefined();
    expect(validateAgentForm({ ...base, password: "corta" }, { passwordRequired: true }).password).toBeDefined();
    expect(validateAgentForm({ ...base, password: "larga-123" }, { passwordRequired: true })).toEqual({});
  });

  it("al editar la contraseña es opcional", () => {
    expect(
      validateAgentForm(
        { name: "Laura", email: "laura@expert.com", password: "", active: true },
        { passwordRequired: false },
      ),
    ).toEqual({});
  });

  it("marca nombre vacío y correo inválido", () => {
    const errors = validateAgentForm(
      { name: "", email: "no-es-correo", password: "", active: true },
      { passwordRequired: false },
    );
    expect(Object.keys(errors).sort()).toEqual(["email", "name"]);
  });

  it("nunca devuelve la contraseña al formulario", () => {
    expect(withoutPassword({ name: "a", email: "b", password: "secreta", active: true }).password).toBe("");
  });
});
