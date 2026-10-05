import type { Database } from "@/integrations/supabase/types";

export type PlanTier = Database["public"]["Enums"]["plan_tier"];
export type PlatformFeature = Database["public"]["Enums"]["platform_feature"];

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

export const BILLING_INTERVALS = ["monthly", "quarterly", "annual", "one_time"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/** Tier entitlements. */
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

export function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
