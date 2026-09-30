import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BusinessLifecycle = "pending_payment" | "active" | "suspended" | "expired";

export type MyBusiness = {
  id: string;
  name: string;
  slug: string;
  /** Custom hostname mapped to this business, when one has been connected. */
  primaryDomain: string | null;
  timezone: string;
  planTier: string;
  isActive: boolean;
  lifecycle: BusinessLifecycle;
  slugReservedUntil: string | null;
  createdAt: string;
  serviceCount: number;
  role: string;
};


/**
 * The caller's own business, resolved through their membership row. RLS-scoped —
 * no admin client — so a user can only ever see a business they belong to.
 */
export const getMyBusiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const as = (raw as { asBusinessId?: unknown } | undefined)?.asBusinessId;
    return typeof as === "string" && /^[0-9a-f-]{36}$/i.test(as) ? { asBusinessId: as } : {};
  })
  .handler(async ({ context, data: input }): Promise<MyBusiness | null> => {
    // Staff "view as client": only platform staff may open another business's
    // portal; reads still go through the caller's RLS-scoped client.
    let membership: { business_id: string; role: string } | null = null;
    if ("asBusinessId" in input && input.asBusinessId) {
      const { data: isStaff } = await context.supabase.rpc("is_platform_staff");
      if (!isStaff) throw new Error("Not authorized");
      membership = { business_id: input.asBusinessId, role: "staff view" };
    } else {
      const { data: m } = await context.supabase
        .from("business_members")
        .select("business_id, role")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      membership = m;
    }

    if (!membership) return null;

    const { data: business, error } = await context.supabase
      .from("businesses")
      .select("id, name, slug, timezone, plan_tier, is_active, lifecycle, slug_reserved_until, created_at")
      .eq("id", membership.business_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!business) return null;

    const { count } = await context.supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id);

    const { data: domains } = await context.supabase
      .from("business_domains")
      .select("hostname, is_primary, verified_at")
      .eq("business_id", business.id)
      .order("is_primary", { ascending: false });

    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      primaryDomain: domains?.[0]?.hostname ?? null,
      timezone: business.timezone,
      planTier: business.plan_tier,
      isActive: business.is_active,
      lifecycle: business.lifecycle as BusinessLifecycle,
      slugReservedUntil: business.slug_reserved_until,
      createdAt: business.created_at,
      serviceCount: count ?? 0,
      role: membership.role,
    };
  });


export type AccountRouting = {
  isStaff: boolean;
  hasBusiness: boolean;
};

/**
 * Where an account belongs after sign-in. Staff live in the ERA agency console,
 * clients live in their business dashboard. Both checks are RLS-scoped.
 */
export const getAccountRouting = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountRouting> => {
    const { data: isStaff } = await context.supabase.rpc("is_platform_staff");
    const { count } = await context.supabase
      .from("business_members")
      .select("business_id", { count: "exact", head: true })
      .eq("user_id", context.userId);
    return { isStaff: Boolean(isStaff), hasBusiness: (count ?? 0) > 0 };
  });

export type BusinessSummary = {
  id: string;
  name: string;
  slug: string;
  planTier: string;
  lifecycle: BusinessLifecycle;
  isActive: boolean;
  /** Client-visible build lights already flipped to live. */
  liveItems: number;
  /** Client-visible build lights still pending or in progress. */
  pendingItems: number;
  /** Go-live checklist steps not yet done. */
  openTasks: number;
};


/**
 * Businesses visible to the caller. RLS decides the scope: platform staff see
 * every business, anyone else sees only the ones they belong to.
 */
export const listVisibleBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BusinessSummary[]> => {
    const { data: isStaff } = await context.supabase.rpc("is_platform_staff");

    let ids: string[] | null = null;
    if (!isStaff) {
      const { data: memberships } = await context.supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", context.userId);
      ids = (memberships ?? []).map((m) => m.business_id);
      if (ids.length === 0) return [];
    }

    let query = context.supabase
      .from("businesses")
      .select("id, name, slug, plan_tier, lifecycle, is_active")
      .order("created_at", { ascending: true });
    if (ids) query = query.in("id", ids);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const businessIds = (data ?? []).map((b) => b.id);
    if (businessIds.length === 0) return [];

    // Readiness counters, scoped to exactly the businesses this caller can see.
    const [statuses, tasks] = await Promise.all([
      context.supabase
        .from("business_launch_status")
        .select("business_id, status")
        .in("business_id", businessIds),
      context.supabase
        .from("client_delivery_tasks")
        .select("business_id, status")
        .in("business_id", businessIds),
    ]);

    return (data ?? []).map((b) => {
      const rows = (statuses.data ?? []).filter((r) => r.business_id === b.id);
      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        planTier: b.plan_tier,
        lifecycle: b.lifecycle as BusinessLifecycle,
        isActive: b.is_active,
        liveItems: rows.filter((r) => r.status === "live").length,
        pendingItems: rows.filter((r) => r.status !== "live").length,
        openTasks: (tasks.data ?? []).filter(
          (t) => t.business_id === b.id && t.status !== "done",
        ).length,
      };
    });
  });
