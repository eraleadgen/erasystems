import { createFileRoute } from "@tanstack/react-router";

import { PortalPage } from "@/components/app/portal-page";
import { StatTile } from "@/components/app/stat-tile";
import { formatMoney } from "@/lib/entitlements";

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
    <PortalPage title="Analytics" feature="advanced_analytics" empty="Not enough data yet.">
      {(ws) => {
        const completed = ws.bookings.filter((b) => b.status === "completed");
        const revenue = completed.reduce((sum, b) => sum + b.totalCents, 0);
        const avg = completed.length ? Math.round(revenue / completed.length) : 0;

        return (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Bookings" value={ws.bookings.length} hint="last 50 records" />
            <StatTile label="Completed" value={completed.length} />
            <StatTile label="Revenue" value={formatMoney(revenue)} hint="completed bookings" />
            <StatTile label="Average ticket" value={formatMoney(avg)} />
          </div>
        );
      }}
    </PortalPage>
  );
}
