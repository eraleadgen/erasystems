import { createFileRoute } from "@tanstack/react-router";

import { PortalPage } from "@/components/app/portal-page";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers | ERA App" },
      { name: "description", content: "Customer records captured by your ERA system." },
      { property: "og:title", content: "Customers | ERA App" },
      { property: "og:description", content: "Customer records captured by your ERA system." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  return (
    <PortalPage title="Customers" feature="customer_portal" empty="No customers yet.">
      {(ws) => {
        const seen = new Map<string, { name: string; last: string; visits: number }>();
        for (const b of ws.bookings) {
          const entry = seen.get(b.customerName);
          if (entry) entry.visits += 1;
          else seen.set(b.customerName, { name: b.customerName, last: b.startsAt, visits: 1 });
        }
        const customers = [...seen.values()];

        return customers.length === 0 ? (
          <div className="era-card p-6">
            <p className="text-sm text-muted-foreground">
              No customers yet. Everyone who books through your site appears here.
            </p>
          </div>
        ) : (
          <div className="era-card overflow-hidden">
            <ul className="divide-y divide-border/60">
              {customers.map((c) => (
                <li key={c.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 p-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Last visit {new Date(c.last).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="era-chip shrink-0">{c.visits} bookings</span>
                </li>
              ))}
            </ul>
          </div>
        );
      }}
    </PortalPage>
  );
}
