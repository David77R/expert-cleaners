import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { appointmentItems, appointmentPhotos } from "@/db/schema";
import { AGENT_JOSUE, AGENT_JUANCHO } from "@/db/seed-data";
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_APPOINTMENT, detectPhotoType, photoStoragePath } from "@/domain/photo-rules";
import { createAppointment, getAppointment } from "@/server/appointments";
import { runAction } from "@/server/actions";
import { deletePhoto, listPhotos, panelPhotos, uploadPhoto } from "@/server/photos";
import { createSupabasePhotoStorage } from "@/server/storage";
import { readPhotoUpload, readPhotoUploadForm } from "@/server/uploads";
import { appointmentInput, createTestDb } from "./helpers";
import { createMemoryStorage, jpeg, png, textFile, webp } from "./photo-helpers";

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;
let dayCounter = 0;

const ADMIN = { id: AGENT_JOSUE.id, name: "Admin", role: "admin" as const };

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.client.close();
});

async function newAppointment() {
  dayCounter += 1;
  const date = `2027-05-${String(dayCounter).padStart(2, "0")}`;
  const { appointment } = await createAppointment(ctx.db, AGENT_JOSUE, appointmentInput(ctx, { date }));
  return appointment;
}

describe("reglas de fotos", () => {
  it("detecta el tipo real por la firma del archivo", () => {
    expect(detectPhotoType(jpeg())).toBe("image/jpeg");
    expect(detectPhotoType(png())).toBe("image/png");
    expect(detectPhotoType(webp())).toBe("image/webp");
    expect(detectPhotoType(textFile())).toBeNull();
    expect(detectPhotoType(new Uint8Array(0))).toBeNull();
    expect(detectPhotoType(new Uint8Array([0xff]))).toBeNull();
  });

  it("construye una ruta predecible por cita y foto", () => {
    expect(photoStoragePath("a1", "p1", "image/webp")).toBe("appointments/a1/p1.webp");
  });
});

