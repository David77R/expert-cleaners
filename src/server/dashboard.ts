import { and, count, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { asDeliveryEntry } from "@/domain/delivery";
import { addDays, enumerateDates, periodBounds } from "@/domain/date-rules";
import { getDay, getDeliveries, type Db } from "@/server/appointments";

const { appointments, appointmentItems, customers, services } = schema;

export const CHART_PAST_DAYS = 13;
export const CHART_FUTURE_DAYS = 7;

export async function getDashboard(db: Db, companyId: string, today: string) {
  const month = periodBounds("month", today);
  const chartFrom = addDays(today, -CHART_PAST_DAYS);
  const chartTo = addDays(today, CHART_FUTURE_DAYS);
  const weekAhead = addDays(today, 7);
  const mine = eq(appointments.companyId, companyId);
  const active = and(mine, ne(appointments.status, "cancelled"));

  const [day, deliveryRows, perDay, [pending], [monthTotals], [unpaid], [newCustomers], topServices] =
    await Promise.all([
      getDay(db, companyId, today),
      getDeliveries(db, companyId, today, today),
      db
        .select({ date: appointments.date, total: count() })
        .from(appointments)
        .where(and(active, gte(appointments.date, chartFrom), lte(appointments.date, chartTo)))
        .groupBy(appointments.date),
      db
        .select({ total: count() })
        .from(appointments)
        .where(
          and(
            mine,
            inArray(appointments.status, ["not_confirmed", "rescheduled"]),
            gte(appointments.date, today),
            lte(appointments.date, weekAhead),
          ),
        ),
      db
        .select({
          total: count(),
          revenue: sql<number>`coalesce(sum(${appointments.priceCents}), 0)`,
          paid: sql<number>`coalesce(sum(case when ${appointments.paymentStatus} = 'paid' then ${appointments.priceCents} else 0 end), 0)`,
        })
        .from(appointments)
        .where(and(active, gte(appointments.date, month.from), lte(appointments.date, month.to))),
      db
        .select({ total: count(), amount: sql<number>`coalesce(sum(${appointments.priceCents}), 0)` })
        .from(appointments)
        .where(and(mine, eq(appointments.status, "completed"), eq(appointments.paymentStatus, "unpaid"))),
      db
        .select({ total: count() })
        .from(customers)
        .where(
          and(
            eq(customers.companyId, companyId),
            sql`(${customers.createdAt} at time zone 'America/New_York')::date between ${month.from} and ${month.to}`,
          ),
        ),
      db
        .select({
          serviceId: services.id,
          name: services.name,
          category: services.category,
          icon: services.icon,
          total: count(),
          revenue: sql<number>`coalesce(sum(${appointmentItems.priceCents}), 0)`,
        })
        .from(appointmentItems)
        .innerJoin(appointments, eq(appointments.id, appointmentItems.appointmentId))
        .innerJoin(services, eq(services.id, appointmentItems.serviceId))
        .where(and(active, gte(appointments.date, month.from), lte(appointments.date, month.to)))
        .groupBy(services.id, services.name, services.category, services.icon)
        .orderBy(desc(count()), desc(sql`coalesce(sum(${appointmentItems.priceCents}), 0)`))
        .limit(5),
    ]);

  const todayActive = day.appointments.filter((row) => row.status !== "cancelled");
  const deliveries = deliveryRows.flatMap((row) => {
    const entry = asDeliveryEntry(row);
    return entry ? [entry] : [];
  });

  const entries: ((typeof todayActive)[number] & { kind?: "delivery" })[] = [...todayActive, ...deliveries];

  const counts = new Map(perDay.map((row) => [row.date, Number(row.total)]));
  const daily = enumerateDates(chartFrom, chartTo).map((date) => ({ date, total: counts.get(date) ?? 0 }));

  const status = { notConfirmed: 0, confirmed: 0, rescheduled: 0, completed: 0 };
  for (const row of todayActive) {
    if (row.status === "not_confirmed") status.notConfirmed += 1;
    else if (row.status === "confirmed") status.confirmed += 1;
    else if (row.status === "rescheduled") status.rescheduled += 1;
    else if (row.status === "completed") status.completed += 1;
  }

  const loadByTech = new Map<
    string,
    { id: string; name: string; color: string; visits: number; minutes: number; capacity: number }
  >();
  for (const row of entries) {
    const current = loadByTech.get(row.technician.id) ?? {
      id: row.technician.id,
      name: row.technician.name,
      color: row.technician.color,
      visits: 0,
      minutes: 0,
      capacity: Math.max(60, row.technician.shiftEndMin - row.technician.shiftStartMin),
    };
    current.visits += 1;
    current.minutes += row.durationMin;
    loadByTech.set(row.technician.id, current);
  }

  const agenda = [...entries].sort((a, b) => a.startMin - b.startMin);

  return {
    today,
    month,
    status,
    todayCount: todayActive.length,
    deliveryCount: deliveries.length,
    overlapCount: day.overlapIds.length,
    pendingWeek: Number(pending.total),
    monthCount: Number(monthTotals.total),
    monthRevenueCents: Number(monthTotals.revenue),
    monthPaidCents: Number(monthTotals.paid),
    unpaidCount: Number(unpaid.total),
    unpaidCents: Number(unpaid.amount),
    newCustomers: Number(newCustomers.total),
    daily,
    topServices: topServices.map((row) => ({ ...row, total: Number(row.total), revenue: Number(row.revenue) })),
    technicianLoad: [...loadByTech.values()].sort((a, b) => b.minutes - a.minutes),
    agenda,
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
