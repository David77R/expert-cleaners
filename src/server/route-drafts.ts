import { and, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Actor } from "@/db/schema";
import { routeDraftSaveSchema, routeDraftDeleteSchema } from "@/domain/schemas";
import type { Db } from "@/server/appointments";

export async function saveRouteDraft(db: Db, actor: Actor, raw: unknown) {
  const input = routeDraftSaveSchema.parse(raw);
  const [saved] = await db
    .insert(schema.routeDrafts)
    .values({
      date: input.date,
      mode: input.mode,
      groupKey: input.groupKey,
      stopIds: input.stopIds,
      createdById: actor.id,
      createdByName: actor.name,
    })
    .onConflictDoUpdate({
      target: [schema.routeDrafts.date, schema.routeDrafts.mode, schema.routeDrafts.groupKey],
      set: {
        stopIds: input.stopIds,
        createdById: actor.id,
        createdByName: actor.name,
        createdAt: new Date(),
      },
    })
    .returning();
  return saved;
}

export async function deleteRouteDraft(db: Db, raw: unknown) {
  const input = routeDraftDeleteSchema.parse(raw);
  await db
    .delete(schema.routeDrafts)
    .where(
      and(
        eq(schema.routeDrafts.date, input.date),
        eq(schema.routeDrafts.mode, input.mode),
        eq(schema.routeDrafts.groupKey, input.groupKey),
      ),
    );
}

export async function listRouteDraftsForDay(db: Db, date: string) {
  return db.select().from(schema.routeDrafts).where(eq(schema.routeDrafts.date, date));
}
