import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppShell } from "@/components/app/app-shell";
import { getAccountRouting } from "@/lib/business.functions";

/**
 * Agency console gate. Sign-in is already enforced by the `_authenticated`
 * layout; this adds the platform-staff check so a signed-in client who guesses
 * an /admin URL sees a plain refusal instead of the console shell. Data access
 * is still enforced server side by the staff RLS policies.
 */
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminGate,
});

function AdminGate() {
  const fetchRouting = useServerFn(getAccountRouting);
  const routing = useQuery({
    queryKey: ["account-routing"],
    queryFn: () => fetchRouting(),
    retry: false,
  });

  if (routing.isLoading) {
    return (
      <AppShell title="ERA agency console" variant="staff">
        <div className="era-card p-6">
          <p className="text-sm text-muted-foreground">Checking access…</p>
        </div>
      </AppShell>
    );
  }

  if (!routing.data?.isStaff) {
    return (
      <AppShell title="ERA agency console" variant="staff">
        <div className="era-card p-6">
          <h1 className="text-base font-semibold">Not authorized</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The agency console is limited to ERA staff accounts. If you manage a business on
            ERA, your workspace is at <a className="underline" href="/dashboard">your dashboard</a>.
          </p>
        </div>
      </AppShell>
    );
  }

  return <Outlet />;
}
