import { and, asc, eq, ne, or, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { DomainError } from "@/domain/appointment-rules";
import { BUSINESS_TIMEZONE, enumerateDates } from "@/domain/date-rules";
import { reportQuerySchema } from "@/domain/schemas";
import type { Db } from "@/server/appointments";
import { renderReportPdf } from "@/server/report-pdf";
import { companyBrand } from "@/server/companies";

type Actor = schema.Actor;

const { appointments, profiles } = schema;

export type ReportMetrics = {
  scheduled: number;
  cancelled: number;
  completed: number;
  bookedCents: number;
  paidCents: number;
  unpaidCents: number;
  daily: number[];
};

export type AgentReport = Awaited<ReturnType<typeof getAgentReport>>;

export type AgentReportRow = ReportMetrics & { agentId: string; name: string; role: schema.Actor["role"] };

function emptyMetrics(length: number): ReportMetrics {
  return {
    scheduled: 0,
    cancelled: 0,
    completed: 0,
    bookedCents: 0,
    paidCents: 0,
    unpaidCents: 0,
    daily: Array.from({ length }, () => 0),
  };
}

function inReport(companyId: string) {
  return and(
    ne(profiles.role, "technician"),
    or(
      eq(profiles.companyId, companyId),
      sql`exists (select 1 from ${appointments} where ${appointments.agentId} = ${profiles.id} and ${appointments.companyId} = ${companyId})`,
    ),
  );
}

export async function reportPeople(db: Db, companyId: string) {
  return db
    .select({ id: profiles.id, name: profiles.name })
    .from(profiles)
    .where(inReport(companyId))
    .orderBy(asc(profiles.name));
}

export async function getAgentReport(db: Db, actor: Actor, raw: unknown) {
  const { from, to, agentId } = reportQuerySchema.parse(raw);

  const people = await db
    .select({ id: profiles.id, name: profiles.name, role: profiles.role })
    .from(profiles)
    .where(and(inReport(actor.companyId), agentId ? eq(profiles.id, agentId) : undefined))
    .orderBy(asc(profiles.name));
  if (agentId && people.length === 0) throw new DomainError("not_found", "El agente no existe");

  const localDate = sql<string>`to_char(${appointments.createdAt} at time zone ${BUSINESS_TIMEZONE}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      agentId: appointments.agentId,
      date: localDate,
      scheduled: sql<number>`count(*)`.mapWith(Number),
      cancelled: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled')`.mapWith(Number),
      completed: sql<number>`count(*) filter (where ${appointments.status} = 'completed')`.mapWith(Number),
      bookedCents:
        sql<number>`coalesce(sum(${appointments.priceCents}) filter (where ${appointments.status} <> 'cancelled'), 0)`.mapWith(
          Number,
        ),
      paidCents:
        sql<number>`coalesce(sum(${appointments.priceCents}) filter (where ${appointments.status} <> 'cancelled' and ${appointments.paymentStatus} = 'paid'), 0)`.mapWith(
          Number,
        ),
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.companyId, actor.companyId),
        sql`${localDate} >= ${from}`,
        sql`${localDate} <= ${to}`,
        agentId ? eq(appointments.agentId, agentId) : undefined,
      ),
    )
    .groupBy(sql`1`, sql`2`);

  const dates = enumerateDates(from, to);
  const indexByDate = new Map(dates.map((date, index) => [date, index]));
  const totals = emptyMetrics(dates.length);
  const byAgent = new Map<string, ReportMetrics>(people.map((p) => [p.id, emptyMetrics(dates.length)]));

  for (const row of rows) {
    const metrics = byAgent.get(row.agentId);
    const index = indexByDate.get(row.date);
    if (!metrics || index === undefined) continue;
    for (const target of [metrics, totals]) {
      target.scheduled += row.scheduled;
      target.cancelled += row.cancelled;
      target.completed += row.completed;
      target.bookedCents += row.bookedCents;
      target.paidCents += row.paidCents;
      target.daily[index] += row.scheduled;
    }
  }

  const finish = (metrics: ReportMetrics): ReportMetrics => ({
    ...metrics,
    unpaidCents: metrics.bookedCents - metrics.paidCents,
  });

  return {
    from,
    to,
    timezone: BUSINESS_TIMEZONE,
    dates,
    agents: people.map<AgentReportRow>((p) => ({
      agentId: p.id,
      name: p.name,
      role: p.role,
      ...finish(byAgent.get(p.id)!),
    })),
    totals: finish(totals),
  };
}

export async function getAgentReportPdf(db: Db, actor: Actor, raw: unknown, generatedAt: Date = new Date()) {
  const report = await getAgentReport(db, actor, raw);
  const pdf = await renderReportPdf(report, generatedAt, await companyBrand(db, actor.companyId));
  return { report, pdf };
}
