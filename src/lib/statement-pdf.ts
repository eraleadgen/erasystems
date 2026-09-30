import { formatMoney } from "@/lib/entitlements";

type Statement = Awaited<
  ReturnType<typeof import("@/lib/analytics.functions").getMonthlyStatement>
>;

/** Builds the monthly statement as a PDF in the browser and downloads it. */
export async function downloadStatementPdf(s: NonNullable<Statement>, monthKey: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;
  const t = s.report.totals;
  const clean = (v: string) => v.replace(/[^\x20-\x7E]/g, "-");

  const ensure = (h: number) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };
  const heading = (text: string) => {
    ensure(40);
    y += 18;
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(15, 118, 110);
    doc.text(text.toUpperCase(), M, y);
    y += 6;
    doc.setDrawColor(220).line(M, y, W - M, y);
    y += 14;
    doc.setTextColor(20);
  };
  const row = (cols: string[], xs: number[], bold = false) => {
    ensure(16);
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(10);
    cols.forEach((c, i) => {
      const x = xs[i]!;
      const right = i === cols.length - 1 && xs.length > 1;
      doc.text(clean(c), right ? W - M : x, y, right ? { align: "right" } : undefined);
    });
    y += 15;
  };

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
  doc.text("MONTHLY STATEMENT", M, y);
  y += 22;
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(20);
  doc.text(clean(s.business.name), M, y);
  y += 16;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(110);
  doc.text(clean(`${s.monthLabel} - ${s.report.timezone}`), M, y);
  y += 20;

  const figs: [string, string][] = [
    ["Revenue", formatMoney(t.revenueCents)],
    ["Completed jobs", String(t.completedJobs)],
    ["Average ticket", formatMoney(t.averageTicketCents)],
    [
      "vs prior month",
      t.revenueChangePct === null ? "-" : `${t.revenueChangePct >= 0 ? "+" : ""}${t.revenueChangePct}%`,
    ],
  ];
  const bw = (W - 2 * M - 30) / 4;
  figs.forEach(([l, v], i) => {
    const x = M + i * (bw + 10);
    doc.setDrawColor(220).roundedRect(x, y, bw, 50, 4, 4);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(110).text(l.toUpperCase(), x + 8, y + 16);
    doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(20).text(clean(v), x + 8, y + 38);
  });
  y += 62;

  heading("Revenue by day");
  if (s.report.trend.length === 0) row(["No completed jobs this month."], [M]);
  else
    for (const d of s.report.trend)
      row([d.label, `${d.jobs} job${d.jobs === 1 ? "" : "s"}`, formatMoney(d.revenueCents)], [M, M + 200, 0]);

  heading("Customer value");
  row([`Average lifetime ${formatMoney(s.report.clv.averageCents)}`], [M]);
  row([`Median lifetime ${formatMoney(s.report.clv.medianCents)}`], [M]);
  row([`${s.report.clv.customersCounted} customers with completed work`], [M]);
  for (const c of s.report.clv.top.slice(0, 5)) row([c.name, formatMoney(c.lifetimeCents)], [M, 0]);

  heading("New vs repeat");
  row([`${s.report.mix.newBookings} new-customer jobs (${formatMoney(s.report.mix.newRevenueCents)})`], [M]);
  row([`${s.report.mix.repeatBookings} repeat jobs (${formatMoney(s.report.mix.repeatRevenueCents)})`], [M]);
  row([`Repeat rate ${s.report.mix.repeatRatePct === null ? "-" : `${s.report.mix.repeatRatePct}%`}`], [M]);

  heading("Service performance");
  const xs = [M, M + 200, M + 250, M + 340, 0];
  row(["Service", "Jobs", "Revenue", "Avg ticket", "Per hour"], xs, true);
  for (const r of s.report.services)
    row(
      [
        r.name.length > 34 ? `${r.name.slice(0, 33)}...` : r.name,
        String(r.bookings),
        formatMoney(r.revenueCents),
        formatMoney(r.averageTicketCents),
        r.revenuePerHourCents ? formatMoney(r.revenuePerHourCents) : "-",
      ],
      xs,
    );

  ensure(60);
  y += 16;
  doc.setDrawColor(220).line(M, y, W - M, y);
  y += 14;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(110);
  const note = doc.splitTextToSize(
    clean(
      `Revenue counts completed jobs only; cancelled and no-show jobs are excluded${
        t.pipelineJobs ? `, and booked-but-not-completed work (${formatMoney(t.pipelineCents)} across ${t.pipelineJobs} jobs) is shown separately in Analytics` : ""
      }. Per-hour figures are earnings, not profit margin. Generated ${new Date(s.generatedAt).toLocaleString("en-US")} from live booking data.`,
    ),
    W - 2 * M,
  );
  doc.text(note, M, y);

  const slug = s.business.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  doc.save(`${slug || "statement"}-statement-${monthKey}.pdf`);
}
