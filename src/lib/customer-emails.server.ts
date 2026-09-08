/**
 * Customer-facing emails a tenant sends about its own bookings:
 * confirmation (immediately), reminder (~24h before), review request (after the job).
 *
 * Elevated access: registered in docs/elevated-access.md. These run either on the
 * public booking path (no session — the customer is anonymous) or from a scheduled
 * job authenticated by the cron secret. Every read and write is scoped to one
 * explicit booking id and that booking's own business_id; nothing accepts a
 * caller-supplied recipient.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { sendTemplateEmail } from "./email-templates/send-email";

type Admin = SupabaseClient<Database>;

export type BookingEmailKind = "confirmation" | "reminder" | "review";

const COLUMN: Record<BookingEmailKind, "confirmation_sent_at" | "reminder_sent_at" | "review_request_sent_at"> = {
  confirmation: "confirmation_sent_at",
  reminder: "reminder_sent_at",
  review: "review_request_sent_at",
};

const TEMPLATE: Record<BookingEmailKind, string> = {
  confirmation: "booking-confirmation",
  reminder: "appointment-reminder",
  review: "review-request",
};

export type BookingEmailResult =
  | { sent: true; recipient: string }
  | { sent: false; reason: "no_email" | "already_sent" | "not_found" | "business_inactive" | "recipient_suppressed" | "error" };

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function duration(startsAt: string, endsAt: string | null) {
  if (!endsAt) return "";
  const mins = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000);
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h ? `${h} hr` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

function whenLabel(iso: string, timezone: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return new Date(iso).toUTCString();
  }
}

/** The booking summary stores "Services: …" / "Address: …" lines; pull them back out. */
function fromNotes(notes: string | null, prefix: string) {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith(`${prefix}: `));
  return line ? line.slice(prefix.length + 2).trim() : "";
}

/**
 * Sends one booking email exactly once. The "sent" marker is claimed before the
 * send, so two overlapping job runs can never double-email a customer; the claim
 * is released again if the send itself fails.
 */
export async function sendBookingEmail(
  supabase: Admin,
  kind: BookingEmailKind,
  bookingId: string,
): Promise<BookingEmailResult> {
  const column = COLUMN[kind];

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      `id, business_id, customer_name, customer_email, starts_at, ends_at, total_cents, notes, status, ${column}`,
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { sent: false, reason: "not_found" };
  if ((booking as Record<string, unknown>)[column]) return { sent: false, reason: "already_sent" };
  const recipient = (booking.customer_email ?? "").trim();
  if (!recipient) return { sent: false, reason: "no_email" };

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, timezone, support_email, support_phone, brand_primary, is_active, lifecycle")
    .eq("id", booking.business_id)
    .maybeSingle();
  if (!business || !business.is_active || business.lifecycle !== "active") {
    return { sent: false, reason: "business_inactive" };
  }

  // Claim first: a second concurrent run finds the column already set.
  const { data: claimed } = await supabase
    .from("bookings")
    .update({ [column]: new Date().toISOString() } as never)
    .eq("id", bookingId)
    .eq("business_id", booking.business_id)
    .is(column, null)
    .select("id")
    .maybeSingle();
  if (!claimed) return { sent: false, reason: "already_sent" };

  const release = async () => {
    await supabase
      .from("bookings")
      .update({ [column]: null } as never)
      .eq("id", bookingId)
      .eq("business_id", booking.business_id);
  };

  let reviewUrl = "";
  if (kind === "review") {
    const { data: domain } = await supabase
      .from("business_domains")
      .select("hostname, is_primary, verified_at")
      .eq("business_id", booking.business_id)
      .not("verified_at", "is", null)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (domain?.hostname) reviewUrl = `https://${domain.hostname}`;
  }

  const templateData: Record<string, string> = {
    businessName: business.name,
    accent: business.brand_primary ?? "#0f766e",
    customerName: (booking.customer_name || "there").split(" ")[0] ?? "there",
    when: whenLabel(booking.starts_at, business.timezone ?? "UTC"),
    services: fromNotes(booking.notes, "Services"),
    address: fromNotes(booking.notes, "Address"),
    total: money(booking.total_cents ?? 0),
    durationLabel: duration(booking.starts_at, booking.ends_at),
    supportEmail: business.support_email ?? "",
    supportPhone: business.support_phone ?? "",
    ...(kind === "review" ? { reviewUrl } : {}),
  };

  try {
    const result = await sendTemplateEmail(TEMPLATE[kind], recipient, {
      idempotencyKey: `${TEMPLATE[kind]}-${bookingId}`,
      ...(business.support_email ? { replyTo: business.support_email } : {}),
      templateData,
    });
    if (!result.sent) {
      // Suppressed is final for this recipient — keep the marker so we don't retry forever.
      return { sent: false, reason: "recipient_suppressed" };
    }
    return { sent: true, recipient };
  } catch (error) {
    await release();
    console.error(
      `booking ${kind} email failed for ${bookingId}`,
      error instanceof Error ? error.message : error,
    );
    return { sent: false, reason: "error" };
  }
}

/** Fire-and-forget confirmation from the public booking path. Never fails the booking. */
export async function sendBookingConfirmationSafely(bookingId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await sendBookingEmail(supabaseAdmin, "confirmation", bookingId);
  } catch (error) {
    console.error(
      "booking confirmation email failed",
      error instanceof Error ? error.message : error,
    );
  }
}
