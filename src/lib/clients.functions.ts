import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AddonKind, PlanTier } from "./entitlements";

const businessIdInput = z.object({ businessId: z.string().uuid() });

export type ProvisioningState = {
  requestedDomain: string;
  domainStatus: string;
  a2pRequired: boolean;
  a2pStatus: string;
  a2pNotes: string;
  websiteUrl: string;
  websiteStatus: string;
  overviewNotes: string;
  completedAt: string | null;
};

export type ClientProfile = {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  planTier: PlanTier;
  lifecycle: string;
  isActive: boolean;
  timezone: string;
  supportEmail: string | null;
  supportPhone: string | null;
  createdAt: string;
  /** Connected custom hostname, when one has been mapped to this account. */
  primaryDomain: string | null;
  domains: { hostname: string; isPrimary: boolean; verifiedAt: string | null }[];
  /** Who has access to this account, from business_members. */
  members: { userId: string; role: string; createdAt: string }[];
  /** Signed terms captured on the invite this account came from. */
  membership: {
    email: string;
    fullName: string;
    billingInterval: string;
    subscriptionPriceCents: number;
    setupFeeCents: number;
    acceptedAt: string | null;
  } | null;
  addons: { addon: AddonKind; isActive: boolean; priceCents: number }[];
  services: { id: string; name: string; basePriceCents: number }[];
  payments: { id: string; status: string; amountCents: number; createdAt: string }[];
  provisioning: ProvisioningState;
};

const EMPTY_PROVISIONING: ProvisioningState = {
  requestedDomain: "",
  domainStatus: "not_started",
  a2pRequired: false,
  a2pStatus: "not_started",
  a2pNotes: "",
  websiteUrl: "",
  websiteStatus: "not_started",
  overviewNotes: "",
  completedAt: null,
};

/**
 * Everything staff need to finish a paid client's build. Every read goes through
 * the caller's RLS-scoped client: `client_provisioning` is staff-only, and the
 * other tables already scope to members or platform staff. No elevated client.
 */
export const getClientProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessIdInput.parse(input))
  .handler(async ({ data, context }): Promise<ClientProfile | null> => {
    const { data: business, error } = await context.supabase
      .from("businesses")
      .select(
        "id, name, legal_name, slug, plan_tier, lifecycle, is_active, timezone, support_email, support_phone, created_at",
      )
      .eq("id", data.businessId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) return null;

    const [addons, services, payments, provisioning] = await Promise.all([
      context.supabase
        .from("business_addons")
        .select("addon, is_active, price_cents")
        .eq("business_id", business.id),
      context.supabase
        .from("services")
        .select("id, name, base_price_cents")
        .eq("business_id", business.id)
        .order("sort_order", { ascending: true }),
      context.supabase
        .from("payments")
        .select("id, status, amount_cents, created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(10),
      context.supabase
        .from("client_provisioning")
        .select("*")
        .eq("business_id", business.id)
        .maybeSingle(),
    ]);

    const row = provisioning.data;

    return {
      id: business.id,
      name: business.name,
      legalName: business.legal_name,
      slug: business.slug,
      planTier: business.plan_tier as PlanTier,
      lifecycle: business.lifecycle,
      isActive: business.is_active,
      timezone: business.timezone,
      supportEmail: business.support_email,
      supportPhone: business.support_phone,
      createdAt: business.created_at,
      addons: (addons.data ?? []).map((a) => ({
        addon: a.addon as AddonKind,
        isActive: a.is_active,
        priceCents: a.price_cents,
      })),
      services: (services.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        basePriceCents: s.base_price_cents,
      })),
      payments: (payments.data ?? []).map((p) => ({
        id: p.id,
        status: p.status,
        amountCents: p.amount_cents,
        createdAt: p.created_at,
      })),
      provisioning: row
        ? {
            requestedDomain: row.requested_domain ?? "",
            domainStatus: row.domain_status,
            a2pRequired: row.a2p_required,
            a2pStatus: row.a2p_status,
            a2pNotes: row.a2p_notes ?? "",
            websiteUrl: row.website_url ?? "",
            websiteStatus: row.website_status,
            overviewNotes: row.overview_notes ?? "",
            completedAt: row.completed_at,
          }
        : EMPTY_PROVISIONING,
    };
  });

const saveInput = z.object({
  businessId: z.string().uuid(),
  requestedDomain: z.string().max(200),
  domainStatus: z.enum(["not_started", "in_progress", "live"]),
  a2pRequired: z.boolean(),
  a2pStatus: z.enum(["not_started", "submitted", "approved", "not_applicable"]),
  a2pNotes: z.string().max(2000),
  websiteUrl: z.string().max(300),
  websiteStatus: z.enum(["not_started", "in_progress", "live"]),
  overviewNotes: z.string().max(4000),
  markComplete: z.boolean(),
});

/**
 * Staff-entered provisioning state. Authorization is the RLS policy
 * `is_platform_staff()` on client_provisioning: a client writing here gets a
 * policy violation, not a silent success.
 */
export const saveClientProvisioning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_provisioning").upsert(
      {
        business_id: data.businessId,
        requested_domain: data.requestedDomain || null,
        domain_status: data.domainStatus,
        a2p_required: data.a2pRequired,
        a2p_status: data.a2pStatus,
        a2p_notes: data.a2pNotes || null,
        website_url: data.websiteUrl || null,
        website_status: data.websiteStatus,
        overview_notes: data.overviewNotes || null,
        completed_at: data.markComplete ? new Date().toISOString() : null,
      },
      { onConflict: "business_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
