import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { getRequestHostname } from "./tenant-hostname";

const discoverySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  businessName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  businessType: z.string().trim().max(120).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  /** ISO UTC start of the chosen discovery-call slot, when scheduling is live. */
  slotStart: z.string().datetime().optional().or(z.literal("")),
});

export type DiscoveryRequestInput = z.infer<typeof discoverySchema>;

/**
 * Open 60 minute discovery-call slots on the ERA calendar, Mon–Fri 10:00–18:00 ET.
 * Returns an empty list when scheduling isn't available; the form then falls
 * back to "we'll email you a time".
 */
export const listDiscoverySlots = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getOpenSlots } = await import("./google-calendar.server");
    const slots = await getOpenSlots();
    return { slots: slots.slice(0, 60) };
  } catch (error) {
    console.error("discovery slot lookup failed", error);
    return { slots: [] as { start: string; end: string }[] };
  }
});

/**
 * Public marketing contact form. Writes through the anon-scoped Data API — no
 * elevated privileges, no account creation. Registration stays invite-only.
 */
export const submitDiscoveryRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => discoverySchema.parse(input))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Contact form is not configured yet.");

    const supabasePublic = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const hostname = getRequestHostname(getRequest());

    // Book the call on the ERA calendar first: a taken or invalid slot must be
    // reported before we store anything, so the prospect can pick again.
    let scheduledStart: string | null = null;
    let calendarEventId: string | null = null;
    if (data.slotStart) {
      const { candidateSlots } = await import("./booking");
      const requested = new Date(data.slotStart).toISOString();
      const valid = candidateSlots().some((slot) => slot.start === requested);
      if (!valid) throw new Error("That time is no longer available. Please pick another slot.");

      const { bookDiscoveryCall } = await import("./google-calendar.server");
      const booked = await bookDiscoveryCall({
        startIso: requested,
        fullName: data.fullName,
        businessName: data.businessName,
        email: data.email,
        phone: data.phone || undefined,
        businessType: data.businessType || undefined,
        message: data.message || undefined,
      });
      scheduledStart = requested;
      calendarEventId = booked.eventId;
    }

    const { error } = await supabasePublic.from("discovery_requests").insert({
      full_name: data.fullName,
      business_name: data.businessName,
      email: data.email.toLowerCase(),
      phone: data.phone ? data.phone : null,
      business_type: data.businessType ? data.businessType : null,
      message: data.message ? data.message : null,
      source_hostname: hostname,
      status: scheduledStart ? "scheduled" : "new",
      scheduled_start: scheduledStart,
      calendar_event_id: calendarEventId,
    });

    if (error) throw new Error("We couldn't submit that just now. Please try again.");

    // Notify staff so they can schedule the discovery call. A failed notification
    // must never lose the stored request.
    try {
      const { formatSlotLabel } = await import("./booking");
      const bookedLine = scheduledStart
        ? `Discovery call booked for ${formatSlotLabel(scheduledStart)} (already on the ERA calendar).`
        : null;
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      await sendTemplateEmail("discovery-request", "support@eraleadgen.com", {
        replyTo: data.email,
        templateData: {
          fullName: data.fullName,
          businessName: data.businessName,
          email: data.email,
          phone: data.phone || undefined,
          businessType: data.businessType || undefined,
          message: [bookedLine, data.message || null].filter(Boolean).join("\n\n") || undefined,
          submittedAt: new Date().toUTCString(),
          sourceHostname: hostname,
        },
      });
    } catch (notifyError) {
      console.error("discovery notification failed", notifyError);
    }

    // Acknowledge the prospect. A failed confirmation never fails the request.
    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      await sendTemplateEmail("discovery-confirmation", data.email, {
        templateData: { fullName: data.fullName, businessName: data.businessName },
        idempotencyKey: `discovery-confirm-${data.email.toLowerCase()}-${Date.now()}`,
      });
    } catch (confirmError) {
      console.error("discovery confirmation failed", confirmError);
    }

    return { ok: true as const, scheduledStart };
  });

