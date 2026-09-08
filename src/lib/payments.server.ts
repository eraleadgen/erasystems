/**
 * Server-only payment primitives. Blocked from client bundles by the filename.
 *
 * Nothing here trusts the client. Amounts are always recomputed from the
 * business's own agreed terms, and every provider fact is re-read from the
 * provider's API rather than taken from a webhook payload or a redirect.
 */

import { createHmac, timingSafeEqual } from "crypto";

const STRIPE_API = "https://api.stripe.com/v1";

/**
 * Test-mode override. When STRIPE_SECRET_KEY_TEST is present the whole payment
 * path (session creation, verification, webhook signature) runs against Stripe
 * test mode. Removing that secret restores live mode with no code change, so a
 * rehearsal can never leave the live key half-swapped.
 */
function secretKey(): string {
  const key = process.env["STRIPE_SECRET_KEY_TEST"] || process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return key;
}

export function webhookSecret(): string {
  const key =
    process.env["STRIPE_WEBHOOK_SECRET_TEST"] || process.env["STRIPE_WEBHOOK_SECRET"];
  if (!key) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return key;
}

async function stripeRequest(
  path: string,
  init?: { method?: string; body?: URLSearchParams },
): Promise<Record<string, unknown>> {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...(init?.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(init?.body ? { body: init.body } : {}),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Stripe request failed [${response.status}]: ${text}`);
    throw new Error(`Payment provider request failed [${response.status}]`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

export interface StripeSession {
  id: string;
  paymentStatus: string;
  amountTotal: number | null;
  currency: string | null;
  clientReferenceId: string | null;
  url: string | null;
}

function toSession(raw: Record<string, unknown>): StripeSession {
  return {
    id: String(raw["id"]),
    paymentStatus: String(raw["payment_status"] ?? ""),
    amountTotal: typeof raw["amount_total"] === "number" ? raw["amount_total"] : null,
    currency: typeof raw["currency"] === "string" ? raw["currency"] : null,
    clientReferenceId:
      typeof raw["client_reference_id"] === "string" ? raw["client_reference_id"] : null,
    url: typeof raw["url"] === "string" ? raw["url"] : null,
  };
}

export async function createStripeCheckoutSession(args: {
  businessId: string;
  amountCents: number;
  currency: string;
  productName: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<StripeSession> {
  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": args.currency,
    "line_items[0][price_data][unit_amount]": String(args.amountCents),
    "line_items[0][price_data][product_data][name]": args.productName,
    "line_items[0][price_data][product_data][description]": args.description,
    client_reference_id: args.businessId,
    "metadata[business_id]": args.businessId,
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
  });
  return toSession(await stripeRequest("/checkout/sessions", { method: "POST", body }));
}

/** The independent second check: read the session straight from the provider. */
export async function fetchStripeSession(sessionId: string): Promise<StripeSession> {
  return toSession(await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`));
}

const REPLAY_WINDOW_SECONDS = 300;

/**
 * Stripe webhook signature: HMAC-SHA256 over `${timestamp}.${rawBody}`, plus a
 * five-minute replay window. Returns false on anything that does not verify.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;

  let timestamp = "";
  const candidates: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.trim().split("=");
    if (key === "t" && value) timestamp = value;
    if (key === "v1" && value) candidates.push(value);
  }
  if (!timestamp || candidates.length === 0) return false;

  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (!Number.isFinite(age) || Math.abs(age) > REPLAY_WINDOW_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected);
  return candidates.some((candidate) => {
    const buf = Buffer.from(candidate);
    return buf.length === expectedBuf.length && timingSafeEqual(buf, expectedBuf);
  });
}

export interface VerificationOutcome {
  ok: boolean;
  reason?: string;
}

/**
 * Step 5 + 6 of the plan, shared by the webhook and the on-demand reconciliation
 * fallback. The live provider record — never the payload — decides. The lifecycle
 * transition is a single guarded statement, so running this twice is a no-op.
 */
export async function verifyAndActivate(sessionId: string): Promise<VerificationOutcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, business_id, amount_cents, currency, status")
    .eq("provider_session_id", sessionId)
    .maybeSingle();

  if (!payment) return { ok: false, reason: "unknown_session" };
  if (payment.status === "paid") return { ok: true };

  const fail = async (reason: string): Promise<VerificationOutcome> => {
    await supabaseAdmin
      .from("payments")
      .update({ status: "failed", failure_reason: reason })
      .eq("id", payment.id);
    console.error(`payment verification rejected [${reason}] session=${sessionId}`);
    return { ok: false, reason };
  };

  const session = await fetchStripeSession(sessionId);

  if (session.paymentStatus !== "paid") return fail(`payment_status:${session.paymentStatus}`);
  if (session.amountTotal !== payment.amount_cents) return fail("amount_mismatch");
  if ((session.currency ?? "").toLowerCase() !== payment.currency.toLowerCase())
    return fail("currency_mismatch");
  if (session.clientReferenceId !== payment.business_id) return fail("business_mismatch");

  // Both checks passed. One authorized transition, guarded on the expected state.
  const { data: transitioned, error: rpcError } = await supabaseAdmin.rpc(
    "activate_paid_business",
    { _business_id: payment.business_id },
  );
  if (rpcError) throw new Error(rpcError.message);

  await supabaseAdmin
    .from("payments")
    .update({
      status: "paid",
      api_verified_at: new Date().toISOString(),
      activated_at: transitioned ? new Date().toISOString() : null,
      raw_summary: {
        payment_status: session.paymentStatus,
        amount_total: session.amountTotal,
        currency: session.currency,
      },
    })
    .eq("id", payment.id);

  // Internal hand-off: staff get the full picture plus a link to finish provisioning.
  if (transitioned) {
    const { notifyTierPurchased } = await import("./purchase-notification.server");
    await notifyTierPurchased(payment.business_id, payment.amount_cents);

    // And the owner hears from us directly, once.
    const { sendOwnerWelcome } = await import("./owner-welcome.server");
    await sendOwnerWelcome(payment.business_id);
  }

  return { ok: true };
}
