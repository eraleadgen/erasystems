import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { AddonKind, PlanTier, PlatformFeature } from "./entitlements";
import type { AutoTaskKey, DeliveryStatus } from "./delivery-tasks";

export type DerivedStatus = { status: DeliveryStatus; evidence: string };

export type BusinessDelivery = {
  businessId: string;
  name: string;
  slug: string;
  planTier: PlanTier;
  lifecycle: string;
  createdAt: string;
  contactEmail: string | null;
  features: PlatformFeature[];
  addons: AddonKind[];
  derived: Partial<Record<AutoTaskKey, DerivedStatus>>;
};

type Client = SupabaseClient<Database>;

function filled(...values: (string | null | undefined)[]) {
  return values.filter((v) => (v ?? "").trim().length > 0).length;
}

/**
 * Computes the checklist steps the system can prove for one business, from data
 * it already holds. Every query below carries an explicit `business_id`, and all
 * of them run through the caller's RLS-scoped client — no elevated access.
 */
export async function computeDelivery(
  supabase: Client,
  businessId: string,
): Promise<BusinessDelivery | null> {
  const { data: business } = await supabase
    .from("businesses")
    .select(
      "id, name, slug, plan_tier, lifecycle, is_active, timezone, support_email, support_phone, logo_url, legal_name, created_at, origin_invite_id",
    )
    .eq("id", businessId)
    .maybeSingle();
  if (!business) return null;

  const [features, addons, services, domains, provisioning, launch, payments] = await Promise.all([
    supabase.from("plan_tier_features").select("feature").eq("plan_tier", business.plan_tier),
    supabase
      .from("business_addons")
      .select("addon, is_active, price_cents")
      .eq("business_id", businessId),
    supabase
      .from("services")
      .select("id, base_price_cents, duration_minutes, is_active")
      .eq("business_id", businessId),
    supabase.from("business_domains").select("hostname, verified_at").eq("business_id", businessId),
    supabase
      .from("client_provisioning")
      .select("domain_status, a2p_required, a2p_status, website_status")
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase.from("business_launch_status").select("item_key, status").eq("business_id", businessId),
    supabase
      .from("payments")
      .select("id, status")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const featureKeys = (features.data ?? []).map((f) => f.feature as PlatformFeature);
  const activeAddons = (addons.data ?? [])
    .filter((a) => a.is_active)
    .map((a) => a.addon as AddonKind);

  // Contact for assisted emails: the invite this account came from, else support email.
  let contactEmail = business.support_email;
  if (business.origin_invite_id) {
    const { data: invite } = await supabase
      .from("invites")
      .select("email")
      .eq("id", business.origin_invite_id)
      .maybeSingle();
    if (invite?.email) contactEmail = invite.email;
  }

  const derived: Partial<Record<AutoTaskKey, DerivedStatus>> = {};

  const isActive = business.lifecycle === "active" && business.is_active;
  const paidRow = (payments.data ?? []).some((p) => p.status === "paid" || p.status === "succeeded");
  derived.payment_confirmed = isActive
    ? { status: "done", evidence: "Account active" }
    : paidRow
      ? { status: "in_progress", evidence: "Payment recorded, activation pending" }
      : { status: "not_started", evidence: "No confirmed payment" };

  const pricedAddons = (addons.data ?? []).filter((a) => a.is_active && a.price_cents >= 0).length;
  derived.tier_addons_locked = isActive
    ? {
        status: "done",
        evidence: `${business.plan_tier} tier · ${pricedAddons} add-on${pricedAddons === 1 ? "" : "s"} priced`,
      }
    : { status: "not_started", evidence: "Tier locks on activation" };

  // Kickoff: a discovery request for this contact with a booked slot.
  if (contactEmail) {
    const { data: discovery } = await supabase
      .from("discovery_requests")
      .select("scheduled_start")
      .eq("email", contactEmail.toLowerCase())
      .not("scheduled_start", "is", null)
      .order("scheduled_start", { ascending: false })
      .limit(1);
    const slot = discovery?.[0]?.scheduled_start ?? null;
    derived.kickoff_scheduled = slot
      ? { status: "done", evidence: `Booked ${new Date(slot).toLocaleString()}` }
      : { status: "not_started", evidence: "No call booked for this contact" };
  }

  const profileFields = filled(
    business.name,
    business.legal_name,
    business.timezone,
    business.support_email,
    business.support_phone,
  );
  derived.business_profile =
    profileFields === 5
      ? { status: "done", evidence: "All profile fields complete" }
      : profileFields >= 2
        ? { status: "in_progress", evidence: `${profileFields} of 5 profile fields` }
        : { status: "not_started", evidence: "Profile empty" };

  derived.brand_assets = business.logo_url
    ? { status: "done", evidence: "Logo on file" }
    : { status: "not_started", evidence: "No logo uploaded" };

  const liveServices = (services.data ?? []).filter(
    (s) => s.is_active && s.base_price_cents > 0 && s.duration_minutes > 0,
  ).length;
  derived.service_catalog = liveServices
    ? { status: "done", evidence: `${liveServices} priced service${liveServices === 1 ? "" : "s"}` }
    : { status: "not_started", evidence: "No priced services" };

  const verifiedDomain = (domains.data ?? []).find((d) => d.verified_at);
  const anyDomain = (domains.data ?? [])[0];
  derived.domain_connected = verifiedDomain
    ? { status: "done", evidence: `${verifiedDomain.hostname} verified` }
    : anyDomain
      ? { status: "in_progress", evidence: `${anyDomain.hostname} awaiting verification` }
      : provisioning.data?.domain_status === "in_progress"
        ? { status: "in_progress", evidence: "Domain setup in progress" }
        : { status: "not_started", evidence: "No domain mapped" };

  const prov = provisioning.data;
  if (prov) {
    derived.a2p_registration = !prov.a2p_required
      ? { status: "done", evidence: "Not required for this client" }
      : prov.a2p_status === "approved"
        ? { status: "done", evidence: "Campaign approved" }
        : prov.a2p_status === "submitted"
          ? { status: "in_progress", evidence: "Submitted, awaiting approval" }
          : { status: "not_started", evidence: "Not submitted" };

    derived.website_built =
      prov.website_status === "live"
        ? { status: "done", evidence: "Website marked live" }
        : prov.website_status === "in_progress"
          ? { status: "in_progress", evidence: "Website in build" }
          : { status: "not_started", evidence: "Not started" };
  }

  const entitledItems = [...featureKeys, ...activeAddons] as string[];
  const rows = launch.data ?? [];
  const liveCount = entitledItems.filter(
    (k) => rows.find((r) => r.item_key === k)?.status === "live",
  ).length;
  derived.status_lights_live = entitledItems.length
    ? liveCount === entitledItems.length
      ? { status: "done", evidence: "Every capability live" }
      : liveCount > 0
        ? { status: "in_progress", evidence: `${liveCount} of ${entitledItems.length} live` }
        : { status: "not_started", evidence: `0 of ${entitledItems.length} live` }
    : { status: "not_started", evidence: "No capabilities entitled" };

  return {
    businessId: business.id,
    name: business.name,
    slug: business.slug,
    planTier: business.plan_tier as PlanTier,
    lifecycle: business.lifecycle,
    createdAt: business.created_at,
    contactEmail,
    features: featureKeys,
    addons: activeAddons,
    derived,
  };
}
