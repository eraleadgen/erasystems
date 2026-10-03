import { createFileRoute } from "@tanstack/react-router";

/**
 * Payment webhook. Public prefix, so it authenticates itself.
 *
 * Order is the whole security property:
 *   1. raw body read before any parsing
 *   2. HMAC signature + five-minute replay window  -> 401 on failure
 *   3. only checkout.session.completed is acted on
 *   4. idempotency claim on the provider event id  -> 200 no-op on a repeat
 *   5. independent live API verification of the session (never the payload)
 *   6. one guarded lifecycle transition
 */
export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();

        const { verifyStripeSignature, webhookSecret } = await import("@/lib/payments.server");

        let secret: string;
        try {
          secret = webhookSecret();
        } catch {
          console.error("stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured");
          return new Response("Not configured", { status: 500 });
        }

        if (!verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: {
          id?: string;
          type?: string;
          data?: { object?: { id?: string; client_reference_id?: string } };
        };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        // Subscription lifecycle: the payload only names the subscription; every
        // fact is re-read from Stripe, so these handlers are naturally idempotent.
        const obj = (event.data?.object ?? {}) as Record<string, unknown>;
        if (
          event.type === "invoice.paid" ||
          event.type === "invoice.payment_failed" ||
          event.type === "customer.subscription.updated" ||
          event.type === "customer.subscription.deleted"
        ) {
          const parent = obj["parent"] as { subscription_details?: { subscription?: string } } | undefined;
          const subId = event.type.startsWith("customer.subscription")
            ? (obj["id"] as string | undefined)
            : ((obj["subscription"] as string | undefined) ?? parent?.subscription_details?.subscription);
          if (!subId) return new Response("ignored", { status: 200 });
          try {
            const { syncSubscription } = await import("@/lib/payments.server");
            const sub = await syncSubscription(subId);
            if (sub?.businessId && (event.type === "invoice.payment_failed" || event.type === "customer.subscription.deleted")) {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              if (event.type === "invoice.payment_failed") {
                await supabaseAdmin
                  .from("business_billing")
                  .update({ last_payment_failed_at: new Date().toISOString() })
                  .eq("business_id", sub.businessId);
              }
              const { data: biz } = await supabaseAdmin
                .from("businesses")
                .select("name")
                .eq("id", sub.businessId)
                .maybeSingle();
              const { sendStaffAlert } = await import("@/lib/staff-alerts.server");
              await sendStaffAlert({
                title: event.type === "invoice.payment_failed" ? "A client's payment failed" : "A client's Stripe subscription ended",
                businessId: sub.businessId,
                businessName: biz?.name ?? "Client",
                summary:
                  event.type === "invoice.payment_failed"
                    ? "Stripe couldn't charge this client's recurring payment. Stripe will retry; reach out to them to update their card."
                    : "The Stripe subscription was cancelled, so Stripe won't charge this client again.",
                idempotencyKey: `stripe-${event.id}`,
              });
            }
          } catch (error) {
            console.error("stripe subscription sync error", error instanceof Error ? error.message : error);
            return new Response("retry", { status: 500 });
          }
          return new Response("ok", { status: 200 });
        }

        if (event.type !== "checkout.session.completed") {
          return new Response("ignored", { status: 200 });
        }

        // Existing client starting a subscription: no activation, just link it.
        if ((obj["metadata"] as { kind?: string } | undefined)?.kind === "subscription_start") {
          try {
            const { fetchStripeSession, syncSubscription } = await import("@/lib/payments.server");
            const live = await fetchStripeSession(String(obj["id"]));
            if (live.status === "complete" && live.subscriptionId && live.kind === "subscription_start") {
              await syncSubscription(live.subscriptionId);
            }
          } catch (error) {
            console.error("subscription start sync error", error instanceof Error ? error.message : error);
            return new Response("retry", { status: 500 });
          }
          return new Response("ok", { status: 200 });
        }

        const eventId = event.id;
        const sessionId = event.data?.object?.id;
        if (!eventId || !sessionId) return new Response("Invalid payload", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency claim. Zero rows = already processed (or unknown session):
        // return 200 and do nothing else, so retries can never transition twice.
        const { data: claimed, error: claimError } = await supabaseAdmin
          .from("payments")
          .update({ provider_event_id: eventId, webhook_verified_at: new Date().toISOString() })
          .eq("provider_session_id", sessionId)
          .is("provider_event_id", null)
          .select("id")
          .maybeSingle();

        if (claimError || !claimed) {
          if (claimError && claimError.code !== "23505") {
            console.error("stripe webhook claim failed", claimError.message);
          }
          return new Response("ok", { status: 200 });
        }

        try {
          const { verifyAndActivate } = await import("@/lib/payments.server");
          await verifyAndActivate(sessionId);
        } catch (error) {
          console.error(
            "stripe webhook verification error",
            error instanceof Error ? error.message : error,
          );
          // Transient provider/database failure: release the claim so a retry can work.
          await supabaseAdmin
            .from("payments")
            .update({ provider_event_id: null })
            .eq("id", claimed.id);
          return new Response("retry", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
