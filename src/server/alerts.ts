import { and, asc, eq, lte } from "drizzle-orm";
import * as schema from "@/db/schema";
import { buildAlerts } from "@/domain/alert-rules";
import { todayIn } from "@/domain/date-rules";
import { alertsQuerySchema } from "@/domain/schemas";
import { getDay, type Db } from "@/server/appointments";

const { appointments } = schema;

export type AlertAppointmentRef = {
  id: string;
  code: string;
  customerName: string;
  technicianId: string;
  technicianName: string;
  date: string;
  startMin: number;
};

export async function getAlerts(db: Db, raw: unknown = {}) {
  const parsed = alertsQuerySchema.parse(raw);
  const date = parsed.date ?? todayIn();

  const [day, unpaidCompleted] = await Promise.all([
    getDay(db, date),
    db.query.appointments.findMany({
      where: and(
        eq(appointments.status, "completed"),
        eq(appointments.paymentStatus, "unpaid"),
        lte(appointments.date, date),
      ),
      with: { customer: true, technician: true },
      orderBy: [asc(appointments.date), asc(appointments.startMin)],
    }),
  ]);

  const items = buildAlerts({
    dayAppointments: day.appointments,
    overlapIds: day.overlapIds,
    unpaidCompletedIds: unpaidCompleted.map((row) => row.id),
  });

  const refsById = new Map<string, AlertAppointmentRef>();
  for (const row of [...day.appointments, ...unpaidCompleted]) {
    refsById.set(row.id, {
      id: row.id,
      code: row.code,
      customerName: `${row.customer.firstName} ${row.customer.lastName}`,
      technicianId: row.technician.id,
      technicianName: row.technician.name,
      date: row.date,
      startMin: row.startMin,
    });
  }

  const enrichedItems = items.map((item) => ({
    ...item,
    appointments: item.appointmentIds
      .map((id) => refsById.get(id))
      .filter((ref): ref is AlertAppointmentRef => Boolean(ref)),
  }));

  return { date, count: items.length, items: enrichedItems };
}
