import { createFileRoute } from "@tanstack/react-router";

import { PortalPage } from "@/components/app/portal-page";
import { formatMoney } from "@/lib/entitlements";

export const Route = createFileRoute("/_authenticated/catalog")({
  head: () => ({
    meta: [
      { title: "Catalog | ERA App" },
      { name: "description", content: "Services and pricing in your ERA business catalog." },
      { property: "og:title", content: "Catalog | ERA App" },
      { property: "og:description", content: "Services and pricing in your ERA business catalog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  return (
    <PortalPage title="Catalog" feature="core_engines" empty="No services yet.">
      {(ws) => (
        <div className="era-card overflow-hidden">
          <ul className="divide-y divide-border/60">
            {ws.services.map((s) => (
              <li
                key={s.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.durationMinutes} min</p>
                </div>
                <span className="shrink-0 text-sm text-foreground">
                  {formatMoney(s.basePriceCents)}
                </span>
              </li>
            ))}
            {ws.services.length === 0 && (
              <li className="p-5 text-sm text-muted-foreground">No services yet.</li>
            )}
          </ul>
        </div>
      )}
    </PortalPage>
  );
}
