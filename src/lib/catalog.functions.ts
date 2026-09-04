import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Catalog writes for the caller's own business. Every statement runs through
 * the caller's RLS-scoped client and is explicitly business_id scoped, so the
 * "managers insert/update/delete services" policies are the security boundary.
 * Anything marked active here is what the public tenant site renders.
 */

type ServiceInput = {
  name: string;
  description: string;
  basePriceCents: number;
  durationMinutes: number;
  isActive: boolean;
};

function validate(input: Partial<ServiceInput>): ServiceInput {
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("Service name is required");
  const basePriceCents = Math.round(Number(input.basePriceCents ?? 0));
  const durationMinutes = Math.round(Number(input.durationMinutes ?? 0));
  if (!Number.isFinite(basePriceCents) || basePriceCents < 0) {
    throw new Error("Price must be zero or more");
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error("Duration must be at least one minute");
  }
  return {
    name,
    description: String(input.description ?? "").trim(),
    basePriceCents,
    durationMinutes,
    isActive: input.isActive !== false,
  };
}

async function requireManagedBusiness(context: {
  supabase: any;
  userId: string;
}): Promise<string> {
  const { data: membership } = await context.supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", context.userId)
    .in("role", ["owner", "admin"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) throw new Error("Only an owner or admin can change the catalog");
  return membership.business_id as string;
}

export const createService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<ServiceInput>) => validate(input))
  .handler(async ({ data, context }) => {
    const businessId = await requireManagedBusiness(context);

    const { data: last } = await context.supabase
      .from("services")
      .select("sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await context.supabase.from("services").insert({
      business_id: businessId,
      name: data.name,
      description: data.description || null,
      base_price_cents: data.basePriceCents,
      duration_minutes: data.durationMinutes,
      is_active: data.isActive,
      sort_order: (last?.sort_order ?? 0) + 1,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<ServiceInput> & { id: string }) => ({
    id: String(input.id),
    ...validate(input),
  }))
  .handler(async ({ data, context }) => {
    const businessId = await requireManagedBusiness(context);
    const { error } = await context.supabase
      .from("services")
      .update({
        name: data.name,
        description: data.description || null,
        base_price_cents: data.basePriceCents,
        duration_minutes: data.durationMinutes,
        is_active: data.isActive,
      })
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setServiceActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; isActive: boolean }) => ({
    id: String(input.id),
    isActive: Boolean(input.isActive),
  }))
  .handler(async ({ data, context }) => {
    const businessId = await requireManagedBusiness(context);
    const { error } = await context.supabase
      .from("services")
      .update({ is_active: data.isActive })
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    const businessId = await requireManagedBusiness(context);
    const { error } = await context.supabase
      .from("services")
      .delete()
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
