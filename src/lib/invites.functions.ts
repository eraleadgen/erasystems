import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  GENERIC_INVITE_ERROR,
  INVITE_TTL_DAYS,
  type InvitePreview,
  type InviteSummary,
} from "./invites";

const tokenInput = z.object({ token: z.string().min(20).max(200) });

function toSummary(row: {
  id: string;
  email: string;
  full_name: string;
  notes: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}): InviteSummary {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    notes: row.notes,
    status: row.status as InviteSummary["status"],
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
  };
}

/**
 * Staff-only: issue an invite for one named prospect.
 * The plaintext token is returned exactly once, here. Only its SHA-256 is stored.
 */
export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email().max(254),
        fullName: z.string().min(1).max(120),
        notes: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ token: string; invite: InviteSummary }> => {
    const { data: isStaff } = await context.supabase.rpc("is_platform_staff");
    if (!isStaff) throw new Error("Only platform staff can issue invites.");

    const { generateInviteToken, hashInviteToken, normalizeEmail, expiryFromNow } = await import(
      "./invites.server"
    );

    const token = generateInviteToken();
    const { data: row, error } = await context.supabase
      .from("invites")
      .insert({
        token_hash: await hashInviteToken(token),
        email: normalizeEmail(data.email),
        full_name: data.fullName.trim(),
        notes: data.notes?.trim() || null,
        expires_at: expiryFromNow(INVITE_TTL_DAYS),
        invited_by: context.userId,
      })
      .select("id, email, full_name, notes, status, expires_at, created_at, accepted_at")
      .single();

    if (error || !row) throw new Error(error?.message ?? "Could not create the invite.");
    return { token, invite: toSummary(row) };
  });

/** Staff-only: the invite register. Never exposes token_hash. */
export const listInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InviteSummary[]> => {
    const { data, error } = await context.supabase
      .from("invites")
      .select("id, email, full_name, notes, status, expires_at, created_at, accepted_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map(toSummary);
  });

/** Staff-only: withdraw an unused invite before it expires. */
export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("invites")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Public, token-gated. Returns only the invited email and name, and only for a
 * live invite. Every failure mode returns the same null — an attacker cannot
 * distinguish "no such token" from "already used" from "expired".
 */
export const previewInvite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenInput.parse(input))
  .handler(async ({ data }): Promise<InvitePreview | null> => {
    const { hashInviteToken, failureDelay } = await import("./invites.server");
    const { recordAttempt, isThrottled } = await import("./invite-throttle.server");
    const ip = getRequestIP({ xForwardedFor: false }) ?? "unknown";

    if (await isThrottled(ip)) {
      await failureDelay();
      return null;
    }

    const tokenHash = await hashInviteToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("invites")
      .select("email, full_name, status, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!row || row.status !== "pending" || new Date(row.expires_at).getTime() <= Date.now()) {
      await recordAttempt(ip);
      await failureDelay();
      return null;
    }

    return { email: row.email, fullName: row.full_name };
  });

/**
 * Public, token-gated: the only path that can create an account on this platform.
 * Open signup is disabled at the auth provider, so this is the whole door.
 *
 * Order matters: consume the invite atomically FIRST (a conditional update that
 * only one concurrent caller can win), then create the user. If user creation
 * fails, the invite is released back to pending so a real prospect is not locked out.
 */
export const redeemInvite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    tokenInput
      .extend({
        email: z.string().email().max(254),
        password: z.string().min(10).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ email: string }> => {
    const { hashInviteToken, failureDelay, normalizeEmail, constantTimeEquals } = await import(
      "./invites.server"
    );
    const { recordAttempt, isThrottled } = await import("./invite-throttle.server");
    const ip = getRequestIP({ xForwardedFor: false }) ?? "unknown";

    if (await isThrottled(ip)) {
      await failureDelay();
      throw new Error(GENERIC_INVITE_ERROR);
    }

    const tokenHash = await hashInviteToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Atomic single-use claim. Zero rows returned = not pending, expired, or unknown.
    const { data: claimed, error: claimError } = await supabaseAdmin.rpc("consume_invite", {
      _token_hash: tokenHash,
      _user_id: null,
    });
    const invite = Array.isArray(claimed) ? claimed[0] : null;

    if (claimError || !invite) {
      await recordAttempt(ip);
      await failureDelay();
      throw new Error(GENERIC_INVITE_ERROR);
    }

    // The invite decides the identity; the submitted email only has to match it.
    if (!constantTimeEquals(normalizeEmail(data.email), invite.email)) {
      await supabaseAdmin.rpc("release_invite", { _invite_id: invite.id });
      await recordAttempt(ip);
      await failureDelay();
      throw new Error(GENERIC_INVITE_ERROR);
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: invite.full_name, source: "invite" },
    });

    if (createError || !created.user) {
      await supabaseAdmin.rpc("release_invite", { _invite_id: invite.id });
      console.error("invite redemption failed to create user", createError?.message);
      throw new Error(
        createError?.message?.toLowerCase().includes("already")
          ? "An account already exists for this email. Sign in instead."
          : "Could not create the account. Please try again.",
      );
    }

    await supabaseAdmin
      .from("invites")
      .update({ accepted_user_id: created.user.id })
      .eq("id", invite.id);

    return { email: invite.email };
  });
