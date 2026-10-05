/** Shared, browser-safe invite types and helpers. No secrets, no server imports. */

import type { PlanTier } from "./entitlements";

export type InviteStatus = "pending" | "accepted" | "revoked";

/**
 * Commercial terms agreed on the discovery call, set by staff when the invite is
 * issued and copied onto the business at onboarding completion. The client never
 * chooses any of this.
 */
export interface InviteTerms {
  planTier: PlanTier;
  subscriptionPriceCents: number;
  setupFeeCents: number;
  billingInterval: string;
}

export interface InviteSummary {
  id: string;
  email: string;
  fullName: string;
  notes: string | null;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  terms: InviteTerms;
}


/** What a visitor holding a token is allowed to learn. Nothing else. */
export interface InvitePreview {
  email: string;
  fullName: string;
}

export const INVITE_TTL_DAYS = 7;

export const GENERIC_INVITE_ERROR =
  "This invite link is not valid. It may have expired, already been used, or been withdrawn. Contact your ERA Systems representative for a new one.";

export function inviteUrl(origin: string, token: string): string {
  return `${origin}/register?token=${encodeURIComponent(token)}`;
}

export function isExpired(invite: InviteSummary): boolean {
  return new Date(invite.expiresAt).getTime() <= Date.now();
}

export function inviteStatusLabel(invite: InviteSummary): string {
  if (invite.status === "accepted") return "Accepted";
  if (invite.status === "revoked") return "Revoked";
  return isExpired(invite) ? "Expired" : "Pending";
}
