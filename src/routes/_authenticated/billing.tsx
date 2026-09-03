import { createFileRoute } from "@tanstack/react-router";

import { PortalPage } from "@/components/app/portal-page";
import { formatMoney } from "@/lib/entitlements";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing | ERA App" },
      { name: "description", content: "Payments and invoices for your ERA subscription." },
      { property: "og:title", content: "Billing | ERA App" },
      { property: "og:description", content: "Payments and invoices for your ERA subscription." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  return (
    <PortalPage title="Billing" feature="payments" empty="No payments recorded yet.">
      {(ws) => (
        <div className="era-card overflow-hidden">
          <ul className="divide-y divide-border/60">
            {ws.payments.map((p) => (
              <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 p-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {formatMoney(p.amountCents)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="era-chip shrink-0">{p.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PortalPage>
  );
}
