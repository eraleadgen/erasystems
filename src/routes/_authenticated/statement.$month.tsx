import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { formatMoney } from "@/lib/entitlements";
import { getMonthlyStatement } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/statement/$month")({
  head: () => ({
    meta: [
      { title: "Monthly statement | ERA App" },
      { name: "description", content: "Printable monthly performance statement for your business." },
      { property: "og:title", content: "Monthly statement | ERA App" },
      {
        property: "og:description",
        content: "Printable monthly performance statement for your business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: StatementPage,
});

function StatementPage() {
  const { month } = Route.useParams();
  const fetchStatement = useServerFn(getMonthlyStatement);
  const statement = useQuery({
    queryKey: ["monthly-statement", month],
    queryFn: () => fetchStatement({ data: { month } }),
    retry: false,
  });

  const s = statement.data;

  if (statement.isLoading) {
    return <p className="p-10 text-sm text-muted-foreground">Preparing your statement…</p>;
  }
  if (!s) {
    return <p className="p-10 text-sm text-muted-foreground">This statement isn&apos;t available.</p>;
  }

  const t = s.report.totals;

  return (
    <main className="mx-auto max-w-3xl bg-background p-10 text-foreground print:p-0">
      <div className="mb-6 flex items-start justify-between gap-6 border-b border-border pb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Monthly statement
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{s.business.name}</h1>
          <p className="text-sm text-muted-foreground">
            {s.monthLabel} · {s.report.timezone}
          </p>
        </div>
        <div className="text-right">
          {s.business.logoUrl ? (
            <img src={s.business.logoUrl} alt="" className="ml-auto h-12 w-auto" />
          ) : null}
          <button
            type="button"
            onClick={() => window.print()}
            className="era-ghost-button mt-3 print:hidden"
          >
            Print / save PDF
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Figure label="Revenue" value={formatMoney(t.revenueCents)} />
        <Figure label="Completed jobs" value={String(t.completedJobs)} />
        <Figure label="Average ticket" value={formatMoney(t.averageTicketCents)} />
        <Figure
          label="vs prior month"
          value={t.revenueChangePct === null ? "—" : `${t.revenueChangePct >= 0 ? "+" : ""}${t.revenueChangePct}%`}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Revenue by day
        </h2>
        {s.report.trend.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No completed jobs this month.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-border/50">
              {s.report.trend.map((d) => (
                <tr key={d.key}>
                  <td className="py-1.5 text-muted-foreground">{d.label}</td>
                  <td className="py-1.5 text-muted-foreground">
                    {d.jobs} job{d.jobs === 1 ? "" : "s"}
                  </td>
                  <td className="py-1.5 text-right">{formatMoney(d.revenueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Customer value
          </h2>
          <p className="mt-2 text-sm">Average lifetime {formatMoney(s.report.clv.averageCents)}</p>
          <p className="text-sm">Median lifetime {formatMoney(s.report.clv.medianCents)}</p>
          <p className="text-sm text-muted-foreground">
            {s.report.clv.customersCounted} customers with completed work
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {s.report.clv.top.slice(0, 5).map((c) => (
              <li key={c.id} className="flex justify-between gap-4">
                <span className="truncate">{c.name}</span>
                <span>{formatMoney(c.lifetimeCents)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            New vs repeat
          </h2>
          <p className="mt-2 text-sm">
            {s.report.mix.newBookings} new-customer jobs ({formatMoney(s.report.mix.newRevenueCents)}
            )
          </p>
          <p className="text-sm">
            {s.report.mix.repeatBookings} repeat jobs (
            {formatMoney(s.report.mix.repeatRevenueCents)})
          </p>
          <p className="text-sm text-muted-foreground">
            Repeat rate {s.report.mix.repeatRatePct === null ? "—" : `${s.report.mix.repeatRatePct}%`}
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Service performance
        </h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <th className="py-1.5 pr-4 font-medium">Service</th>
              <th className="py-1.5 pr-4 font-medium">Jobs</th>
              <th className="py-1.5 pr-4 font-medium">Revenue</th>
              <th className="py-1.5 pr-4 font-medium">Avg ticket</th>
              <th className="py-1.5 font-medium">Per hour</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {s.report.services.map((row) => (
              <tr key={row.id}>
                <td className="py-1.5 pr-4">{row.name}</td>
                <td className="py-1.5 pr-4 text-muted-foreground">{row.bookings}</td>
                <td className="py-1.5 pr-4">{formatMoney(row.revenueCents)}</td>
                <td className="py-1.5 pr-4 text-muted-foreground">
                  {formatMoney(row.averageTicketCents)}
                </td>
                <td className="py-1.5 text-muted-foreground">
                  {row.revenuePerHourCents ? formatMoney(row.revenuePerHourCents) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        <p>
          Revenue counts completed jobs only; cancelled and no-show jobs are excluded, and work
          booked but not yet completed is shown separately in Analytics
          {t.pipelineJobs ? ` (${formatMoney(t.pipelineCents)} across ${t.pipelineJobs} jobs)` : ""}.
          Per-hour figures are earnings, not profit margin.
        </p>
        <p className="mt-1">
          Generated {new Date(s.generatedAt).toLocaleString("en-US")} from live booking data.
        </p>
      </footer>
    </main>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
