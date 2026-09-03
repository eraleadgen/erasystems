import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PortalWorkspace = {
  businessId: string;
  services: { id: string; name: string; basePriceCents: number; durationMinutes: number; isActive: boolean }[];
  bookings: {
    id: string;
    customerName: string;
    startsAt: string;
    status: string;
    totalCents: number;
  }[];
  team: { id: string; role: string; userId: string }[];
  payments: { id: string; status: string; amountCents: number; createdAt: string }[];
};

/**
 * Working data for the caller's own business. Every read goes through the
 * caller's RLS-scoped client and is explicitly business_id scoped, so a member
 * only ever sees their own tenant's rows.
 */
export const getPortalWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalWorkspace | null> => {
    const { data: membership } = await context.supabase
      .from("business_members")
      .select("business_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!membership) return null;

    const businessId = membership.business_id;

    const [services, bookings, team, payments] = await Promise.all([
      context.supabase
        .from("services")
        .select("id, name, base_price_cents, duration_minutes, is_active")
        .eq("business_id", businessId)
        .order("sort_order", { ascending: true }),
      context.supabase
        .from("bookings")
        .select("id, customer_name, starts_at, status, total_cents")
        .eq("business_id", businessId)
        .order("starts_at", { ascending: false })
        .limit(50),
      context.supabase
        .from("business_members")
        .select("id, role, user_id")
        .eq("business_id", businessId),
      context.supabase
        .from("payments")
        .select("id, status, amount_cents, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    return {
      businessId,
      services: (services.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        basePriceCents: s.base_price_cents,
        durationMinutes: s.duration_minutes,
        isActive: s.is_active,
      })),
      bookings: (bookings.data ?? []).map((b) => ({
        id: b.id,
        customerName: b.customer_name,
        startsAt: b.starts_at,
        status: b.status,
        totalCents: b.total_cents,
      })),
      team: (team.data ?? []).map((m) => ({ id: m.id, role: m.role, userId: m.user_id })),
      payments: (payments.data ?? []).map((p) => ({
        id: p.id,
        status: p.status,
        amountCents: p.amount_cents,
        createdAt: p.created_at,
      })),
    };
  });
