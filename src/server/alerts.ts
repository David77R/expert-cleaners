import { and, asc, eq, lte } from "drizzle-orm";
import * as schema from "@/db/schema";
import { buildAlerts } from "@/domain/alert-rules";
import { todayIn } from "@/domain/date-rules";
import { alertsQuerySchema } from "@/domain/schemas";
import { getDay, type Db } from "@/server/appointments";

const { appointments } = schema;

export async function getAlerts(db: Db, raw: unknown = {}) {
  const parsed = alertsQuerySchema.parse(raw);
  const date = parsed.date ?? todayIn();

  const [day, unpaidCompleted] = await Promise.all([
    getDay(db, date),
    db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.status, "completed"),
          eq(appointments.paymentStatus, "unpaid"),
          lte(appointments.date, date),
        ),
      )
      .orderBy(asc(appointments.date), asc(appointments.startMin)),
  ]);

  const items = buildAlerts({
    dayAppointments: day.appointments,
    overlapIds: day.overlapIds,
    unpaidCompletedIds: unpaidCompleted.map((row) => row.id),
  });

  return { date, count: items.length, items };
}
