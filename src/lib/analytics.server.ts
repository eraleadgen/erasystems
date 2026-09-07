import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { AnalyticsReport } from "./analytics";

/**
 * The single analytics calculation used by both the Analytics tab and the
 * monthly statement. Reads go through the caller's own RLS-scoped client and
 * are explicitly business_id filtered — no elevated access.
 */

const COMPLETED = "completed";
const PIPELINE = new Set(["pending", "confirmed"]);

/** Offset, in ms, between UTC and the given timezone at that instant. */
function tzOffsetMs(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(
    Number(p["year"]),
    Number(p["month"]) - 1,
    Number(p["day"]),
    Number(p["hour"]) === 24 ? 0 : Number(p["hour"]),
    Number(p["minute"]),
    Number(p["second"]),
  );
  return asUTC - date.getTime();
}

/** The instant at which local wall-clock midnight of y-m-1 occurs. */
export function zonedMonthStart(year: number, month: number, timeZone: string) {
  const guess = Date.UTC(year, month - 1, 1);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  return new Date(guess - offset);
}

/** Calendar key ("2026-08" / "2026-08-14") for an instant, in the business's timezone. */
export function localKey(iso: string, timeZone: string, bucket: "day" | "month") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
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
    return new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  }
  const [y, m, d] = key.split("-");
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export type ReportWindow = {
  start: Date;
  end: Date;
  /** Comparison window; totals report the change against it when present. */
  prevStart?: Date;
  prevEnd?: Date;
  bucket: "day" | "month";
};

export type BusinessFacts = {
  timezone: string;
  name: string;
  logoUrl: string | null;
  primary: string | null;
  firstBookingAt: string | null;
};

type Client = SupabaseClient<Database>;

export async function computeReport(
  supabase: Client,
  businessId: string,
  window: ReportWindow,
): Promise<{ report: AnalyticsReport; business: BusinessFacts }> {
  const [{ data: business }, { data: services }, { data: customers }, { data: allBookings }] =
    await Promise.all([
      supabase
        .from("businesses")
        .select("timezone, name, logo_url, brand_primary")
        .eq("id", businessId)
        .maybeSingle(),
      supabase
        .from("services")
        .select("id, name, duration_minutes")
        .eq("business_id", businessId)
        .order("sort_order", { ascending: true }),
      supabase.from("customers").select("id, full_name").eq("business_id", businessId),
      // Full history: lifetime value and "is this their first booking?" both
      // need more than the selected window.
      supabase
        .from("bookings")
        .select("id, customer_id, service_id, starts_at, status, total_cents")
        .eq("business_id", businessId)
        .order("starts_at", { ascending: true }),
    ]);

  const timezone = business?.timezone ?? "UTC";
  const bookings = allBookings ?? [];
  const { start, end, prevStart, prevEnd, bucket } = window;

  const inWindow = bookings.filter((b) => {
    const t = new Date(b.starts_at).getTime();
    return t >= start.getTime() && t <= end.getTime();
  });
  const prevWindow =
    prevStart && prevEnd
      ? bookings.filter((b) => {
          const t = new Date(b.starts_at).getTime();
          return t >= prevStart.getTime() && t < prevEnd.getTime();
        })
      : [];

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
      : Math.round(((values[values.length / 2 - 1] ?? 0) + (values[values.length / 2] ?? 0)) / 2)
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
    if (firstBookingAt.get(b.customer_id) === b.starts_at) {
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
    { bookings: number; completed: number; revenueCents: number; minutes: number }
  >();
  const durationById = new Map<string, number>();
  for (const s of services ?? []) {
    perService.set(s.id, { bookings: 0, completed: 0, revenueCents: 0, minutes: 0 });
    durationById.set(s.id, s.duration_minutes);
  }

  for (const b of inWindow) {
    if (!b.service_id) continue;
    const entry = perService.get(b.service_id) ?? {
      bookings: 0,
      completed: 0,
      revenueCents: 0,
      minutes: 0,
    };
    entry.bookings += 1;
    if (b.status === COMPLETED) {
      entry.completed += 1;
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
      // Completed revenue over completed jobs only, so an unfinished booking
      // can't drag the figure down.
      averageTicketCents: v.completed ? Math.round(v.revenueCents / v.completed) : 0,
      minutes: v.minutes,
      revenuePerHourCents: v.minutes ? Math.round((v.revenueCents / v.minutes) * 60) : 0,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents);

  return {
    business: {
      timezone,
      name: business?.name ?? "Your business",
      logoUrl: business?.logo_url ?? null,
      primary: business?.brand_primary ?? null,
      firstBookingAt: bookings[0]?.starts_at ?? null,
    },
    report: {
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
    },
  };
}
