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
  /** Partner-network code this client shares, and how many bookings it produced. */
  referral: { code: string; isActive: boolean; sentCount: number } | null;
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
        "id, name, legal_name, slug, plan_tier, lifecycle, is_active, timezone, support_email, support_phone, created_at, origin_invite_id",
      )
      .eq("id", data.businessId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) return null;

    const [addons, services, payments, provisioning, domains, members, referralCode, referralsSent] =
      await Promise.all([
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
      context.supabase
        .from("business_domains")
        .select("hostname, is_primary, verified_at")
        .eq("business_id", business.id)
        .order("is_primary", { ascending: false }),
      context.supabase
        .from("business_members")
        .select("user_id, role, created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: true }),
      context.supabase
        .from("business_referral_codes")
        .select("code, is_active")
        .eq("business_id", business.id)
        .maybeSingle(),
      context.supabase.rpc("referrals_sent", { _business_id: business.id }),
    ]);

    // Signed terms live on the invite this account was created from.
    let membership: ClientProfile["membership"] = null;
    if (business.origin_invite_id) {
      const { data: invite } = await context.supabase
        .from("invites")
        .select(
          "email, full_name, billing_interval, subscription_price_cents, setup_fee_cents, accepted_at",
        )
        .eq("id", business.origin_invite_id)
        .maybeSingle();
      if (invite) {
        membership = {
          email: invite.email,
          fullName: invite.full_name,
          billingInterval: invite.billing_interval,
          subscriptionPriceCents: invite.subscription_price_cents,
          setupFeeCents: invite.setup_fee_cents,
          acceptedAt: invite.accepted_at,
        };
      }
    }

    const row = provisioning.data;
    const domainRows = domains.data ?? [];


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
      primaryDomain: domainRows.find((d) => d.is_primary)?.hostname ?? null,
      domains: domainRows.map((d) => ({
        hostname: d.hostname,
        isPrimary: d.is_primary,
        verifiedAt: d.verified_at,
      })),
      members: (members.data ?? []).map((m) => ({
        userId: m.user_id,
        role: m.role,
        createdAt: m.created_at,
      })),
      membership,
      referral: referralCode.data
        ? {
            code: referralCode.data.code,
            isActive: referralCode.data.is_active,
            sentCount: (referralsSent.data ?? []).length,
          }
        : null,
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

/* ------------------------------------------------------------------ *
 * Per-client domain management (staff)
 *
 * Every write is explicitly scoped to one business_id and executed through the
 * caller's RLS-scoped client. Authorization is the business_domains policies
 * (`private.is_platform_staff()` / `private.is_business_manager()`): a client
 * attempting these gets a policy violation, not a silent success. No elevated
 * client is used here.
 * ------------------------------------------------------------------ */

const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(4)
  .max(253)
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "Enter a hostname like clientdomain.com");

const domainInput = z.object({ businessId: z.string().uuid(), hostname: hostnameSchema });

export const addClientDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    domainInput.extend({ isPrimary: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.isPrimary) {
      const { error: clearError } = await context.supabase
        .from("business_domains")
        .update({ is_primary: false })
        .eq("business_id", data.businessId);
      if (clearError) throw new Error(clearError.message);
    }
    const { error } = await context.supabase.from("business_domains").insert({
      business_id: data.businessId,
      hostname: data.hostname,
      is_primary: data.isPrimary,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeClientDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => domainInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("business_domains")
      .delete()
      .eq("business_id", data.businessId)
      .eq("hostname", data.hostname);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPrimaryClientDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => domainInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error: clearError } = await context.supabase
      .from("business_domains")
      .update({ is_primary: false })
      .eq("business_id", data.businessId);
    if (clearError) throw new Error(clearError.message);
    const { error } = await context.supabase
      .from("business_domains")
      .update({ is_primary: true })
      .eq("business_id", data.businessId)
      .eq("hostname", data.hostname);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Marks a mapping verified once DNS is confirmed at the hosting layer.
 * Verification itself happens outside this app; this records the decision so
 * public (anon) reads of the mapping become permitted for that hostname.
 */
export const setClientDomainVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => domainInput.extend({ verified: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("business_domains")
      .update({ verified_at: data.verified ? new Date().toISOString() : null })
      .eq("business_id", data.businessId)
      .eq("hostname", data.hostname);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type ClientActivity = {
  /** Last 30 days, from the same computeReport calculation the client's own Analytics tab uses. */
  revenueCents: number;
  completedJobs: number;
  pipelineCents: number;
  pipelineJobs: number;
  averageTicketCents: number;
  revenueChangePct: number | null;
  recent: {
    id: string;
    customerName: string;
    startsAt: string;
    status: string;
    totalCents: number;
  }[];
};

/**
 * Bookings + revenue snapshot for one client, for the Agency Console.
 * Reuses computeReport — the single analytics calculation behind the client's
 * Analytics tab and monthly statement — rather than recomputing totals here.
 * Reads go through the caller's RLS-scoped client (platform staff read policy
 * on bookings) and are explicitly business_id filtered. No elevated access.
 */
export const getClientActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessIdInput.parse(input))
  .handler(async ({ data, context }): Promise<ClientActivity | null> => {
    const { computeReport } = await import("./analytics.server");
    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 30);
    const windowMs = now.getTime() - start.getTime();

    const [{ report }, recent] = await Promise.all([
      computeReport(context.supabase, data.businessId, {
        start,
        end: now,
        prevStart: new Date(start.getTime() - windowMs),
        prevEnd: start,
        bucket: "day",
      }),
      context.supabase
        .from("bookings")
        .select("id, customer_name, starts_at, status, total_cents")
        .eq("business_id", data.businessId)
        .order("starts_at", { ascending: false })
        .limit(5),
    ]);
    if (recent.error) throw new Error(recent.error.message);

    return {
      revenueCents: report.totals.revenueCents,
      completedJobs: report.totals.completedJobs,
      pipelineCents: report.totals.pipelineCents,
      pipelineJobs: report.totals.pipelineJobs,
      averageTicketCents: report.totals.averageTicketCents,
      revenueChangePct: report.totals.revenueChangePct,
      recent: (recent.data ?? []).map((b) => ({
        id: b.id,
        customerName: b.customer_name,
        startsAt: b.starts_at,
        status: b.status as string,
        totalCents: b.total_cents,
      })),
    };
  });
