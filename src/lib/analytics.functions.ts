import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callerBusiness, type Ctx } from "./customers.functions";

/**
 * Advanced analytics (Enterprise-gated tab).
 *
 * Every read goes through the caller's own RLS-scoped client and is explicitly
 * filtered by their business_id. No elevated access, no cross-tenant reads.
 */

export const RANGES = ["30d", "90d", "12m", "ytd"] as const;
export type AnalyticsRange = (typeof RANGES)[number];

export const RANGE_LABELS: Record<AnalyticsRange, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "12m": "Last 12 months",
  ytd: "Year to date",
};

export type AnalyticsReport = {
  range: AnalyticsRange;
  bucket: "day" | "month";
  timezone: string;
  trend: { key: string; label: string; revenueCents: number; jobs: number }[];
  totals: {
    revenueCents: number;
    completedJobs: number;
    averageTicketCents: number;
    pipelineCents: number;
    pipelineJobs: number;
    revenueChangePct: number | null;
  };
  clv: {
    averageCents: number;
    medianCents: number;
    customersCounted: number;
    unattributedBookings: number;
    top: {
      id: string;
      name: string;
      lifetimeCents: number;
      jobs: number;
      firstAt: string | null;
      lastAt: string | null;
    }[];
  };
  mix: {
    newBookings: number;
    repeatBookings: number;
    newRevenueCents: number;
    repeatRevenueCents: number;
    repeatRatePct: number | null;
    newCustomers: number;
  };
  services: {
    id: string;
    name: string;
    bookings: number;
    revenueCents: number;
    averageTicketCents: number;
    minutes: number;
    revenuePerHourCents: number;
  }[];
};

function rangeStart(range: AnalyticsRange, now: Date): Date {
  const d = new Date(now);
  if (range === "30d") d.setUTCDate(d.getUTCDate() - 30);
  else if (range === "90d") d.setUTCDate(d.getUTCDate() - 90);
  else if (range === "12m") d.setUTCMonth(d.getUTCMonth() - 12);
  else return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return d;
}

/** Local calendar key for a timestamp, in the business's own timezone. */
function localKey(iso: string, timezone: string, bucket: "day" | "month") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "01";
  const ymd = `${get("year")}-${get("month")}-${get("day")}`;
  return bucket === "day" ? ymd : ymd.slice(0, 7);
}

