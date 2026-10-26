import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { appointmentPhotos, services } from "@/db/schema";
import { AGENT_JOSUE } from "@/db/seed-data";
import { describeChange } from "@/domain/appointment-panel";
import { RVA_COMPANY_ID } from "@/domain/companies";
import {
  createServiceInputFromForm,
  emptyServiceForm,
  serviceFormFromService,
  validateServiceForm,
} from "@/domain/service-form";
import {
  checklistProgress,
  checklistTasks,
  checklistText,
  inspectionSummary,
  parseChecklist,
} from "@/domain/vehicle-care";
import {
  cancelAppointment,
  createAppointment,
  getAppointment,
  saveInspection,
  setChecklistTask,
} from "@/server/appointments";
import { createService } from "@/server/services";
import { uploadPhoto } from "@/server/photos";
import { appointmentInput, createTestDb } from "./helpers";
import { createMemoryStorage, jpeg, png } from "./photo-helpers";

vi.mock("@/server/geocoding", () => ({
  geocodeIfNeeded: async (address: unknown) => address,
  getGeocoder: () => null,
}));

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;
let day = 0;

const ADMIN = { ...AGENT_JOSUE, role: "admin" as const };
const RVA_ADMIN = { ...ADMIN, companyId: RVA_COMPANY_ID };

const CHECKLIST = `# Exterior
- Lavado a mano con shampoo
- Limpieza de rines

# Interior
Aspirado completo
Aspirado completo
Vidrios por dentro`;

beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db
    .update(services)
    .set({ checklist: parseChecklist(CHECKLIST) })
    .where(eq(services.id, ctx.services.sofa.id));
});

afterAll(async () => {
  await ctx.client.close();
});

async function newAppointment() {
  day += 1;
  const { appointment } = await createAppointment(
    ctx.db,
    ADMIN,
    appointmentInput(ctx, { date: `2027-06-${String(day).padStart(2, "0")}` }),
  );
  const detail = await getAppointment(ctx.db, ADMIN.companyId, appointment.id);
  return { id: appointment.id, itemId: detail.items[0].id };
}

describe("checklist del paquete", () => {
  it("lee el texto con grupos, viñetas y sin repetir tareas", () => {
    const groups = parseChecklist(CHECKLIST);
    expect(groups).toEqual([
      { title: "Exterior", items: ["Lavado a mano con shampoo", "Limpieza de rines"] },
      { title: "Interior", items: ["Aspirado completo", "Vidrios por dentro"] },
    ]);
    expect(parseChecklist("Solo una tarea")).toEqual([{ title: "", items: ["Solo una tarea"] }]);
    expect(parseChecklist("# Vacío\n\n")).toEqual([]);
    expect(parseChecklist(checklistText(groups))).toEqual(groups);
    expect(checklistTasks(groups)).toHaveLength(4);
  });

  it("cuenta el avance", () => {
    const groups = parseChecklist(CHECKLIST);
    expect(checklistProgress(groups, {})).toEqual({ total: 4, completed: 0, finished: false });
    const all = Object.fromEntries(checklistTasks(groups).map((task) => [task, { at: "", by: "Ana" }]));
    expect(checklistProgress(groups, all)).toEqual({ total: 4, completed: 4, finished: true });
    expect(checklistProgress([], {})).toEqual({ total: 0, completed: 0, finished: false });
  });

  it("se edita desde el formulario del servicio", () => {
    const values = { ...emptyServiceForm(), name: "Gold", category: "Lavado", price: "280", checklist: CHECKLIST };
    expect(validateServiceForm(values)).toEqual({});
    expect(createServiceInputFromForm(values).checklist).toEqual(parseChecklist(CHECKLIST));
    const tooMany = Array.from({ length: 61 }, (_, index) => `Tarea ${index}`).join("\n");
    expect(validateServiceForm({ ...values, checklist: tooMany }).checklist).toMatch(/60 tareas/);
  });

  it("se guarda con el servicio y se vuelve a mostrar como texto", async () => {
    const created = await createService(ctx.db, ADMIN, {
      name: "Gold",
      category: "Lavado",
      basePriceCents: 28000,
      durationMin: 180,
      checklist: parseChecklist(CHECKLIST),
    });
    expect(serviceFormFromService(created).checklist).toBe(checklistText(parseChecklist(CHECKLIST)));
  });

  it("marca y desmarca tareas guardando quién lo hizo", async () => {
    const { id, itemId } = await newAppointment();
    await setChecklistTask(ctx.db, ADMIN, id, { itemId, task: "Limpieza de rines", done: true });
    let detail = await getAppointment(ctx.db, ADMIN.companyId, id);
    expect(detail.items[0].checklist["Limpieza de rines"]).toMatchObject({ by: ADMIN.name });

    await setChecklistTask(ctx.db, ADMIN, id, { itemId, task: "Limpieza de rines", done: false });
    detail = await getAppointment(ctx.db, ADMIN.companyId, id);
    expect(detail.items[0].checklist).toEqual({});
  });

  it("no acepta tareas que no existen, citas de otra empresa ni citas canceladas", async () => {
    const { id, itemId } = await newAppointment();
    await expect(
      setChecklistTask(ctx.db, ADMIN, id, { itemId, task: "Pulir el motor", done: true }),
    ).rejects.toMatchObject({ code: "task_unknown" });
    await expect(
      setChecklistTask(ctx.db, RVA_ADMIN, id, { itemId, task: "Limpieza de rines", done: true }),
    ).rejects.toMatchObject({ code: "not_found" });
    const other = await newAppointment();
    await expect(
      setChecklistTask(ctx.db, ADMIN, id, { itemId: other.itemId, task: "Limpieza de rines", done: true }),
    ).rejects.toMatchObject({ code: "item_mismatch" });
    await cancelAppointment(ctx.db, ADMIN, id, { reason: "customer_cancelled" });
    await expect(
      setChecklistTask(ctx.db, ADMIN, id, { itemId, task: "Limpieza de rines", done: true }),
    ).rejects.toMatchObject({ code: "cancelled" });
  });
});

