import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BusinessProfile = {
  id: string;
  name: string;
  legalName: string;
  slug: string;
  timezone: string;
  supportEmail: string;
  supportPhone: string;
  brandPrimary: string;
  brandAccent: string;
  planTier: string;
  lifecycle: string;
  /** Custom hostname mapped to this business, when one has been connected. */
  primaryDomain: string | null;
  /** Whether the caller may edit; owners and admins can, everyone else reads. */
  canEdit: boolean;
};

/**
 * The caller's own business information. RLS-scoped through their membership,
 * with an explicit business_id filter, so no other tenant is reachable.
 */
export const getMyBusinessProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BusinessProfile | null> => {
    const { data: membership } = await context.supabase
      .from("business_members")
      .select("business_id, role")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!membership) return null;

    const { data: business, error } = await context.supabase
      .from("businesses")
      .select(
        "id, name, legal_name, slug, timezone, support_email, support_phone, brand_primary, brand_accent, plan_tier, lifecycle",
      )
      .eq("id", membership.business_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) return null;

    const { data: domains } = await context.supabase
      .from("business_domains")
      .select("hostname, is_primary")
      .eq("business_id", business.id)
      .order("is_primary", { ascending: false });

    return {
      id: business.id,
      name: business.name,
      legalName: business.legal_name ?? "",
      slug: business.slug,
      timezone: business.timezone,
      supportEmail: business.support_email ?? "",
      supportPhone: business.support_phone ?? "",
      brandPrimary: business.brand_primary ?? "",
      brandAccent: business.brand_accent ?? "",
      planTier: business.plan_tier,
      lifecycle: business.lifecycle,
      primaryDomain: domains?.[0]?.hostname ?? null,
      canEdit: membership.role === "owner" || membership.role === "admin",
    };
  });

const updateInput = z.object({
  name: z.string().trim().min(1).max(120),
  legalName: z.string().trim().max(160),
  timezone: z.string().trim().min(1).max(60),
  supportEmail: z.string().trim().max(160),
  supportPhone: z.string().trim().max(40),
  brandPrimary: z.string().trim().max(20),
  brandAccent: z.string().trim().max(20),
});

/**
 * Update the caller's own business. The tenant id comes from their membership
 * row, never from the client, and the write still passes the RLS manager
 * policy on businesses, so a non-manager gets a policy violation.
 */
export const updateMyBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: membership } = await context.supabase
      .from("business_members")
      .select("business_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!membership) throw new Error("No business is linked to your account yet.");

    const { error } = await context.supabase
      .from("businesses")
      .update({
        name: data.name,
        legal_name: data.legalName || null,
        timezone: data.timezone,
        support_email: data.supportEmail || null,
        support_phone: data.supportPhone || null,
        brand_primary: data.brandPrimary || null,
        brand_accent: data.brandAccent || null,
      })
      .eq("id", membership.business_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