function labelFor(key: string, bucket: "day" | "month") {
  if (bucket === "month") {
    const [y, m] = key.split("-");
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
  }
  const [y, m, d] = key.split("-");
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const COMPLETED = "completed";
const PIPELINE = new Set(["pending", "confirmed"]);

export const getAnalyticsReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ range: z.enum(RANGES) }).parse(input))
  .handler(async ({ data, context }): Promise<AnalyticsReport | null> => {
    const membership = await callerBusiness(context as Ctx);
    if (!membership) return null;
    const businessId = membership.businessId;

    const [{ data: business }, { data: services }, { data: customers }, { data: allBookings }] =
      await Promise.all([
        context.supabase.from("businesses").select("timezone").eq("id", businessId).maybeSingle(),
        context.supabase
          .from("services")
          .select("id, name")
          .eq("business_id", businessId)
          .order("sort_order", { ascending: true }),
        context.supabase
          .from("customers")
          .select("id, full_name")
          .eq("business_id", businessId),
        // Full history: lifetime value and "is this their first booking?" both
        // need more than the selected window.
        context.supabase
          .from("bookings")
          .select("id, customer_id, service_id, starts_at, status, total_cents")
          .eq("business_id", businessId)
          .order("starts_at", { ascending: true }),
      ]);

    const timezone = business?.timezone ?? "UTC";
    const now = new Date();
    const start = rangeStart(data.range, now);
    const bucket: "day" | "month" = data.range === "12m" ? "month" : "day";
    const windowMs = now.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - windowMs);

    const bookings = allBookings ?? [];
    const inWindow = bookings.filter((b) => {
      const t = new Date(b.starts_at).getTime();
      return t >= start.getTime() && t <= now.getTime();
    });
    const prevWindow = bookings.filter((b) => {
      const t = new Date(b.starts_at).getTime();
      return t >= prevStart.getTime() && t < start.getTime();
    });

    // --- Revenue trend (completed only) ---
    const buckets = new Map<string, { revenueCents: number; jobs: number }>();
    let revenueCents = 0;
    let completedJobs = 0;
    let pipelineCents = 0;
    let pipelineJobs = 0;

    for (const b of inWindow) {
      if (b.status === COMPLETED) {
        const key = localKey(b.starts_at, timezone, bucket);
        const entry = buckets.get(key) ?? { revenueCents: 0, jobs: 0 };
        entry.revenueCents += b.total_cents;
        entry.jobs += 1;
        buckets.set(key, entry);
        revenueCents += b.total_cents;
        completedJobs += 1;
      } else if (PIPELINE.has(b.status)) {
        pipelineCents += b.total_cents;
        pipelineJobs += 1;
      }
    }

    const prevRevenue = prevWindow
      .filter((b) => b.status === COMPLETED)
      .reduce((sum, b) => sum + b.total_cents, 0);

    const trend = [...buckets.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, v]) => ({ key, label: labelFor(key, bucket), ...v }));

    // --- Lifetime value (whole history, attributed bookings only) ---
    const nameById = new Map((customers ?? []).map((c) => [c.id, c.full_name]));
    const lifetime = new Map<
      string,
      { cents: number; jobs: number; firstAt: string | null; lastAt: string | null }
    >();
    for (const b of bookings) {
      if (!b.customer_id || b.status !== COMPLETED) continue;
      const entry = lifetime.get(b.customer_id) ?? {
        cents: 0,
        jobs: 0,
        firstAt: null as string | null,
        lastAt: null as string | null,
      };
      entry.cents += b.total_cents;
      entry.jobs += 1;
      if (!entry.firstAt || b.starts_at < entry.firstAt) entry.firstAt = b.starts_at;
      if (!entry.lastAt || b.starts_at > entry.lastAt) entry.lastAt = b.starts_at;
      lifetime.set(b.customer_id, entry);
    }
    const values = [...lifetime.values()].map((v) => v.cents).sort((a, b) => a - b);
    const averageCents = values.length
      ? Math.round(values.reduce((s, v) => s + v, 0) / values.length)
      : 0;
    const medianCents = values.length
      ? values.length % 2
        ? (values[(values.length - 1) / 2] ?? 0)
        : Math.round(
            ((values[values.length / 2 - 1] ?? 0) + (values[values.length / 2] ?? 0)) / 2,
          )
      : 0;

    const top = [...lifetime.entries()]
      .sort(([, a], [, b]) => b.cents - a.cents)
      .slice(0, 10)
      .map(([id, v]) => ({
        id,
        name: nameById.get(id) ?? "Customer",
        lifetimeCents: v.cents,
        jobs: v.jobs,
        firstAt: v.firstAt,
        lastAt: v.lastAt,
      }));

    // --- New vs repeat, judged against each customer's earliest booking ever ---
    const firstBookingAt = new Map<string, string>();
    for (const b of bookings) {
      if (!b.customer_id) continue;
      const seen = firstBookingAt.get(b.customer_id);
      if (!seen || b.starts_at < seen) firstBookingAt.set(b.customer_id, b.starts_at);
    }

    let newBookings = 0;
    let repeatBookings = 0;
    let newRevenueCents = 0;
    let repeatRevenueCents = 0;
    let unattributedBookings = 0;
    const newCustomerIds = new Set<string>();

    for (const b of inWindow) {
      if (!b.customer_id) {
        unattributedBookings += 1;
        continue;
      }
      const isNew = firstBookingAt.get(b.customer_id) === b.starts_at;
      if (isNew) {
        newBookings += 1;
        newRevenueCents += b.status === COMPLETED ? b.total_cents : 0;
        newCustomerIds.add(b.customer_id);
      } else {
        repeatBookings += 1;
        repeatRevenueCents += b.status === COMPLETED ? b.total_cents : 0;
      }
    }
    const attributed = newBookings + repeatBookings;

    // --- Service performance in the window ---
    const perService = new Map<
      string,
      { bookings: number; revenueCents: number; minutes: number }
    >();
    for (const s of services ?? []) {
      perService.set(s.id, { bookings: 0, revenueCents: 0, minutes: 0 });
    }
    const durationById = new Map<string, number>();
    const { data: durations } = await context.supabase
      .from("services")
      .select("id, duration_minutes")
      .eq("business_id", businessId);
    for (const s of durations ?? []) durationById.set(s.id, s.duration_minutes);

    for (const b of inWindow) {
      if (!b.service_id) continue;
      const entry = perService.get(b.service_id) ?? {
        bookings: 0,
        revenueCents: 0,
        minutes: 0,
      };
      entry.bookings += 1;
      if (b.status === COMPLETED) {
        entry.revenueCents += b.total_cents;
        entry.minutes += durationById.get(b.service_id) ?? 0;
      }
      perService.set(b.service_id, entry);
    }

    const serviceNames = new Map((services ?? []).map((s) => [s.id, s.name]));
    const serviceRows = [...perService.entries()]
      .map(([id, v]) => ({
        id,
        name: serviceNames.get(id) ?? "Removed service",
        bookings: v.bookings,
        revenueCents: v.revenueCents,
        averageTicketCents: v.bookings ? Math.round(v.revenueCents / v.bookings) : 0,
        minutes: v.minutes,
        revenuePerHourCents: v.minutes ? Math.round((v.revenueCents / v.minutes) * 60) : 0,
      }))
      .sort((a, b) => b.revenueCents - a.revenueCents);

    return {
      range: data.range,
      bucket,
      timezone,
      trend,
      totals: {
        revenueCents,
        completedJobs,
        averageTicketCents: completedJobs ? Math.round(revenueCents / completedJobs) : 0,
        pipelineCents,
        pipelineJobs,
        revenueChangePct:
          prevRevenue > 0 ? Math.round(((revenueCents - prevRevenue) / prevRevenue) * 100) : null,
      },
      clv: {
        averageCents,
        medianCents,
        customersCounted: values.length,
        unattributedBookings,
        top,
      },
      mix: {
        newBookings,
        repeatBookings,
        newRevenueCents,
        repeatRevenueCents,
        repeatRatePct: attributed ? Math.round((repeatBookings / attributed) * 100) : null,
        newCustomers: newCustomerIds.size,
      },
      services: serviceRows,
    };
  });
