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
  status: string;
  amountTotal: number | null;
  currency: string | null;
  clientReferenceId: string | null;
  url: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  kind: string | null;
}

function toSession(raw: Record<string, unknown>): StripeSession {
  const meta = (raw["metadata"] ?? {}) as Record<string, unknown>;
  return {
    id: String(raw["id"]),
    paymentStatus: String(raw["payment_status"] ?? ""),
    status: String(raw["status"] ?? ""),
    amountTotal: typeof raw["amount_total"] === "number" ? raw["amount_total"] : null,
    currency: typeof raw["currency"] === "string" ? raw["currency"] : null,
    clientReferenceId:
      typeof raw["client_reference_id"] === "string" ? raw["client_reference_id"] : null,
    url: typeof raw["url"] === "string" ? raw["url"] : null,
    subscriptionId: typeof raw["subscription"] === "string" ? raw["subscription"] : null,
    customerId: typeof raw["customer"] === "string" ? raw["customer"] : null,
    kind: typeof meta["kind"] === "string" ? (meta["kind"] as string) : null,
  };
}

/** Stripe recurring interval for an ERA billing interval; null = not recurring. */
export function stripeRecurring(interval: string): { interval: "month" | "year"; count: number } | null {
  if (interval === "monthly") return { interval: "month", count: 1 };
  if (interval === "quarterly") return { interval: "month", count: 3 };
  if (interval === "annual") return { interval: "year", count: 1 };
  return null;
}

export interface CheckoutLine {
  name: string;
  amountCents: number;
  /** ERA billing interval; "one_time" lines are charged once on the first invoice. */
  interval: string;
}

/**
 * Checkout charging exactly the staff-quoted amounts. When any line recurs the
 * session is a Stripe subscription: one-time lines (setup fee) land on the first
 * invoice only, recurring lines repeat automatically every period.
 */
export async function createStripeCheckoutSession(args: {
  businessId: string;
  currency: string;
  lines: CheckoutLine[];
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
  kind?: "activation" | "subscription_start";
  trialEnd?: number | null;
}): Promise<StripeSession> {
  const recurringLines = args.lines.filter((l) => stripeRecurring(l.interval) && l.amountCents > 0);
  const subscription = recurringLines.length > 0;
  const body = new URLSearchParams({
    mode: subscription ? "subscription" : "payment",
    client_reference_id: args.businessId,
    "metadata[business_id]": args.businessId,
    "metadata[kind]": args.kind ?? "activation",
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
  });
  if (args.customerEmail) body.set("customer_email", args.customerEmail);
  let i = 0;
  for (const line of args.lines) {
    if (line.amountCents <= 0) continue;
    const p = `line_items[${i}]`;
    body.set(`${p}[quantity]`, "1");
    body.set(`${p}[price_data][currency]`, args.currency);
    body.set(`${p}[price_data][unit_amount]`, String(line.amountCents));
    body.set(`${p}[price_data][product_data][name]`, line.name);
    body.set(`${p}[price_data][product_data][description]`, args.description);
    const rec = subscription ? stripeRecurring(line.interval) : null;
    if (rec) {
      body.set(`${p}[price_data][recurring][interval]`, rec.interval);
      body.set(`${p}[price_data][recurring][interval_count]`, String(rec.count));
    }
    i++;
  }
  if (subscription) {
    body.set("subscription_data[metadata][business_id]", args.businessId);
    if (args.trialEnd) body.set("subscription_data[trial_end]", String(args.trialEnd));
  }
  return toSession(await stripeRequest("/checkout/sessions", { method: "POST", body }));
}

export interface StripeSubscription {
  id: string;
  status: string;
  customerId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  businessId: string | null;
  items: { id: string; productId: string; productName: string; unitAmount: number }[];
}

function toSubscription(raw: Record<string, unknown>): StripeSubscription {
  const items = ((raw["items"] as { data?: unknown[] })?.data ?? []) as Record<string, any>[];
  const end =
    typeof raw["current_period_end"] === "number"
      ? (raw["current_period_end"] as number)
      : typeof items[0]?.["current_period_end"] === "number"
        ? (items[0]!["current_period_end"] as number)
        : null;
  const meta = (raw["metadata"] ?? {}) as Record<string, unknown>;
  return {
    id: String(raw["id"]),
    status: String(raw["status"] ?? ""),
    customerId: typeof raw["customer"] === "string" ? raw["customer"] : null,
    currentPeriodEnd: end ? new Date(end * 1000).toISOString() : null,
    cancelAtPeriodEnd: Boolean(raw["cancel_at_period_end"]),
    businessId: typeof meta["business_id"] === "string" ? (meta["business_id"] as string) : null,
    items: items.map((it) => {
      const product = it["price"]?.["product"];
      return {
        id: String(it["id"]),
        productId: typeof product === "string" ? product : String(product?.["id"] ?? ""),
        productName: typeof product === "object" && product ? String(product["name"] ?? "") : "",
        unitAmount: Number(it["price"]?.["unit_amount"] ?? 0),
      };
    }),
  };
}

export async function fetchStripeSubscription(id: string): Promise<StripeSubscription> {
  return toSubscription(
    await stripeRequest(
      `/subscriptions/${encodeURIComponent(id)}?expand[]=items.data.price.product`,
    ),
  );
}

/** Changes the plan price from the next billing date. No partial charges. */
export async function updateStripeSubscriptionPrice(args: {
  subscriptionId: string;
  amountCents: number;
  interval: string;
}): Promise<void> {
  const rec = stripeRecurring(args.interval);
  if (!rec) throw new Error("A Stripe subscription needs a monthly, quarterly or annual interval.");
  const sub = await fetchStripeSubscription(args.subscriptionId);
  const plan = sub.items.find((it) => it.productName.includes("plan")) ?? sub.items[0];
  if (!plan) throw new Error("This Stripe subscription has no plan item.");
  const body = new URLSearchParams({
    proration_behavior: "none",
    "items[0][id]": plan.id,
    "items[0][price_data][currency]": "usd",
    "items[0][price_data][product]": plan.productId,
    "items[0][price_data][unit_amount]": String(args.amountCents),
    "items[0][price_data][recurring][interval]": rec.interval,
    "items[0][price_data][recurring][interval_count]": String(rec.count),
  });
  await stripeRequest(`/subscriptions/${encodeURIComponent(args.subscriptionId)}`, {
    method: "POST",
    body,
  });
}

export async function setStripeCancelAtPeriodEnd(subscriptionId: string, cancel: boolean) {
  await stripeRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "POST",
    body: new URLSearchParams({ cancel_at_period_end: String(cancel) }),
  });
}

/**
 * Mirrors the live Stripe subscription onto business_billing. Elevated write,
 * keyed by the business id Stripe returns for a subscription we created.
 */
export async function syncSubscription(subscriptionId: string): Promise<StripeSubscription | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sub = await fetchStripeSubscription(subscriptionId);
  const { data: row } = await supabaseAdmin
    .from("business_billing")
    .select("business_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  const businessId = row?.business_id ?? sub.businessId;
  if (!businessId) return null;
  await supabaseAdmin.from("business_billing").upsert({
    business_id: businessId,
    stripe_customer_id: sub.customerId,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    current_period_end: sub.currentPeriodEnd,
    cancel_at_period_end: sub.cancelAtPeriodEnd,
  });
  return { ...sub, businessId };
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

  // Remember the Stripe subscription so later billing changes reach Stripe.
  if (session.subscriptionId) {
    try {
      await syncSubscription(session.subscriptionId);
    } catch (error) {
      console.error("subscription sync failed", error instanceof Error ? error.message : error);
    }
  }

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
