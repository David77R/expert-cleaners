import { randomUUID } from "node:crypto";
import { asc, count, eq, and } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import { assertCanDeletePhoto, canDeletePhoto } from "@/domain/permissions";
import { MAX_PHOTOS_PER_APPOINTMENT, photoStoragePath, validatePhoto } from "@/domain/photo-rules";
import type { Db } from "@/server/appointments";
import type { PhotoStorage } from "@/server/storage";

const { appointments, appointmentPhotos, appointmentHistory, profiles } = schema;

const idSchema = z.uuid();

export type PhotoView = {
  id: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  uploadedByName: string | null;
  createdAt: Date;
};

async function loadAppointment(db: Db, appointmentId: string) {
  const [row] = await db
    .select({ id: appointments.id, status: appointments.status })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);
  if (!row) throw new DomainError("not_found", "La cita no existe");
  return row;
}

async function toView(storage: PhotoStorage, row: schema.Photo, uploadedByName: string | null): Promise<PhotoView> {
  return {
    id: row.id,
    url: await storage.signedUrl(row.storagePath),
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    uploadedByName,
    createdAt: row.createdAt,
  };
}

export async function uploadPhoto(
  db: Db,
  storage: PhotoStorage,
  actor: schema.Actor,
  rawAppointmentId: string,
  bytes: Uint8Array,
): Promise<PhotoView> {
  const appointmentId = idSchema.parse(rawAppointmentId);
  const appointment = await loadAppointment(db, appointmentId);
  if (appointment.status === "cancelled") {
    throw new DomainError("cancelled", "No se pueden agregar fotos a una cita cancelada");
  }

  const { contentType, sizeBytes } = validatePhoto(bytes);

  const [existing] = await db
    .select({ total: count() })
    .from(appointmentPhotos)
    .where(eq(appointmentPhotos.appointmentId, appointmentId));
  if (existing.total >= MAX_PHOTOS_PER_APPOINTMENT) {
    throw new DomainError("photo_limit", `Cada cita admite hasta ${MAX_PHOTOS_PER_APPOINTMENT} fotos`);
  }

  const photoId = randomUUID();
  const storagePath = photoStoragePath(appointmentId, photoId, contentType);
  await storage.put(storagePath, bytes, contentType);

  try {
    const row = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(appointmentPhotos)
        .values({ id: photoId, appointmentId, storagePath, contentType, sizeBytes, uploadedBy: actor.id })
        .returning();
      await tx.insert(appointmentHistory).values({
        appointmentId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        field: "photo",
        fromValue: null,
        toValue: "added",
      });
      return created;
    });
    return await toView(storage, row, actor.name);
  } catch (error) {
    await storage.remove(storagePath).catch((cleanup) => console.error(cleanup));
    throw error;
  }
}

export async function listPhotos(db: Db, storage: PhotoStorage, rawAppointmentId: string): Promise<PhotoView[]> {
  const appointmentId = idSchema.parse(rawAppointmentId);
  await loadAppointment(db, appointmentId);
  const rows = await db
    .select({ photo: appointmentPhotos, uploaderName: profiles.name })
    .from(appointmentPhotos)
    .leftJoin(profiles, eq(profiles.id, appointmentPhotos.uploadedBy))
    .where(eq(appointmentPhotos.appointmentId, appointmentId))
    .orderBy(asc(appointmentPhotos.createdAt), asc(appointmentPhotos.id));
  return Promise.all(rows.map((row) => toView(storage, row.photo, row.uploaderName)));
}

export type PanelPhoto = {
  id: string;
  url: string;
  sizeBytes: number;
  uploadedByName: string | null;
  createdAt: string;
  canDelete: boolean;
};

export type PanelPhotos = { available: boolean; photos: PanelPhoto[] };

export async function panelPhotos(
  db: Db,
  getStorage: () => PhotoStorage,
  actor: schema.Actor,
  appointmentId: string,
): Promise<PanelPhotos> {
  try {
    const list = await listPhotos(db, getStorage(), appointmentId);
    return {
      available: true,
      photos: list.map((photo) => ({
        id: photo.id,
        url: photo.url,
        sizeBytes: photo.sizeBytes,
        uploadedByName: photo.uploadedByName,
        createdAt: photo.createdAt.toISOString(),
        canDelete: canDeletePhoto(actor, photo.uploadedBy),
      })),
    };
  } catch (error) {
    console.error(error);
    return { available: false, photos: [] };
  }
}

export async function deletePhoto(
  db: Db,
  storage: PhotoStorage,
  actor: schema.Actor,
  rawAppointmentId: string,
  rawPhotoId: string,
): Promise<{ deleted: true }> {
  const appointmentId = idSchema.parse(rawAppointmentId);
  const photoId = idSchema.parse(rawPhotoId);

  const removed = await db.transaction(async (tx) => {
    const [photo] = await tx
      .select()
      .from(appointmentPhotos)
      .where(and(eq(appointmentPhotos.id, photoId), eq(appointmentPhotos.appointmentId, appointmentId)))
      .limit(1);
    if (!photo) throw new DomainError("not_found", "La foto no existe");
    assertCanDeletePhoto(actor, photo.uploadedBy);

    await tx.delete(appointmentPhotos).where(eq(appointmentPhotos.id, photoId));
    await tx.insert(appointmentHistory).values({
      appointmentId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      field: "photo",
      fromValue: null,
      toValue: "removed",
    });
    return photo;
  });

  await storage.remove(removed.storagePath).catch((error) => console.error(error));
  return { deleted: true };
}
