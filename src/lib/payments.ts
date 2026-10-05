/** Browser-safe payment types and helpers. No secrets, no server imports. */

import type { PlanTier } from "./entitlements";

export type PaymentStatus = "pending" | "paid" | "failed";

export interface PaymentRecord {
  id: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  webhookVerifiedAt: string | null;
  apiVerifiedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
}

export interface AgreedTerms {
  planTier: PlanTier;
  subscriptionPriceCents: number;
  setupFeeCents: number;
  billingInterval: string;
  /** subscription + setup fee, for the first billing period. */
  totalCents: number;
}

export const GENERIC_CHECKOUT_ERROR =
  "Checkout is not available for this business right now. Contact your ERA Systems representative.";

export function intervalLabel(interval: string): string {
  switch (interval) {
    case "monthly":
      return "per month";
    case "quarterly":
      return "per quarter";
    case "annual":
      return "per year";
    default:
      return "one-time";
  }
}