describe("subir fotos", () => {
  it("guarda el archivo, la fila y la entrada de historial", async () => {
    const storage = createMemoryStorage();
    const appointment = await newAppointment();

    const photo = await uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, png(1024));

    expect(photo.contentType).toBe("image/png");
    expect(photo.sizeBytes).toBe(1024);
    expect(photo.uploadedByName).toBe(AGENT_JOSUE.name);
    expect(photo.url).toContain(`appointments/${appointment.id}/${photo.id}.png`);
    expect(storage.files.size).toBe(1);
    expect([...storage.files.values()][0].contentType).toBe("image/png");

    const detail = await getAppointment(ctx.db, appointment.id);
    expect(detail.photos).toHaveLength(1);
    expect(detail.history.some((entry) => entry.field === "photo" && entry.toValue === "added")).toBe(true);
  });

  it("no deja la foto huérfana si falla la URL firmada después de guardarla", async () => {
    const storage = createMemoryStorage();
    storage.signedUrl = async () => {
      throw new Error("firma caída");
    };
    const appointment = await newAppointment();

    const photo = await uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, jpeg());

    expect(photo.url).toBe("");
    expect(storage.files.size).toBe(1);
    expect((await getAppointment(ctx.db, appointment.id)).photos).toHaveLength(1);
  });

  it("liga la foto a un artículo de la misma cita y la conserva al editar los artículos", async () => {
    const storage = createMemoryStorage();
    const appointment = await newAppointment();
    const other = await newAppointment();
    const [item] = await ctx.db
      .select()
      .from(appointmentItems)
      .where(eq(appointmentItems.appointmentId, appointment.id));
    const [foreign] = await ctx.db.select().from(appointmentItems).where(eq(appointmentItems.appointmentId, other.id));

    const photo = await uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, jpeg(), item.id);
    expect(photo.itemId).toBe(item.id);
    await expect(uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, jpeg(), foreign.id)).rejects.toMatchObject({
      code: "item_mismatch",
    });

    await runAction(ctx.db, AGENT_JOSUE, appointment.id, {
      action: "update_items",
      items: [{ serviceId: item.serviceId, specs: item.specs, details: { color: "Azul" }, priceCents: 999 }],
    });
    const listed = await listPhotos(ctx.db, storage, appointment.id);
    expect(listed[0].itemId).toBe(item.id);
  });

  it("acepta JPG, PNG y WebP", async () => {
    const storage = createMemoryStorage();
    const appointment = await newAppointment();
    for (const bytes of [jpeg(), png(), webp()]) {
      await uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, bytes);
    }
    expect(storage.files.size).toBe(3);
  });

  it("rechaza archivos que no son fotos aunque se hagan pasar por una", async () => {
    const storage = createMemoryStorage();
    const appointment = await newAppointment();
    await expect(uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, textFile())).rejects.toMatchObject({
      code: "photo_unsupported_type",
    });
    expect(storage.files.size).toBe(0);
  });

  it("rechaza archivos vacíos y demasiado grandes", async () => {
    const storage = createMemoryStorage();
    const appointment = await newAppointment();
    await expect(uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, new Uint8Array(0))).rejects.toMatchObject({
      code: "photo_empty",
    });
    await expect(
      uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, jpeg(MAX_PHOTO_BYTES + 1)),
    ).rejects.toMatchObject({ code: "photo_too_large" });
    await uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, jpeg(MAX_PHOTO_BYTES));
    expect(storage.files.size).toBe(1);
  });

  it("limita la cantidad de fotos por cita", async () => {
    const storage = createMemoryStorage();
    const appointment = await newAppointment();
    for (let index = 0; index < MAX_PHOTOS_PER_APPOINTMENT; index += 1) {
      await uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, jpeg(64));
    }
    await expect(uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, jpeg(64))).rejects.toMatchObject({
      code: "photo_limit",
    });
    expect(storage.files.size).toBe(MAX_PHOTOS_PER_APPOINTMENT);
  });

  it("no acepta fotos en una cita cancelada ni en una que no existe", async () => {
    const storage = createMemoryStorage();
    const appointment = await newAppointment();
    await runAction(ctx.db, AGENT_JOSUE, appointment.id, {
      action: "cancel",
      reason: "customer_cancelled",
      explanation: "",
    });
    await expect(uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, jpeg())).rejects.toMatchObject({
      code: "cancelled",
    });
    await expect(
      uploadPhoto(ctx.db, storage, AGENT_JOSUE, "00000000-0000-4000-8000-0000000000ff", jpeg()),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(uploadPhoto(ctx.db, storage, AGENT_JOSUE, "no-es-uuid", jpeg())).rejects.toBeInstanceOf(ZodError);
    expect(storage.files.size).toBe(0);
  });

  it("no deja huérfanos si falla el guardado en el almacenamiento", async () => {
    const storage = createMemoryStorage();
    const appointment = await newAppointment();
    storage.failNextPut = true;
    await expect(uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, jpeg())).rejects.toThrow("storage caído");
    const rows = await ctx.db
      .select()
      .from(appointmentPhotos)
      .where(eq(appointmentPhotos.appointmentId, appointment.id));
    expect(rows).toHaveLength(0);
  });

  it("elimina el archivo si falla el registro en la base de datos", async () => {
    const storage = createMemoryStorage();
    const appointment = await newAppointment();
    const stranger = { id: "00000000-0000-4000-8000-0000000000aa", name: "Desconocido", role: "agent" as const };
    await expect(uploadPhoto(ctx.db, storage, stranger, appointment.id, jpeg())).rejects.toThrow();
    expect(storage.files.size).toBe(0);
    const rows = await ctx.db
      .select()
      .from(appointmentPhotos)
      .where(eq(appointmentPhotos.appointmentId, appointment.id));
    expect(rows).toHaveLength(0);
  });
});

describe("listar fotos", () => {
  it("devuelve las fotos en orden de subida con URL firmada y autor", async () => {
    const storage = createMemoryStorage();
    const appointment = await newAppointment();
    const first = await uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, jpeg());
    const second = await uploadPhoto(ctx.db, storage, AGENT_JUANCHO, appointment.id, png());

    const photos = await listPhotos(ctx.db, storage, appointment.id);
    expect(photos.map((photo) => photo.id)).toEqual([first.id, second.id]);
    expect(photos[1].uploadedByName).toBe(AGENT_JUANCHO.name);
    expect(photos[0].url).toContain("expires=3600");
  });

  it("devuelve una lista vacía y falla con not_found si la cita no existe", async () => {
    const storage = createMemoryStorage();
    const appointment = await newAppointment();
    expect(await listPhotos(ctx.db, storage, appointment.id)).toEqual([]);
    await expect(listPhotos(ctx.db, storage, "00000000-0000-4000-8000-0000000000ff")).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("eliminar fotos", () => {
  it("lo puede hacer quien la subió: borra fila y archivo y deja historial", async () => {
    const storage = createMemoryStorage();
    const appointment = await newAppointment();
    const photo = await uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, jpeg());

    await expect(deletePhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, photo.id)).resolves.toEqual({
      deleted: true,
    });
    expect(storage.files.size).toBe(0);
    const detail = await getAppointment(ctx.db, appointment.id);
    expect(detail.photos).toHaveLength(0);
    expect(detail.history.some((entry) => entry.field === "photo" && entry.toValue === "removed")).toBe(true);
  });

  it("otro agente no puede, pero un administrador sí", async () => {
    const storage = createMemoryStorage();
    const appointment = await newAppointment();
    const photo = await uploadPhoto(ctx.db, storage, AGENT_JUANCHO, appointment.id, jpeg());

    await expect(deletePhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, photo.id)).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(storage.files.size).toBe(1);

    await deletePhoto(ctx.db, storage, ADMIN, appointment.id, photo.id);
    expect(storage.files.size).toBe(0);
  });

  it("no encuentra una foto de otra cita ni una inexistente", async () => {
    const storage = createMemoryStorage();
    const one = await newAppointment();
    const other = await newAppointment();
    const photo = await uploadPhoto(ctx.db, storage, AGENT_JOSUE, one.id, jpeg());

    await expect(deletePhoto(ctx.db, storage, AGENT_JOSUE, other.id, photo.id)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(
      deletePhoto(ctx.db, storage, AGENT_JOSUE, one.id, "00000000-0000-4000-8000-0000000000ff"),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(deletePhoto(ctx.db, storage, AGENT_JOSUE, one.id, "x")).rejects.toBeInstanceOf(ZodError);
    expect(storage.files.size).toBe(1);
  });

  it("la fila se elimina aunque el almacenamiento falle al borrar", async () => {
    const storage = createMemoryStorage();
    const appointment = await newAppointment();
    const photo = await uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, jpeg());
    storage.failRemove = true;
    await expect(deletePhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, photo.id)).resolves.toEqual({
      deleted: true,
    });
    expect(await listPhotos(ctx.db, storage, appointment.id)).toEqual([]);
  });
});

