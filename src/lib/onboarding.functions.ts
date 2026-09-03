import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ONBOARDING_STEPS,
  basicsSchema,
  brandingSchema,
  catalogSchema,
  draftBasicsSchema,
  draftBrandingSchema,
  draftCatalogSchema,
  draftDataSchema,
  draftTeamSchema,
  integrationsSchema,
  slugify,
  teamSchema,
  type DraftData,
  type OnboardingDraft,
} from "./onboarding";

const DRAFT_COLUMNS = "id, status, current_step, data, business_id";

function toDraft(
  row: {
    id: string;
    status: string;
    current_step: number;
    data: unknown;
    business_id: string | null;
  },
  email: string,
): OnboardingDraft {
  return {
    id: row.id,
    status: row.status as OnboardingDraft["status"],
    currentStep: row.current_step,
    data: draftDataSchema.parse(row.data ?? {}),
    businessId: row.business_id,
    accountEmail: email,
  };
}

function accountEmail(claims: Record<string, unknown> | null | undefined): string {
  const email = claims && typeof claims["email"] === "string" ? (claims["email"] as string) : "";
  return email;
}

/**
 * One draft per account, forever. The unique constraint on user_id is the real
 * guarantee: concurrent first loads race into the same row, and a returning
 * visitor resumes it instead of starting a second onboarding.
 */
export const getOrCreateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingDraft> => {
    const email = accountEmail(context.claims as Record<string, unknown>);

    const { data: existing } = await context.supabase
      .from("onboarding_drafts")
      .select(DRAFT_COLUMNS)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing) return toDraft(existing, email);

    const { error } = await context.supabase
      .from("onboarding_drafts")
      .insert({ user_id: context.userId });

    // A unique-violation here means another tab won the race; re-read rather than fail.
    if (error && error.code !== "23505") {
      throw new Error("Could not start onboarding.");
    }

    const { data: row, error: readError } = await context.supabase
      .from("onboarding_drafts")
      .select(DRAFT_COLUMNS)
      .eq("user_id", context.userId)
      .single();

    if (readError || !row) throw new Error("Could not start onboarding.");
    return toDraft(row, email);
  });

const stepPayload = z.discriminatedUnion("step", [
  z.object({ step: z.literal("basics"), value: draftBasicsSchema.partial() }),
  z.object({ step: z.literal("branding"), value: draftBrandingSchema.partial() }),
  z.object({ step: z.literal("catalog"), value: draftCatalogSchema.partial() }),
  z.object({ step: z.literal("team"), value: draftTeamSchema.partial() }),
  z.object({ step: z.literal("integrations"), value: integrationsSchema.partial() }),
]);

/** Saves one step's slice and where to resume. Never touches tenant tables. */
export const saveDraftStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        payload: stepPayload,
        currentStep: z.number().int().min(0).max(ONBOARDING_STEPS.length - 1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<OnboardingDraft> => {
    const email = accountEmail(context.claims as Record<string, unknown>);

    const { data: current, error: readError } = await context.supabase
      .from("onboarding_drafts")
      .select(DRAFT_COLUMNS)
      .eq("user_id", context.userId)
      .single();
    if (readError || !current) throw new Error("No onboarding session found.");
    if (current.status === "completed") return toDraft(current, email);

    const merged: DraftData = {
      ...draftDataSchema.parse(current.data ?? {}),
      [data.payload.step]: data.payload.value,
    };

    const { data: row, error } = await context.supabase
      .from("onboarding_drafts")
      .update({ data: merged, current_step: data.currentStep })
      .eq("user_id", context.userId)
      .eq("status", "in_progress")
      .select(DRAFT_COLUMNS)
      .single();

    if (error || !row) throw new Error("Could not save your progress.");
    return toDraft(row, email);
  });

const completionSchema = z.object({
  basics: basicsSchema,
  branding: brandingSchema,
  catalog: catalogSchema,
  team: teamSchema.optional(),
  integrations: integrationsSchema.optional(),
});

/**
 * The only place a business is created.
 *
 * ELEVATED ACCESS (see docs/elevated-access.md): `businesses` denies client inserts by
 * design, so provisioning runs with the service-role client. Guard rails:
 *  - the caller is authorized first through the RLS-scoped client (they must own an
 *    in-progress draft);
 *  - the owner id is `context.userId` from the verified session, never form input;
 *  - the draft is claimed atomically BEFORE any tenant row is written, so a double
 *    submit cannot mint two businesses;
 *  - every dependent write carries the freshly created business_id explicitly.
 */
