import { and, asc, count, desc, eq, gte, ne, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { BUSINESS_TIMEZONE, todayIn } from "@/domain/date-rules";
import type { NavPreview, NavPreviewSection } from "@/domain/nav-preview";
import { serviceIconOf } from "@/domain/service-icons";
import type { Db } from "@/server/appointments";
import { listCompanies } from "@/server/companies";
import { getAgentReport } from "@/server/reports";

const { appointments, customers, profiles, services, technicians } = schema;

function monthStart(today: string): string {
  return `${today.slice(0, 8)}01`;
}

async function customersPreview(db: Db, companyId: string, today: string): Promise<NavPreview> {
  const since = sql`(${monthStart(today)}::date::timestamp at time zone ${BUSINESS_TIMEZONE})`;
  const [[totals], [fresh], recent] = await Promise.all([
    db.select({ value: count() }).from(customers).where(eq(customers.companyId, companyId)),
    db
      .select({ value: count() })
      .from(customers)
      .where(and(eq(customers.companyId, companyId), gte(customers.createdAt, since))),
    db
      .select({
        id: customers.id,
        code: customers.code,
        firstName: customers.firstName,
        lastName: customers.lastName,
        phone: customers.phone,
      })
      .from(customers)
      .where(eq(customers.companyId, companyId))
      .orderBy(desc(customers.createdAt))
      .limit(6),
  ]);
  return {
    section: "customers",
    total: totals.value,
    newThisMonth: fresh.value,
    recent: recent.map((row) => ({
      id: row.id,
      code: row.code,
      name: `${row.firstName} ${row.lastName}`.trim(),
      phone: row.phone,
    })),
  };
}

async function servicesPreview(db: Db, companyId: string): Promise<NavPreview> {
  const rows = await db
    .select()
    .from(services)
    .where(eq(services.companyId, companyId))
    .orderBy(asc(services.category), asc(services.basePriceCents));
  const active = rows.filter((row) => row.active);
  return {
    section: "services",
    active: active.length,
    inactive: rows.length - active.length,
    items: active.map((row) => ({
      id: row.id,
      name: row.name,
      icon: serviceIconOf(row),
      durationMin: row.durationMin,
      priceCents: row.basePriceCents,
    })),
  };
}

async function agentsPreview(db: Db, companyId: string): Promise<NavPreview> {
  const rows = await db
    .select({ id: profiles.id, name: profiles.name, role: profiles.role, active: profiles.active })
    .from(profiles)
    .where(eq(profiles.companyId, companyId))
    .orderBy(desc(profiles.active), asc(profiles.name));
  return { section: "agents", items: rows };
}

async function techniciansPreview(db: Db, companyId: string, today: string): Promise<NavPreview> {
  const [rows, counts] = await Promise.all([
    db
      .select()
      .from(technicians)
      .where(eq(technicians.companyId, companyId))
      .orderBy(desc(technicians.active), asc(technicians.name)),
    db
      .select({ technicianId: appointments.technicianId, value: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, companyId),
          eq(appointments.date, today),
          ne(appointments.status, "cancelled"),
        ),
      )
      .groupBy(appointments.technicianId),
  ]);
  const byTechnician = new Map(counts.map((row) => [row.technicianId, row.value]));
  return {
    section: "technicians",
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      zone: row.zone,
      active: row.active,
      today: byTechnician.get(row.id) ?? 0,
    })),
  };
}

async function reportsPreview(db: Db, actor: schema.Actor, today: string): Promise<NavPreview> {
  const from = monthStart(today);
  const report = await getAgentReport(db, actor, { from, to: today });
  const top = report.agents
    .filter((agent) => agent.scheduled > 0)
    .sort((a, b) => b.bookedCents - a.bookedCents)
    .slice(0, 3)
    .map((agent) => ({
      id: agent.agentId,
      name: agent.name,
      scheduled: agent.scheduled,
      bookedCents: agent.bookedCents,
    }));
  const { scheduled, completed, cancelled, bookedCents, paidCents, unpaidCents } = report.totals;
  return {
    section: "reports",
    from,
    to: today,
    scheduled,
    completed,
    cancelled,
    bookedCents,
    paidCents,
    unpaidCents,
    top,
  };
}

async function companiesPreview(db: Db, currentId: string): Promise<NavPreview> {
  const rows = await listCompanies(db);
  return {
    section: "companies",
    currentId,
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      label: row.settings.location.label,
      active: row.active,
    })),
  };
}

export async function getNavPreview(
  db: Db,
  actor: schema.Actor,
  section: NavPreviewSection,
  today: string = todayIn(),
): Promise<NavPreview> {
  switch (section) {
    case "customers":
      return customersPreview(db, actor.companyId, today);
    case "services":
      return servicesPreview(db, actor.companyId);
    case "agents":
      return agentsPreview(db, actor.companyId);
    case "technicians":
      return techniciansPreview(db, actor.companyId, today);
    case "reports":
      return reportsPreview(db, actor, today);
    case "companies":
      return companiesPreview(db, actor.companyId);
  }
}
