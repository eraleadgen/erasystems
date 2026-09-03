import { createFileRoute } from "@tanstack/react-router";

import { PortalPage } from "@/components/app/portal-page";
import { formatMoney } from "@/lib/entitlements";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings | ERA App" },
      { name: "description", content: "Every booking captured by your ERA system." },
      { property: "og:title", content: "Bookings | ERA App" },
      { property: "og:description", content: "Every booking captured by your ERA system." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BookingsPage,
});

function BookingsPage() {
  return (
    <PortalPage title="Bookings" feature="core_engines" empty="No bookings yet.">
      {(ws) =>
        ws.bookings.length === 0 ? (
          <div className="era-card p-6">
            <p className="text-sm text-muted-foreground">
              No bookings yet. New enquiries land here automatically.
            </p>
          </div>
        ) : (
          <div className="era-card overflow-hidden">
            <ul className="divide-y divide-border/60">
              {ws.bookings.map((b) => (
                <li
                  key={b.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{b.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.startsAt).toLocaleString()} · {b.status}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-foreground">
                    {formatMoney(b.totalCents)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      }
    </PortalPage>
  );
}
