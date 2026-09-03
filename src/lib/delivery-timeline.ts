import type { AddonKind, PlatformFeature } from "./entitlements";

/**
 * Delivery expectations shown to a client from the moment their account exists.
 *
 * Presentation only: these are the committed build windows per capability, not
 * entitlement logic. What a client is entitled to still comes from plan_tier_features
 * and business_addons; this file only says how soon each of those goes live.
 *
 * Every window is capped at the platform commitment: everything in a plan is
 * live within 7 days of kickoff.
 */
export type DeliveryWindow = {
  /** Business days from kickoff until the capability is live. */
  days: number;
  label: string;
};

export const FEATURE_DELIVERY: Record<PlatformFeature, DeliveryWindow> = {
  admin_dashboard: { days: 0, label: "Available now" },
  website: { days: 3, label: "72 hours" },
  ai_chat_widget: { days: 3, label: "72 hours" },
  core_engines: { days: 3, label: "72 hours" },
  payments: { days: 3, label: "72 hours" },
  self_serve_setup: { days: 3, label: "72 hours" },
  email_automations: { days: 5, label: "3 to 5 days" },
  customer_portal: { days: 7, label: "5 to 7 days" },
  specialist_portal: { days: 7, label: "5 to 7 days" },
  voice_sms_agent: { days: 7, label: "5 to 7 days" },
  sms_automations: { days: 7, label: "5 to 7 days" },
  advanced_analytics: { days: 7, label: "5 to 7 days" },
  partner_network: { days: 7, label: "5 to 7 days" },
};

/** Platform commitment: nothing in a plan takes longer than this. */
export const MAX_DELIVERY_DAYS = 7;

export const ADDON_DELIVERY: Record<AddonKind, DeliveryWindow> = {
  ad_management: { days: 7, label: "5 to 7 days" },
  white_label_branding: { days: 5, label: "3 to 5 days" },
};

/** Groups capabilities that share the same window, longest last. */
export function groupByWindow<T extends string>(
  items: { key: T; label: string; window: DeliveryWindow }[],
) {
  const groups = new Map<string, { window: DeliveryWindow; labels: string[] }>();
  for (const item of items) {
    const entry = groups.get(item.window.label);
    if (entry) entry.labels.push(item.label);
    else groups.set(item.window.label, { window: item.window, labels: [item.label] });
  }
  return [...groups.values()].sort((a, b) => a.window.days - b.window.days);
}

export function estimatedDate(from: string | null, days: number) {
  if (!from) return null;
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return null;
  const target = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return target.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}