describe("fotos del panel", () => {
  const JUANCHO_ACTOR = { id: AGENT_JUANCHO.id, name: AGENT_JUANCHO.name, role: "agent" as const };

  it("marca quién puede eliminar cada foto", async () => {
    const storage = createMemoryStorage();
    const appointment = await newAppointment();
    await uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, jpeg());
    await uploadPhoto(ctx.db, storage, AGENT_JUANCHO, appointment.id, png());

    const asAdmin = await panelPhotos(ctx.db, () => storage, ADMIN, appointment.id);
    expect(asAdmin.available).toBe(true);
    expect(asAdmin.photos.map((photo) => photo.canDelete)).toEqual([true, true]);

    const asUploader = await panelPhotos(ctx.db, () => storage, JUANCHO_ACTOR, appointment.id);
    expect(asUploader.photos.map((photo) => photo.canDelete)).toEqual([false, true]);
  });

  it("entrega fechas como texto y URLs firmadas", async () => {
    const storage = createMemoryStorage();
    const appointment = await newAppointment();
    await uploadPhoto(ctx.db, storage, AGENT_JOSUE, appointment.id, webp(2048));

    const { photos } = await panelPhotos(ctx.db, () => storage, ADMIN, appointment.id);
    expect(photos).toHaveLength(1);
    expect(typeof photos[0].createdAt).toBe("string");
    expect(Number.isNaN(Date.parse(photos[0].createdAt))).toBe(false);
    expect(photos[0].url).toMatch(/^https:\/\/storage\.test\/appointments\//);
    expect(photos[0].sizeBytes).toBe(2048);
  });

  it("no rompe el panel cuando el almacenamiento no está configurado", async () => {
    const appointment = await newAppointment();
    const result = await panelPhotos(
      ctx.db,
      () => {
        throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para usar el almacenamiento de fotos");
      },
      ADMIN,
      appointment.id,
    );
    expect(result).toEqual({ available: false, photos: [] });
  });
});

describe("lectura de la subida HTTP", () => {
  function uploadRequest(form: FormData, headers: Record<string, string> = {}) {
    return new Request("http://localhost/api/appointments/x/photos", { method: "POST", body: form, headers });
  }

  it("lee el campo file", async () => {
    const form = new FormData();
    form.set("file", new File([jpeg(32)], "foto.jpg", { type: "image/jpeg" }));
    const bytes = await readPhotoUpload(uploadRequest(form));
    expect(bytes.byteLength).toBe(32);
  });

  it("lee el artículo opcional junto con la foto", async () => {
    const form = new FormData();
    form.set("file", new File([jpeg(32)], "foto.jpg", { type: "image/jpeg" }));
    form.set("itemId", " 11111111-1111-4111-8111-111111111111 ");
    expect((await readPhotoUploadForm(uploadRequest(form))).itemId).toBe("11111111-1111-4111-8111-111111111111");
    const plain = new FormData();
    plain.set("file", new File([jpeg(32)], "foto.jpg", { type: "image/jpeg" }));
    expect((await readPhotoUploadForm(uploadRequest(plain))).itemId).toBeNull();
  });

  it("exige el campo file y un cuerpo multipart", async () => {
    const empty = new FormData();
    empty.set("otro", "valor");
    await expect(readPhotoUpload(uploadRequest(empty))).rejects.toMatchObject({ code: "file_required" });

    const text = new FormData();
    text.set("file", "no soy un archivo");
    await expect(readPhotoUpload(uploadRequest(text))).rejects.toMatchObject({ code: "file_required" });

    const json = new Request("http://localhost/x", {
      method: "POST",
      body: JSON.stringify({ file: 1 }),
      headers: { "content-type": "application/json" },
    });
    await expect(readPhotoUpload(json)).rejects.toMatchObject({ code: "file_required" });
  });

  it("rechaza por tamaño, con o sin Content-Length", async () => {
    const big = new FormData();
    big.set("file", new File([jpeg(MAX_PHOTO_BYTES + 1)], "grande.jpg", { type: "image/jpeg" }));
    await expect(readPhotoUpload(uploadRequest(big))).rejects.toMatchObject({ code: "photo_too_large" });

    const small = new FormData();
    small.set("file", new File([jpeg(32)], "foto.jpg"));
    await expect(
      readPhotoUpload(uploadRequest(small, { "content-length": String(MAX_PHOTO_BYTES * 3) })),
    ).rejects.toMatchObject({ code: "photo_too_large" });
  });
});

