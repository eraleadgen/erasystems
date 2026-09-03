/**
 * ERA Systems list pricing. Browser-safe: these are the published amounts a
 * client sees when they pick a tier, and the same table the server uses to
 * recompute the charge. Staff-agreed invite pricing always overrides it.
 *
 * Add-ons stay orthogonal to tiers: the downloadable app is a one-time build
 * fee available on any tier, it is never bundled into a plan.
 */

import type { PlanTier } from "./entitlements";

export interface PlanPrice {
  tier: PlanTier;
  name: string;
  /** Recurring software fee. */
  monthlyCents: number;
  /** One-time onboarding and build fee. */
  setupFeeCents: number;
  /** One-time price of the downloadable app add-on on this tier. */
  appAddonCents: number;
  /** Enterprise app builds are scoped on a call before any money changes hands. */
  appRequiresCall: boolean;
  summary: string;
}

export const PLAN_PRICING: Record<PlanTier, PlanPrice> = {
  basic: {
    tier: "basic",
    name: "Basic",
    monthlyCents: 20000,
    setupFeeCents: 100000,
    appAddonCents: 500000,
    appRequiresCall: false,
    summary: "Website, AI chat, core engines, payments, admin dashboard and email automations.",
  },
  growth: {
    tier: "growth",
    name: "Growth",
    monthlyCents: 50000,
    setupFeeCents: 200000,
    appAddonCents: 750000,
    appRequiresCall: false,
    summary: "Everything in Basic plus the customer member portal and specialist portal.",
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise",
    monthlyCents: 100000,
    setupFeeCents: 300000,
    appAddonCents: 900000,
    appRequiresCall: true,
    summary:
      "Everything in Growth plus the AI Voice & SMS agent, SMS automations, advanced analytics and the partner network.",
  },
};

export const SELECTABLE_TIERS: PlanTier[] = ["basic", "growth", "enterprise"];

/** The downloadable-app add-on is stored as the white_label_branding add-on kind. */
export const APP_ADDON = "white_label_branding" as const;

export const APP_ADDON_NAME = "Downloadable Apps";

export const APP_ADDON_BLURB =
  "Two branded apps your customers and your team download: a customer app for your website, booking and account, and a business operations app your crew runs the day from.";
