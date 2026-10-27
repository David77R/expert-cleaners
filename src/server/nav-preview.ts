import * as schema from "@/db/schema";
import { minutesNowIn, todayIn } from "@/domain/date-rules";
import { ACTIVE_STATUSES, type NavPreview, type NavPreviewSection } from "@/domain/nav-preview";
import { getAlerts } from "@/server/alerts";
import { getDay, type Db } from "@/server/appointments";

const ALERT_SAMPLE = 3;

async function dayPreview(
  db: Db,
  companyId: string,
  section: "today" | "active",
  today: string,
  nowMin: number,
): Promise<NavPreview> {
  const { appointments } = await getDay(db, companyId, today);
  const rows = section === "active" ? appointments.filter((row) => ACTIVE_STATUSES.includes(row.status)) : appointments;
  return {
    section,
    date: today,
    nowMin,
    appointments: rows.map((row) => ({
      id: row.id,
      code: row.code,
      customerName: `${row.customer.firstName} ${row.customer.lastName}`.trim(),
      serviceName: row.items.map((item) => item.service.name).join(" + ") || row.service.name,
      city: row.address.city,
      technicianName: row.technician.name,
      technicianColor: row.technician.color,
      startMin: row.startMin,
      durationMin: row.durationMin,
      status: row.status,
    })),
  };
}

async function alertsPreview(db: Db, companyId: string, today: string): Promise<NavPreview> {
  const { items } = await getAlerts(db, companyId, { date: today });
  return {
    section: "alerts",
    date: today,
    total: items.reduce((sum, item) => sum + item.count, 0),
    groups: items.map((item) => ({
      type: item.type,
      level: item.level,
      count: item.count,
      appointments: item.appointments.slice(0, ALERT_SAMPLE).map((appointment) => ({
        id: appointment.id,
        code: appointment.code,
        customerName: appointment.customerName,
        date: appointment.date,
        startMin: appointment.startMin,
      })),
    })),
  };
}

export async function getNavPreview(
  db: Db,
  actor: Pick<schema.Actor, "companyId">,
  section: NavPreviewSection,
  today: string = todayIn(),
  nowMin: number = minutesNowIn(),
): Promise<NavPreview> {
  if (section === "alerts") return alertsPreview(db, actor.companyId, today);
  return dayPreview(db, actor.companyId, section, today, nowMin);
}
