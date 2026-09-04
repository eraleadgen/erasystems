import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { listVisibleBusinesses } from "@/lib/business.functions";

export const Route = createFileRoute("/admin/clients/")({
  head: () => ({
    meta: [
      { title: "Clients | ERA Systems" },
      {
        name: "description",
        content:
          "Platform staff review every ERA client account and finish provisioning domain, A2P, website and launch overview.",
      },
      { property: "og:title", content: "Clients | ERA Systems" },
      {
        property: "og:description",
        content: "Every ERA client account and its provisioning status in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ClientsAdmin,
});

const LIFECYCLE_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  active: "Active",
  suspended: "Suspended",
  expired: "Expired",
};

function ClientsAdmin() {
  const fetchBusinesses = useServerFn(listVisibleBusinesses);

  const { data: hasSession } = useQuery({
    queryKey: ["has-session"],
    queryFn: async () => Boolean((await supabase.auth.getSession()).data.session),
    retry: false,
  });

  const businessesQuery = useQuery({
    queryKey: ["visible-businesses"],
    queryFn: () => fetchBusinesses(),
    enabled: hasSession === true,
    retry: false,
  });

  if (hasSession === false) {
    return (
      <AppShell title="Clients" variant="staff">
        <div className="era-card p-6">
          <p className="text-sm text-muted-foreground">Sign in with your ERA staff account.</p>
        </div>
      </AppShell>
    );
  }

  const businesses = businessesQuery.data ?? [];

  return (
    <AppShell title="Clients" variant="staff">
      <div className="era-card overflow-hidden">
        <div className="border-b border-border/60 p-5">
          <h2 className="text-base font-semibold">Client accounts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open a paid account to finish the build: domain, A2P registration, customer website and
            the launch overview.
          </p>
        </div>
        {businessesQuery.isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : businesses.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No client accounts yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {businesses.map((b) => (
              <li key={b.id}>
                <Link
                  to="/admin/clients/$businessId"
                  params={{ businessId: b.id }}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-5 transition hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      /{b.slug} · {b.planTier}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {b.liveItems} live
                      {b.pendingItems > 0 ? ` · ${b.pendingItems} pending` : ""}
                      {b.openTasks > 0 ? ` · ${b.openTasks} steps open` : " · checklist clear"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
                    {LIFECYCLE_LABEL[b.lifecycle] ?? b.lifecycle}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