describe("adaptador de Supabase Storage", () => {
  function fakeClient(result: { error: { message: string } | null; data?: unknown }) {
    const calls: { bucket?: string; action?: string; args?: unknown[] } = {};
    const bucket = {
      upload: async (...args: unknown[]) => ((calls.action = "upload"), (calls.args = args), result),
      remove: async (...args: unknown[]) => ((calls.action = "remove"), (calls.args = args), result),
      createSignedUrl: async (...args: unknown[]) => ((calls.action = "sign"), (calls.args = args), result),
    };
    const client = {
      storage: {
        from: (name: string) => {
          calls.bucket = name;
          return bucket;
        },
      },
    };
    return { client: client as never, calls };
  }

  it("sube sin sobrescribir al bucket privado de fotos", async () => {
    const { client, calls } = fakeClient({ error: null });
    await createSupabasePhotoStorage(client).put("a/b.jpg", jpeg(4), "image/jpeg");
    expect(calls.bucket).toBe("appointment-photos");
    expect(calls.action).toBe("upload");
    expect(calls.args?.[0]).toBe("a/b.jpg");
    expect(calls.args?.[2]).toEqual({ contentType: "image/jpeg", upsert: false });
  });

  it("firma URLs con vigencia de una hora por defecto y traduce los errores", async () => {
    const ok = fakeClient({ error: null, data: { signedUrl: "https://firmada" } });
    expect(await createSupabasePhotoStorage(ok.client).signedUrl("a/b.jpg")).toBe("https://firmada");
    expect(ok.calls.args).toEqual(["a/b.jpg", 3600]);

    const failing = fakeClient({ error: { message: "boom" } });
    const storage = createSupabasePhotoStorage(failing.client);
    await expect(storage.put("a", jpeg(4), "image/jpeg")).rejects.toThrow("boom");
    await expect(storage.remove("a")).rejects.toThrow("boom");
    await expect(storage.signedUrl("a")).rejects.toThrow("boom");
  });

  it("crea el bucket privado si no existe y reintenta la subida", async () => {
    const uploads: string[] = [];
    let exists = false;
    const created: unknown[] = [];
    const client = {
      storage: {
        from: () => ({
          upload: async (path: string) => {
            uploads.push(path);
            return { error: exists ? null : { message: "Bucket not found" } };
          },
        }),
        createBucket: async (...args: unknown[]) => {
          created.push(args);
          exists = true;
          return { error: null };
        },
      },
    };
    await createSupabasePhotoStorage(client as never).put("a/b.jpg", jpeg(4), "image/jpeg");
    expect(uploads).toEqual(["a/b.jpg", "a/b.jpg"]);
    expect(created).toEqual([
      [
        "appointment-photos",
        { public: false, fileSizeLimit: MAX_PHOTO_BYTES, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] },
      ],
    ]);
  });

  it("explica en español por qué Supabase rechazó la foto", async () => {
    const reject = (message: string) =>
      createSupabasePhotoStorage(fakeClient({ error: { message } }).client).put("a", jpeg(4), "image/jpeg");
    await expect(reject("Invalid Compact JWS")).rejects.toMatchObject({
      code: "storage_error",
      message: expect.stringMatching(/SUPABASE_SERVICE_ROLE_KEY/),
    });
    await expect(reject("new row violates row-level security policy")).rejects.toThrow(/service_role/);
    await expect(reject("The object exceeded the maximum allowed size")).rejects.toThrow(/límite de tamaño/);
    await expect(reject("Bucket not found")).rejects.toThrow(/Créalo como privado/);
  });
});
