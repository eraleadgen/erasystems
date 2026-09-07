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

/** The business's monthly statement email preference. */
export const getStatementEmailSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ enabled: boolean; recipient: string | null } | null> => {
      const membership = await callerBusiness(context as Ctx);
      if (!membership) return null;

      const [{ data: site }, { data: business }] = await Promise.all([
        context.supabase
          .from("business_site")
          .select("statement_email_enabled, statement_email_to")
          .eq("business_id", membership.businessId)
          .maybeSingle(),
        context.supabase
          .from("businesses")
          .select("support_email")
          .eq("id", membership.businessId)
          .maybeSingle(),
      ]);

      return {
        enabled: site?.statement_email_enabled ?? false,
        recipient: site?.statement_email_to ?? business?.support_email ?? null,
      };
    },
  );

/** Turns the monthly send on or off for the caller's own business. */
export const setStatementEmailEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const membership = await callerBusiness(context as Ctx);
    if (!membership || !["owner", "admin"].includes(membership.role)) return { ok: false };

    const { error } = await context.supabase
      .from("business_site")
      .upsert(
        { business_id: membership.businessId, statement_email_enabled: data.enabled },
        { onConflict: "business_id" },
      );
    return { ok: !error };
  });

/**
 * Sends one statement now, to the business's own configured address — the
 * recipient never comes from the request. Doubles as the "send me a test" action.
 */
export const sendStatementEmailNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ sent: boolean; detail: string }> => {
    const membership = await callerBusiness(context as Ctx);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { sent: false, detail: "Not allowed" };
    }

    const { sendStatementEmail } = await import("./statements.server");
    const result = await sendStatementEmail(context.supabase, membership.businessId, {
      ...(data.month ? { month: data.month } : {}),
    });

    if (result.sent) return { sent: true, detail: `Sent to ${result.recipient}` };
    if (result.reason === "no_recipient") {
      return { sent: false, detail: "No support email set for this business yet." };
    }
    return { sent: false, detail: "That address has unsubscribed from emails." };
  });
