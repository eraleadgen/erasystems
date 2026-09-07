import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PortalShell } from "@/components/app/portal-page";
import { StatTile } from "@/components/app/stat-tile";
import { formatMoney } from "@/lib/entitlements";
import { RANGES, RANGE_LABELS, type AnalyticsRange } from "@/lib/analytics";
import { getAnalyticsReport, listStatementMonths } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics | ERA App" },
      { name: "description", content: "Booking and revenue trends across your ERA system." },
      { property: "og:title", content: "Analytics | ERA App" },
      { property: "og:description", content: "Booking and revenue trends across your ERA system." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <PortalShell title="Analytics" feature="advanced_analytics">
      {() => <AnalyticsBody />}
    </PortalShell>
  );
}

function AnalyticsBody() {
  const [range, setRange] = useState<AnalyticsRange>("90d");
  const fetchReport = useServerFn(getAnalyticsReport);

  const report = useQuery({
    queryKey: ["analytics-report", range],
    queryFn: () => fetchReport({ data: { range } }),
    retry: false,
  });

  const data = report.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={
              r === range
                ? "era-ghost-button border-primary text-foreground"
                : "era-ghost-button text-muted-foreground"
            }
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      <StatementsCard />

      {report.isLoading || !data ? (
        <div className="era-card p-6">
          <p className="text-sm text-muted-foreground">Loading your numbers…</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Revenue"
              value={formatMoney(data.totals.revenueCents)}
              hint={
                data.totals.revenueChangePct === null
                  ? "completed jobs in this period"
                  : `${data.totals.revenueChangePct >= 0 ? "+" : ""}${data.totals.revenueChangePct}% vs previous period`
              }
            />
            <StatTile
              label="Completed jobs"
              value={data.totals.completedJobs}
              hint={`avg ticket ${formatMoney(data.totals.averageTicketCents)}`}
            />
            <StatTile
              label="Booked, not yet completed"
              value={formatMoney(data.totals.pipelineCents)}
              hint={`${data.totals.pipelineJobs} upcoming or pending`}
            />
            <StatTile
              label="Repeat rate"
              value={data.mix.repeatRatePct === null ? "—" : `${data.mix.repeatRatePct}%`}
              hint={`${data.mix.newCustomers} new customers`}
            />
          </div>

          <section className="era-card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Revenue trend
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Completed jobs only, grouped by {data.bucket === "day" ? "day" : "month"} in{" "}
              {data.timezone}.
            </p>
            {data.trend.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">
                No completed jobs in this period yet.
              </p>
            ) : (
              <div className="mt-6 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trend.map((t) => ({ ...t, revenue: t.revenueCents / 100 }))}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeOpacity={0.12} vertical={false} />
                    <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={64}
                      tickFormatter={(v: number) => `$${v.toLocaleString()}`}
                    />
                    <Tooltip
                      formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      className="text-primary"
                      stroke="currentColor"
                      fill="url(#revFill)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="era-card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Customer lifetime value
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <StatTile
                  label="Average"
                  value={formatMoney(data.clv.averageCents)}
                  hint={`${data.clv.customersCounted} customers with completed work`}
                />
                <StatTile
                  label="Median"
                  value={formatMoney(data.clv.medianCents)}
                  hint="less skewed by one large job"
                />
              </div>
              {data.clv.unattributedBookings > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {data.clv.unattributedBookings} booking
                  {data.clv.unattributedBookings === 1 ? "" : "s"} in this period aren&apos;t linked
                  to a customer record, so they aren&apos;t counted here.
                </p>
              )}
              <div className="mt-5 divide-y divide-border/50">
                {data.clv.top.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No completed work yet.</p>
                ) : (
                  data.clv.top.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-4 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.jobs} job{c.jobs === 1 ? "" : "s"}
                          {c.lastAt
                            ? ` · last ${new Date(c.lastAt).toLocaleDateString("en-US")}`
                            : ""}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatMoney(c.lifetimeCents)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="era-card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                New vs repeat
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <StatTile
                  label="New customer jobs"
                  value={data.mix.newBookings}
                  hint={formatMoney(data.mix.newRevenueCents)}
                />
                <StatTile
                  label="Repeat jobs"
                  value={data.mix.repeatBookings}
                  hint={formatMoney(data.mix.repeatRevenueCents)}
                />
              </div>
              <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${
                      data.mix.newBookings + data.mix.repeatBookings === 0
                        ? 0
                        : (data.mix.repeatBookings /
                            (data.mix.newBookings + data.mix.repeatBookings)) *
                          100
                    }%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Filled portion is repeat business. A booking counts as new when it is that
                customer&apos;s first ever with you.
              </p>
            </section>
          </div>

          <section className="era-card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Service performance
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Based on revenue and time booked. The system holds no cost figures, so this is
              earnings, not profit margin.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Service</th>
                    <th className="py-2 pr-4 font-medium">Jobs</th>
                    <th className="py-2 pr-4 font-medium">Revenue</th>
                    <th className="py-2 pr-4 font-medium">Avg ticket</th>
                    <th className="py-2 font-medium">Per hour</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {data.services.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2 pr-4 text-foreground">{s.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{s.bookings}</td>
                      <td className="py-2 pr-4 text-foreground">{formatMoney(s.revenueCents)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {formatMoney(s.averageTicketCents)}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {s.revenuePerHourCents ? formatMoney(s.revenuePerHourCents) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
