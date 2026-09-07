import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { monthLabel } from "./analytics";
import { computeReport, localKey, zonedMonthStart } from "./analytics.server";
import { formatMoney } from "./entitlements";
import { sendTemplateEmail } from "./email-templates/send-email";

/**
 * Monthly statement email. Every figure comes from computeReport — the same
 * calculation the Analytics tab and the printable statement use. No second
 * maths path, no stored copy.
 */

const APP_ORIGIN = "https://erasystems.lovable.app";

export type StatementSendResult =
  | { sent: true; recipient: string; month: string }
  | { sent: false; reason: "no_recipient" | "disabled" | "recipient_suppressed"; month: string };

/** The calendar month before `now`, in the business's own timezone. */
export function previousMonthKey(timezone: string, now = new Date()) {
  const thisMonth = localKey(now.toISOString(), timezone, "month");
  const [y, m] = thisMonth.split("-").map(Number);
  const year = m === 1 ? (y ?? 1) - 1 : (y ?? 1);
  const month = m === 1 ? 12 : (m ?? 1) - 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Sends one business's statement for one calendar month.
 * `supabase` is whatever client the caller is entitled to use; every read below
 * is explicitly scoped to `businessId`.
 */
export async function sendStatementEmail(
  supabase: SupabaseClient<Database>,
  businessId: string,
  options: { month?: string; recipientOverride?: string; requireEnabled?: boolean } = {},
): Promise<StatementSendResult> {
  const [{ data: business }, { data: site }] = await Promise.all([
    supabase
      .from("businesses")
      .select("name, timezone, support_email")
      .eq("id", businessId)
      .maybeSingle(),
    supabase
      .from("business_site")
      .select("statement_email_enabled, statement_email_to")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  const timezone = business?.timezone ?? "UTC";
  const month = options.month ?? previousMonthKey(timezone);

  if (options.requireEnabled && !site?.statement_email_enabled) {
    return { sent: false, reason: "disabled", month };
  }

  const recipient =
    options.recipientOverride ?? site?.statement_email_to ?? business?.support_email ?? null;
  if (!recipient) return { sent: false, reason: "no_recipient", month };

  const [year, mon] = month.split("-").map(Number);
  const start = zonedMonthStart(year ?? 1970, mon ?? 1, timezone);
  const end = zonedMonthStart(mon === 12 ? (year ?? 0) + 1 : (year ?? 0), mon === 12 ? 1 : (mon ?? 1) + 1, timezone);
  const prevStart = zonedMonthStart(mon === 1 ? (year ?? 0) - 1 : (year ?? 0), mon === 1 ? 12 : (mon ?? 1) - 1, timezone);

  const { report } = await computeReport(supabase, businessId, {
    start,
    end: new Date(end.getTime() - 1),
    prevStart,
    prevEnd: start,
    bucket: "day",
  });

  const t = report.totals;
  const result = await sendTemplateEmail("monthly-statement", recipient, {
    idempotencyKey: `monthly-statement-${businessId}-${month}`,
    templateData: {
      businessName: business?.name ?? "Your business",
      monthLabel: monthLabel(month),
      revenue: formatMoney(t.revenueCents),
      completedJobs: t.completedJobs,
      averageTicket: formatMoney(t.averageTicketCents),
      changeLabel:
        t.revenueChangePct === null
          ? ""
          : `${t.revenueChangePct >= 0 ? "+" : ""}${t.revenueChangePct}% vs prior month`,
      repeatRate: report.mix.repeatRatePct === null ? "—" : `${report.mix.repeatRatePct}%`,
      newCustomers: report.mix.newCustomers,
      topServices: report.services.slice(0, 5).map((s) => ({
        name: s.name,
        revenue: formatMoney(s.revenueCents),
        jobs: s.bookings,
      })),
      statementUrl: `${APP_ORIGIN}/statement/${month}`,
    },
  });

  if (!result.sent) return { sent: false, reason: "recipient_suppressed", month };
  return { sent: true, recipient, month };
}
