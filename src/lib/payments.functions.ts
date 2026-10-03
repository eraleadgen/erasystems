import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PlanTier } from "./entitlements";
import { GENERIC_CHECKOUT_ERROR, type AgreedTerms, type PaymentRecord } from "./payments";


/** Membership-scoped: the agreed commercial terms for the caller's business. */
export const getMyTerms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AgreedTerms | null> => {
    const { data: membership } = await context.supabase
      .from("business_members")
      .select("business_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!membership) return null;

    const { data: business } = await context.supabase
      .from("businesses")
      .select("id, plan_tier, origin_invite_id")
      .eq("id", membership.business_id)
      .maybeSingle();
    if (!business) return null;

    const { resolveAgreedTerms } = await import("./terms.server");
    return resolveAgreedTerms(business.id, business.plan_tier as PlanTier, business.origin_invite_id);
  });

/** Membership-scoped payment history for the caller's business. Read-only, RLS-enforced. */
export const getMyPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentRecord[]> => {
    const { data, error } = await context.supabase
      .from("payments")
      .select(
        "id, status, amount_cents, currency, webhook_verified_at, api_verified_at, activated_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: row.id,
      status: row.status as PaymentRecord["status"],
      amountCents: row.amount_cents,
      currency: row.currency,
      webhookVerifiedAt: row.webhook_verified_at,
      apiVerifiedAt: row.api_verified_at,
      activatedAt: row.activated_at,
      createdAt: row.created_at,
    }));
  });

/**
 * Opens checkout for the caller's own business. The amount is computed on the
 * server from the staff-agreed terms; nothing about price, tier or business id
 * comes from the request.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ agreementVersion: z.string().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { AGREEMENT_VERSION } = await import("./agreement");
    if (data.agreementVersion !== AGREEMENT_VERSION) {
      throw new Error("The agreement was updated. Refresh the page and accept the current version.");
    }
    const { data: membership } = await context.supabase
      .from("business_members")
      .select("business_id, role")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throw new Error(GENERIC_CHECKOUT_ERROR);
    }

    const { data: business } = await context.supabase
      .from("businesses")
      .select("id, name, slug, plan_tier, lifecycle, origin_invite_id")
      .eq("id", membership.business_id)
      .maybeSingle();
    if (!business) throw new Error(GENERIC_CHECKOUT_ERROR);

    // Payment only ever acts on a business that is waiting for it.
    if (business.lifecycle !== "pending_payment" && business.lifecycle !== "expired") {
      throw new Error("This business is already active.");
    }

    const { resolveAgreedTerms } = await import("./terms.server");
    const terms = await resolveAgreedTerms(
      business.id,
      business.plan_tier as PlanTier,
      business.origin_invite_id,
    );
    if (!terms || terms.totalCents <= 0) {
      throw new Error(
        "No pricing has been set for your account yet. Your ERA Systems representative will finalise it.",
      );
    }

    // Record acceptance of the exact terms shown, as the signed-in manager (RLS-checked).
    const { error: acceptError } = await context.supabase.from("agreement_acceptances").insert({
      business_id: business.id,
      user_id: context.userId,
      agreement_version: AGREEMENT_VERSION,
      terms_snapshot: { ...terms, incorporatedDocuments: ["ERA Terms of Service", "ERA Privacy Policy"] } as never,
    });
    if (acceptError) throw new Error(GENERIC_CHECKOUT_ERROR);

    const origin = new URL(getRequest().url).origin;
    const { createStripeCheckoutSession } = await import("./payments.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { ADDON_LABELS } = await import("./entitlements");
    const session = await createStripeCheckoutSession({
      businessId: business.id,
      currency: "usd",
      lines: [
        {
          name: `ERA Systems — ${terms.planTier} plan`,
          amountCents: terms.subscriptionPriceCents,
          interval: terms.billingInterval,
        },
        { name: "ERA Systems — one-time setup fee", amountCents: terms.setupFeeCents, interval: "one_time" },
        ...terms.addons.map((a) => ({
          name: `ERA Systems — ${ADDON_LABELS[a.addon]}`,
          amountCents: a.priceCents,
          // Stripe needs every recurring line on one schedule.
          interval: a.billingInterval === "one_time" ? "one_time" : terms.billingInterval,
        })),
      ],
      description: business.name,
      customerEmail: (context.claims as { email?: string } | undefined)?.email ?? null,
      successUrl: `${origin}/dashboard?session={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/dashboard?checkout=cancelled`,
    });

    if (!session.url) throw new Error(GENERIC_CHECKOUT_ERROR);

    // Recorded before the redirect, so an inbound webhook always has a local row.
    const { error: insertError } = await supabaseAdmin.from("payments").insert({
      business_id: business.id,
      provider: "stripe",
      provider_session_id: session.id,
      amount_cents: terms.totalCents,
      currency: "usd",
      status: "pending",
    });
    if (insertError) throw new Error(insertError.message);

    return { url: session.url };
  });

/**
 * Reconciliation fallback for a missed webhook. Re-runs the live provider check
 * and the same guarded transition for a session id the server itself created and
 * that belongs to the caller's own business. It cannot invent a payment.
 */
export const verifyMyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().min(10).max(300) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ status: "paid" | "pending" | "failed" }> => {
    // RLS decides ownership: the caller can only see their own business's payment row.
    const { data: payment } = await context.supabase
      .from("payments")
      .select("id, status")
      .eq("provider_session_id", data.sessionId)
      .maybeSingle();
    if (!payment) return { status: "pending" };
    if (payment.status === "paid") return { status: "paid" };

    const { verifyAndActivate } = await import("./payments.server");
    const outcome = await verifyAndActivate(data.sessionId);
    return { status: outcome.ok ? "paid" : "failed" };
  });
