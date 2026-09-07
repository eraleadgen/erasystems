import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callerBusiness, type Ctx } from "./customers.functions";
import {
  RANGES,
  monthLabel,
  type AnalyticsRange,
  type AnalyticsReport,
  type MonthlyStatement,
  type StatementMonth,
} from "./analytics";

/**
 * Analytics and monthly statements (both Enterprise-gated in the UI).
 *
 * Every figure comes from computeReport — one calculation, two surfaces.
 */

function rangeStart(range: AnalyticsRange, now: Date): Date {
  const d = new Date(now);
  if (range === "30d") d.setUTCDate(d.getUTCDate() - 30);
  else if (range === "90d") d.setUTCDate(d.getUTCDate() - 90);
  else if (range === "12m") d.setUTCMonth(d.getUTCMonth() - 12);
  else return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return d;
}

export const getAnalyticsReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ range: z.enum(RANGES) }).parse(input))
  .handler(async ({ data, context }): Promise<AnalyticsReport | null> => {
    const membership = await callerBusiness(context as Ctx);
    if (!membership) return null;

    const { computeReport } = await import("./analytics.server");
    const now = new Date();
    const start = rangeStart(data.range, now);
    const windowMs = now.getTime() - start.getTime();

    const { report } = await computeReport(context.supabase, membership.businessId, {
      start,
      end: now,
      prevStart: new Date(start.getTime() - windowMs),
      prevEnd: start,
      bucket: data.range === "12m" ? "month" : "day",
    });
    return report;
  });

/** Every completed calendar month the business could have activity in. */
export const listStatementMonths = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StatementMonth[]> => {
    const membership = await callerBusiness(context as Ctx);
    if (!membership) return [];

    const [{ data: business }, { data: firstBooking }] = await Promise.all([
      context.supabase
        .from("businesses")
        .select("timezone, created_at")
        .eq("id", membership.businessId)
        .maybeSingle(),
      context.supabase
        .from("bookings")
        .select("starts_at")
        .eq("business_id", membership.businessId)
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const timezone = business?.timezone ?? "UTC";
    const { localKey } = await import("./analytics.server");
    const startIso = firstBooking?.starts_at ?? business?.created_at ?? new Date().toISOString();
    const first = localKey(startIso, timezone, "month");
    const thisMonth = localKey(new Date().toISOString(), timezone, "month");

    const months: StatementMonth[] = [];
    const [fy, fm] = first.split("-").map(Number);
    let y = fy ?? new Date().getUTCFullYear();
    let m = fm ?? 1;
    for (let i = 0; i < 36; i += 1) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      if (key > thisMonth) break;
      months.push({ key, label: monthLabel(key) });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return months.reverse();
  });

/** One calendar month's statement, computed fresh from live data. */
export const getMonthlyStatement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<MonthlyStatement | null> => {
    const membership = await callerBusiness(context as Ctx);
    if (!membership) return null;

    const { computeReport, zonedMonthStart } = await import("./analytics.server");
    const { data: business } = await context.supabase
      .from("businesses")
      .select("timezone")
      .eq("id", membership.businessId)
      .maybeSingle();
    const timezone = business?.timezone ?? "UTC";

    const [year, month] = data.month.split("-").map(Number);
    if (!year || !month) return null;

    const start = zonedMonthStart(year, month, timezone);
    const end = zonedMonthStart(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, timezone);
    const prevStart = zonedMonthStart(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1, timezone);

    const { report, business: facts } = await computeReport(
      context.supabase,
      membership.businessId,
      {
        start,
        end: new Date(end.getTime() - 1),
        prevStart,
        prevEnd: start,
        bucket: "day",
      },
    );

    return {
      month: data.month,
      monthLabel: monthLabel(data.month),
      generatedAt: new Date().toISOString(),
      business: { name: facts.name, logoUrl: facts.logoUrl, primary: facts.primary },
      report,
    };
  });
