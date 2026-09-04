/**
 * Google Calendar access for the ERA discovery-call booking flow.
 *
 * Calls go through the Lovable connector gateway with the workspace Google
 * Calendar connection (the ERA support calendar), never the provider API
 * directly. This is the agency's own calendar, not a per-visitor account.
 */

import { CALL_MINUTES, candidateSlots, type DiscoverySlot } from "./booking";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const CALENDAR_ID = "primary";

function credentials() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_CALENDAR_API_KEY"];
  if (!lovableKey || !connectionKey) return null;
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
    "Content-Type": "application/json",
  } as const;
}

export function calendarConfigured(): boolean {
  return credentials() !== null;
}

async function callCalendar(path: string, init: RequestInit & { method: string }) {
  const headers = credentials();
  if (!headers) throw new Error("Google Calendar is not connected.");

  const response = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Google Calendar request failed [${response.status}]: ${body}`);
    throw new Error(`Google Calendar request failed [${response.status}]: ${body}`);
  }
  return response.json();
}

type BusyPeriod = { start: string; end: string };

async function busyPeriods(timeMin: string, timeMax: string): Promise<BusyPeriod[]> {
  const data = (await callCalendar("/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: CALENDAR_ID }] }),
  })) as { calendars?: Record<string, { busy?: BusyPeriod[] }> };

  return data.calendars?.[CALENDAR_ID]?.busy ?? [];
}

function overlaps(slot: DiscoverySlot, busy: BusyPeriod[]): boolean {
  const start = Date.parse(slot.start);
  const end = Date.parse(slot.end);
  return busy.some((b) => Date.parse(b.start) < end && Date.parse(b.end) > start);
}

/** Open working-hours slots that don't collide with anything on the calendar. */
export async function getOpenSlots(now = new Date()): Promise<DiscoverySlot[]> {
  const candidates = candidateSlots(now);
  if (candidates.length === 0) return [];
  if (!calendarConfigured()) return [];

  const timeMin = candidates[0]!.start;
  const timeMax = candidates[candidates.length - 1]!.end;
  const busy = await busyPeriods(timeMin, timeMax);
  return candidates.filter((slot) => !overlaps(slot, busy));
}

export type BookingDetails = {
  startIso: string;
  fullName: string;
  businessName: string;
  email: string;
  phone?: string;
  businessType?: string;
  message?: string;
};

/**
 * Book the call. The slot is re-checked against live busy data immediately
 * before writing so two prospects can't take the same time.
 */
export async function bookDiscoveryCall(
  details: BookingDetails,
): Promise<{ eventId: string; htmlLink: string | null }> {
  const start = new Date(details.startIso);
  const end = new Date(start.getTime() + CALL_MINUTES * 60_000);

  const busy = await busyPeriods(start.toISOString(), end.toISOString());
  if (overlaps({ start: start.toISOString(), end: end.toISOString() }, busy)) {
    throw new Error("That time was just taken. Please pick another slot.");
  }

  const descriptionLines = [
    `Business: ${details.businessName}`,
    `Contact: ${details.fullName} <${details.email}>`,
    details.phone ? `Phone: ${details.phone}` : null,
    details.businessType ? `Business type: ${details.businessType}` : null,
    "",
    details.message ? `Notes:\n${details.message}` : "No notes provided.",
  ].filter(Boolean);

  const event = (await callCalendar(
    `/calendars/${encodeURIComponent(CALENDAR_ID)}/events?sendUpdates=all&conferenceDataVersion=1`,
    {
      method: "POST",
      body: JSON.stringify({
        summary: `ERA discovery call — ${details.businessName}`,
        description: descriptionLines.join("\n"),
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: [{ email: details.email, displayName: details.fullName }],
        conferenceData: {
          createRequest: {
            requestId: `era-${start.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: { useDefault: true },
      }),
    },
  )) as { id: string; htmlLink?: string };

  return { eventId: event.id, htmlLink: event.htmlLink ?? null };
}