export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ businessId: string }> => {
    const { data: draft, error: readError } = await context.supabase
      .from("onboarding_drafts")
      .select(DRAFT_COLUMNS)
      .eq("user_id", context.userId)
      .single();
    if (readError || !draft) throw new Error("No onboarding session found.");

    if (draft.status === "completed" && draft.business_id) {
      return { businessId: draft.business_id };
    }

    const parsed = completionSchema.safeParse(draft.data ?? {});
    if (!parsed.success) {
      throw new Error("Some required details are still missing. Review each step and try again.");
    }
    const payload = parsed.data;

    // Atomic claim: only the request that flips in_progress -> completed provisions.
    const { data: claimed } = await context.supabase
      .from("onboarding_drafts")
      .update({ status: "completed" })
      .eq("user_id", context.userId)
      .eq("status", "in_progress")
      .select("id")
      .maybeSingle();

    if (!claimed) {
      // Another submit won the claim. Wait briefly for it to stamp the business id
      // rather than reporting a failure for work that is succeeding.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const { data: after } = await context.supabase
          .from("onboarding_drafts")
          .select("status, business_id")
          .eq("user_id", context.userId)
          .single();
        if (after?.business_id) return { businessId: after.business_id };
        // The winner failed and released the claim; let the caller retry.
        if (after?.status === "in_progress") break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error("This setup is already being submitted. Refresh in a moment.");
    }


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const release = async () => {
      await supabaseAdmin
        .from("onboarding_drafts")
        .update({ status: "in_progress" })
        .eq("user_id", context.userId)
        .is("business_id", null);
    };

    try {
      const base = slugify(payload.basics.displayName) || "business";
      let businessId: string | null = null;
      let reclaimAttempted = false;

      /**
       * Commercial terms come from the invite this account was created with — set
       * by staff on the discovery call, never chosen by the client. Looked up by
       * the verified session user id, not by anything in the submitted payload.
       */
      const { data: originInvite } = await supabaseAdmin
        .from("invites")
        .select("id, plan_tier")
        .eq("accepted_user_id", context.userId)
        .eq("status", "accepted")
        .order("accepted_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      /**
       * A slug is held only by a paid business, or by an unpaid one whose 14-day
       * reservation has not lapsed. A lapsed unpaid holder is moved aside (its row and
       * all its data survive — only the address changes) so a paying client can take the
       * clean address. Scoped by the holder's own id on every write.
       */
      const releaseLapsedSlug = async (slug: string): Promise<boolean> => {
        const { data: holder } = await supabaseAdmin
          .from("businesses")
          .select("id, lifecycle, slug_reserved_until")
          .eq("slug", slug)
          .maybeSingle();

        if (!holder) return true; // vanished between attempts; retry the insert
        if (holder.lifecycle !== "pending_payment" && holder.lifecycle !== "expired") return false;
        if (holder.slug_reserved_until && new Date(holder.slug_reserved_until) > new Date())
          return false;

        const { error: renameError } = await supabaseAdmin
          .from("businesses")
          .update({
            slug: `${slug}-expired-${holder.id.slice(0, 6)}`,
            lifecycle: "expired",
            slug_reserved_until: null,
          })
          .eq("id", holder.id);
        return !renameError;
      };

      for (let attempt = 0; attempt < 6 && !businessId; attempt += 1) {
        const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 7)}`;
        const { data: inserted, error } = await supabaseAdmin
          .from("businesses")
          .insert({
            slug,
            name: payload.basics.displayName.trim(),
            legal_name: payload.basics.legalName.trim(),
            timezone: payload.basics.timezone,
            // Not live until payment. Tier is carried from the staff-issued invite.
            is_active: false,
            lifecycle: "pending_payment",
            plan_tier: originInvite?.plan_tier ?? "basic",
            origin_invite_id: originInvite?.id ?? null,
            slug_reserved_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            logo_url: payload.branding.logoPath,
            brand_primary: payload.branding.brandPrimary || null,
            brand_accent: payload.branding.brandAccent || null,
            support_email: payload.basics.supportEmail || null,
            support_phone: payload.basics.supportPhone || null,
          })
          .select("id")
          .single();

        if (inserted) {
          businessId = inserted.id;
        } else if (error && error.code === "23505") {
          // Only the clean base address is worth reclaiming from a lapsed holder.
          if (attempt === 0 && !reclaimAttempted) {
            reclaimAttempted = true;
            if (await releaseLapsedSlug(slug)) attempt -= 1;
          }
        } else if (error) {
          throw new Error(error.message);
        }
      }

      if (!businessId) throw new Error("Could not reserve a unique address for your business.");


      const { error: memberError } = await supabaseAdmin.from("business_members").insert({
        business_id: businessId,
        user_id: context.userId,
        role: "owner",
      });
      if (memberError) throw new Error(memberError.message);

      /**
       * Agreed add-ons are copied onto the business INACTIVE. They carry their
       * per-client amount into checkout, and only the payment activation path
       * flips them on — a tenant is never entitled to an add-on before paying.
       */
      if (originInvite?.id) {
        const { data: inviteAddons } = await supabaseAdmin
          .from("invite_addons")
          .select("addon, price_cents, billing_interval")
          .eq("invite_id", originInvite.id);

        if (inviteAddons && inviteAddons.length > 0) {
          const { error: addonError } = await supabaseAdmin.from("business_addons").insert(
            inviteAddons.map((row) => ({
              business_id: businessId,
              addon: row.addon,
              price_cents: row.price_cents,
              billing_interval: row.billing_interval,
              is_active: false,
              deactivated_at: new Date().toISOString(),
            })),
          );
          if (addonError) throw new Error(addonError.message);
        }
      }


      const services = payload.catalog.services ?? [];
      if (services.length > 0) {
        const { error: serviceError } = await supabaseAdmin.from("services").insert(
          services.map((service, index) => ({
            business_id: businessId,
            name: service.name.trim(),
            description: service.description || null,
            base_price_cents: service.priceCents,
            duration_minutes: service.durationMinutes,
            is_active: true,
            sort_order: index,
          })),
        );
        if (serviceError) throw new Error(serviceError.message);
      }

      const { error: stampError } = await supabaseAdmin
        .from("onboarding_drafts")
        .update({ business_id: businessId })
        .eq("user_id", context.userId);
      if (stampError) throw new Error(stampError.message);

      return { businessId };
    } catch (error) {
      await release();
      throw error instanceof Error ? error : new Error("Could not finish onboarding.");
    }
  });
