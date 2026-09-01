import type { Database } from "@/integrations/supabase/types";

export type PlanTier = Database["public"]["Enums"]["plan_tier"];
export type PlatformFeature = Database["public"]["Enums"]["platform_feature"];
export type AddonKind = Database["public"]["Enums"]["addon_kind"];

/**
 * Tier features and add-ons are ORTHOGONAL.
 *
 * Nothing in this file (or in the database) derives an add-on from a tier, or a
 * tier feature from an add-on. `business_has_addon()` reads only `business_addons`;
 * `business_has_feature()` reads only `businesses` + `plan_tier_features`. A tenant
 * on `enterprise` has no add-on unless a row exists for it, and a tenant on `basic`
 * has the add-on the moment that row exists.
 */

export const FEATURE_LABELS: Record<PlatformFeature, string> = {
  website: "Website",
  ai_chat_widget: "AI chat widget",
  core_engines: "Core engines",
  payments: "Payments",
  admin_dashboard: "Admin dashboard",
  self_serve_setup: "Self-serve domain, email & phone",
  email_automations: "Email automations",
  customer_portal: "Customer member portal",
  specialist_portal: "Specialist / employee portal",
  voice_sms_agent: "AI Voice & SMS agent",
  sms_automations: "SMS automations",
  advanced_analytics: "Advanced analytics",
  partner_network: "Partner / referral network",
};

/** Presentation-only grouping: the authoritative mapping lives in plan_tier_features. */
export const FEATURE_INTRODUCED_IN: Record<PlatformFeature, PlanTier> = {
  website: "basic",
  ai_chat_widget: "basic",
  core_engines: "basic",
  payments: "basic",
  admin_dashboard: "basic",
  self_serve_setup: "basic",
  email_automations: "basic",
  customer_portal: "growth",
  specialist_portal: "growth",
  voice_sms_agent: "enterprise",
  sms_automations: "enterprise",
  advanced_analytics: "enterprise",
  partner_network: "enterprise",
};

export const ALL_FEATURES = Object.keys(FEATURE_LABELS) as PlatformFeature[];

export const ADDON_LABELS: Record<AddonKind, string> = {
  ad_management: "Ad Management",
  white_label_branding: "White-Label Branding",
};

export const ALL_ADDONS = Object.keys(ADDON_LABELS) as AddonKind[];

export const BILLING_INTERVALS = ["monthly", "quarterly", "annual", "one_time"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export type BusinessAddon = {
  id: string;
  addon: AddonKind;
  isActive: boolean;
  priceCents: number;
  currency: string;
  billingInterval: string;
  notes: string | null;
};

/** Tier entitlements only. Add-ons are never merged into this list. */
export type TenantEntitlements = {
  tier: PlanTier;
  features: PlatformFeature[];
};

export function hasFeature(
  entitlements: TenantEntitlements | null | undefined,
  feature: PlatformFeature,
): boolean {
  return Boolean(entitlements?.features.includes(feature));
}

/** Add-on checks read add-on state only — a tier can never satisfy one. */
export function hasAddon(addons: BusinessAddon[] | null | undefined, addon: AddonKind): boolean {
  return Boolean(addons?.some((row) => row.addon === addon && row.isActive));
}

export function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
