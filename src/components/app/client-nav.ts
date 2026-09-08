import type { PlatformFeature } from "@/lib/entitlements";

import type { NavItem } from "./app-shell";

/**
 * Client portal tabs are derived from tier features. A tab the plan does not
 * include is still listed, but as a muted upgrade hint rather than a link, so a
 * client always sees what the next tier unlocks.
 */
export function buildClientNav(features: PlatformFeature[] | null | undefined): NavItem[] {
  const has = (f: PlatformFeature) => Boolean(features?.includes(f));

  const gated = (label: string, to: string, feature: PlatformFeature): NavItem =>
    has(feature) ? { label, to } : { label, note: "Coming with your plan" };

  return [
    { label: "Overview", to: "/dashboard" },
    // Points at the live business record; it redirects to the wizard when
    // setup has not been completed yet.
    { label: "Business information", to: "/business" },
    gated("Catalog", "/catalog", "core_engines"),
    gated("Bookings", "/bookings", "core_engines"),
    gated("Customers", "/customers", "customer_portal"),
    gated("Team", "/team", "specialist_portal"),
    gated("Billing", "/billing", "payments"),
    gated("Analytics", "/analytics", "advanced_analytics"),
    gated("Referrals", "/referrals", "partner_network"),
  ];
}