describe("inspección del carro", () => {
  it("guarda las marcas de daños y lo deja en el historial", async () => {
    const { id, itemId } = await newAppointment();
    await saveInspection(ctx.db, ADMIN, id, {
      itemId,
      marks: [
        { x: 20, y: 30, kind: "scratch", note: "Puerta del chofer" },
        { x: 80, y: 90, kind: "dent" },
      ],
      notes: "Mucho pelo de perro",
    });
    const detail = await getAppointment(ctx.db, ADMIN.companyId, id);
    expect(detail.items[0].inspection).toMatchObject({
      marks: [
        { x: 20, y: 30, kind: "scratch", note: "Puerta del chofer" },
        { x: 80, y: 90, kind: "dent", note: "" },
      ],
      notes: "Mucho pelo de perro",
      by: ADMIN.name,
    });
    const entry = detail.history.find((row) => row.field === "inspection");
    expect(entry && describeChange(entry)).toBe("Inspección hecha: 2 daños marcados");

    await saveInspection(ctx.db, ADMIN, id, { itemId, marks: [], notes: "" });
    const again = await getAppointment(ctx.db, ADMIN.companyId, id);
    const latest = again.history.filter((row) => row.field === "inspection")[0];
    expect(describeChange(latest)).toBe("Inspección actualizada: sin daños marcados");
  });

  it("rechaza marcas fuera del dibujo o de tipo desconocido", async () => {
    const { id, itemId } = await newAppointment();
    await expect(
      saveInspection(ctx.db, ADMIN, id, { itemId, marks: [{ x: 120, y: 10, kind: "scratch" }] }),
    ).rejects.toThrow();
    await expect(
      saveInspection(ctx.db, ADMIN, id, { itemId, marks: [{ x: 10, y: 10, kind: "fire" }] }),
    ).rejects.toThrow();
  });

  it("cada ángulo tiene una sola foto: la nueva reemplaza a la anterior", async () => {
    const storage = createMemoryStorage();
    const { id, itemId } = await newAppointment();
    const first = await uploadPhoto(ctx.db, storage, ADMIN, id, jpeg(), itemId, "front");
    const second = await uploadPhoto(ctx.db, storage, ADMIN, id, png(), itemId, "front");
    await uploadPhoto(ctx.db, storage, ADMIN, id, jpeg(), itemId, "left");
    const rows = await ctx.db.select().from(appointmentPhotos).where(eq(appointmentPhotos.appointmentId, id));
    expect(rows.map((row) => row.label).sort()).toEqual(["front", "left"]);
    expect(rows.find((row) => row.label === "front")?.id).toBe(second.id);
    expect(second.label).toBe("front");
    expect(storage.files.has(`appointments/${id}/${first.id}.jpg`)).toBe(false);

    await expect(uploadPhoto(ctx.db, storage, ADMIN, id, jpeg(), itemId, "techo")).rejects.toMatchObject({
      code: "invalid_label",
    });
    await expect(uploadPhoto(ctx.db, storage, ADMIN, id, jpeg(), null, "front")).rejects.toMatchObject({
      code: "invalid_label",
    });

    expect(inspectionSummary(null, ["front", "left", "otra"])).toEqual({
      done: false,
      marks: 0,
      photos: 2,
      totalPhotos: 6,
    });
  });
});
