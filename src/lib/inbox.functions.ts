import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InboxItem = {
  draftId: string;
  businessId: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  lifecycle: string | null;
  planTier: string | null;
  business: {
    name: string;
    legalName: string;
    timezone: string;
    supportEmail: string;
    supportPhone: string;
    brandPrimary: string;
    brandAccent: string;
  } | null;
  site: {
    addressLine1: string;
    addressLine2: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  } | null;
  services: { id: string; name: string; priceCents: number; durationMinutes: number }[];
  /** Everything the client typed in the wizard, as submitted. */
  answers: Record<string, unknown>;
};

async function assertStaff(supabase: { rpc: (fn: "is_platform_staff") => PromiseLike<{ data: unknown }> }) {
  const { data } = await supabase.rpc("is_platform_staff");
  if (!data) throw new Error("Only ERA staff can use the inbox.");
}

/** Staff-only list of finished onboarding forms, newest first. RLS-scoped reads. */
export const listOnboardingInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InboxItem[]> => {
    await assertStaff(context.supabase);
    const { data: drafts, error } = await context.supabase
      .from("onboarding_drafts")
      .select("id, business_id, data, updated_at, reviewed_at")
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = (drafts ?? []).map((d) => d.business_id).filter((x): x is string => Boolean(x));
    const [biz, sites, services] = await Promise.all([
      ids.length
        ? context.supabase
            .from("businesses")
            .select("id, name, legal_name, timezone, support_email, support_phone, brand_primary, brand_accent, lifecycle, plan_tier")
            .in("id", ids)
        : Promise.resolve({ data: [] as never[] }),
      ids.length
        ? context.supabase
            .from("business_site")
            .select("business_id, address_line1, address_line2, city, region, postal_code, country")
            .in("business_id", ids)
        : Promise.resolve({ data: [] as never[] }),
      ids.length
        ? context.supabase
            .from("services")
            .select("id, business_id, name, base_price_cents, duration_minutes, sort_order")
            .in("business_id", ids)
            .order("sort_order")
        : Promise.resolve({ data: [] as never[] }),
    ]);
    return (drafts ?? []).map((d) => {
      const b = (biz.data ?? []).find((x) => x.id === d.business_id);
      const s = (sites.data ?? []).find((x) => x.business_id === d.business_id);
      return {
        draftId: d.id,
        businessId: d.business_id,
        submittedAt: d.updated_at,
        reviewedAt: d.reviewed_at,
        lifecycle: b?.lifecycle ?? null,
        planTier: b?.plan_tier ?? null,
        business: b
          ? {
              name: b.name,
              legalName: b.legal_name ?? "",
              timezone: b.timezone,
              supportEmail: b.support_email ?? "",
              supportPhone: b.support_phone ?? "",
              brandPrimary: b.brand_primary ?? "",
              brandAccent: b.brand_accent ?? "",
            }
          : null,
        site: s
          ? {
              addressLine1: s.address_line1 ?? "",
              addressLine2: s.address_line2 ?? "",
              city: s.city ?? "",
              region: s.region ?? "",
              postalCode: s.postal_code ?? "",
              country: s.country ?? "",
            }
          : null,
        services: (services.data ?? [])
          .filter((x) => x.business_id === d.business_id)
          .map((x) => ({ id: x.id, name: x.name, priceCents: x.base_price_cents, durationMinutes: x.duration_minutes })),
        answers: (d.data ?? {}) as Record<string, unknown>,
      };
    });
  });

const saveInput = z.object({
  draftId: z.string().uuid(),
  businessId: z.string().uuid(),
  business: z.object({
    name: z.string().trim().min(1).max(160),
    legalName: z.string().trim().max(160),
    timezone: z.string().trim().min(1).max(64),
    supportEmail: z.string().trim().max(254),
    supportPhone: z.string().trim().max(40),
    brandPrimary: z.string().trim().max(20),
    brandAccent: z.string().trim().max(20),
  }),
  site: z.object({
    addressLine1: z.string().max(200),
    addressLine2: z.string().max(200),
    city: z.string().max(120),
    region: z.string().max(120),
    postalCode: z.string().max(40),
    country: z.string().max(120),
  }),
  services: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(160),
        priceCents: z.number().int().min(0).max(100_000_000),
        durationMinutes: z.number().int().min(5).max(1440),
      }),
    )
    .max(100),
});

/** Staff edit of a submitted client's live configuration. RLS-scoped, business_id filtered. */
export const saveOnboardingInboxItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase);
    const { data: draft } = await context.supabase
      .from("onboarding_drafts")
      .select("business_id")
      .eq("id", data.draftId)
      .single();
    if (!draft || draft.business_id !== data.businessId) throw new Error("Submission not found.");

    const b = data.business;
    const { error: bErr } = await context.supabase
      .from("businesses")
      .update({
        name: b.name,
        legal_name: b.legalName || null,
        timezone: b.timezone,
        support_email: b.supportEmail || null,
        support_phone: b.supportPhone || null,
        brand_primary: b.brandPrimary || null,
        brand_accent: b.brandAccent || null,
      })
      .eq("id", data.businessId);
    if (bErr) throw new Error(bErr.message);

    const s = data.site;
    const { error: sErr } = await context.supabase
      .from("business_site")
      .update({
        address_line1: s.addressLine1 || null,
        address_line2: s.addressLine2 || null,
        city: s.city || null,
        region: s.region || null,
        postal_code: s.postalCode || null,
        country: s.country || null,
      })
      .eq("business_id", data.businessId);
    if (sErr) throw new Error(sErr.message);

    for (const svc of data.services) {
      const { error } = await context.supabase
        .from("services")
        .update({ name: svc.name, base_price_cents: svc.priceCents, duration_minutes: svc.durationMinutes })
        .eq("id", svc.id)
        .eq("business_id", data.businessId);
      if (error) throw new Error(error.message);
    }

    await context.supabase
      .from("onboarding_drafts")
      .update({ reviewed_at: new Date().toISOString() })
      .eq("id", data.draftId);
    return { ok: true };
  });

export const setInboxReviewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ draftId: z.string().uuid(), reviewed: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase);
    const { error } = await context.supabase
      .from("onboarding_drafts")
      .update({ reviewed_at: data.reviewed ? new Date().toISOString() : null })
      .eq("id", data.draftId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
