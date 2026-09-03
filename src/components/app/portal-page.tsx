import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { buildClientNav } from "@/components/app/client-nav";
import {
  getMyPortalContext,
  getPortalWorkspace,
  type PortalWorkspace,
} from "@/lib/portal.functions";
import type { PlatformFeature } from "@/lib/entitlements";

/**
 * Shared frame for every entitlement-gated client tab: same shell, same nav,
 * same gate. Access is still enforced server side by the RLS-scoped reads.
 */
export function PortalPage({
  title,
  feature,
  empty,
  children,
}: {
  title: string;
  feature: PlatformFeature;
  empty: string;
  children: (workspace: PortalWorkspace) => ReactNode;
}) {
  const fetchContext = useServerFn(getMyPortalContext);
  const fetchWorkspace = useServerFn(getPortalWorkspace);

  const { data: hasSession } = useQuery({
    queryKey: ["has-session"],
    queryFn: async () => Boolean((await supabase.auth.getSession()).data.session),
    retry: false,
  });

  const entitlements = useQuery({
    queryKey: ["my-portal-context"],
    queryFn: () => fetchContext(),
    enabled: hasSession === true,
    retry: false,
  });

  const workspace = useQuery({
    queryKey: ["portal-workspace"],
    queryFn: () => fetchWorkspace(),
    enabled: hasSession === true,
    retry: false,
  });

  const features = entitlements.data?.features ?? [];
  const nav = buildClientNav(features);
  const allowed = features.includes(feature);

  return (
    <AppShell title={title} navItems={nav}>
      {!allowed ? (
        <div className="era-card p-6">
          <p className="text-sm text-muted-foreground">
            {title} is part of a higher plan. Your ERA representative can add it to your account.
          </p>
        </div>
      ) : workspace.isLoading ? (
        <div className="era-card p-6">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      ) : !workspace.data ||
        (workspace.data && isEmpty(workspace.data, feature)) ? (
        <div className="era-card p-6">
          <p className="text-sm text-muted-foreground">{empty}</p>
        </div>
      ) : (
        children(workspace.data)
      )}
    </AppShell>
  );
}

function isEmpty(ws: PortalWorkspace, feature: PlatformFeature) {
  if (feature === "payments") return ws.payments.length === 0;
  if (feature === "specialist_portal") return ws.team.length === 0;
  return false;
}
