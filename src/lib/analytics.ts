/** Shared analytics types and labels. Client-safe: no server imports. */

export const RANGES = ["30d", "90d", "12m", "ytd"] as const;
export type AnalyticsRange = (typeof RANGES)[number];

export const RANGE_LABELS: Record<AnalyticsRange, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "12m": "Last 12 months",
  ytd: "Year to date",
};

export type AnalyticsReport = {
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

/** A calendar month a statement can be produced for, e.g. "2026-08". */
export type StatementMonth = { key: string; label: string };

export type MonthlyStatement = {
  month: string;
  monthLabel: string;
  generatedAt: string;
  business: { name: string; logoUrl: string | null; primary: string | null };
  report: AnalyticsReport;
};

export function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
