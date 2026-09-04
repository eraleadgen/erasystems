/**
 * Discovery-call scheduling rules. Client-safe (no secrets, no network).
 */

export const BOOKING_TIMEZONE = "America/New_York";
export const CALL_MINUTES = 60;
/** Working hours in BOOKING_TIMEZONE, Monday through Friday. */
export const WORK_START_HOUR = 10;
export const WORK_END_HOUR = 18;
/** Earliest bookable time from now, and how far ahead slots are offered. */
export const MIN_NOTICE_HOURS = 12;
export const BOOKING_HORIZON_DAYS = 14;

export type DiscoverySlot = {
  /** ISO UTC start of the 60 minute slot. */
  start: string;
  end: string;
};

function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return (asUtc - instant.getTime()) / 60000;
}

/** Convert a wall-clock time in `timeZone` to the matching UTC instant. */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone = BOOKING_TIMEZONE,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour);
  let result = guess - offsetMinutes(new Date(guess), timeZone) * 60000;
  // One correction pass handles DST boundary days.
  result = guess - offsetMinutes(new Date(result), timeZone) * 60000;
  return new Date(result);
}

/** Local calendar parts (y/m/d and weekday) for an instant in `timeZone`. */
export function zonedParts(instant: Date, timeZone = BOOKING_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday"),
  };
}

const WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

/**
 * Every candidate working-hours slot in the booking window, before busy times
 * are subtracted.
 */
export function candidateSlots(now = new Date()): DiscoverySlot[] {
  const earliest = now.getTime() + MIN_NOTICE_HOURS * 3600_000;
  const latest = now.getTime() + BOOKING_HORIZON_DAYS * 86_400_000;
  const slots: DiscoverySlot[] = [];

  for (let dayOffset = 0; dayOffset <= BOOKING_HORIZON_DAYS; dayOffset += 1) {
    const dayInstant = new Date(now.getTime() + dayOffset * 86_400_000);
    const { year, month, day, weekday } = zonedParts(dayInstant);
    if (!WEEKDAYS.has(weekday)) continue;

    for (let hour = WORK_START_HOUR; hour + CALL_MINUTES / 60 <= WORK_END_HOUR; hour += 1) {
      const start = zonedToUtc(year, month, day, hour);
      const startMs = start.getTime();
      if (startMs < earliest || startMs > latest) continue;
      slots.push({
        start: start.toISOString(),
        end: new Date(startMs + CALL_MINUTES * 60_000).toISOString(),
      });
    }
  }

  return slots.sort((a, b) => a.start.localeCompare(b.start));
}

export function formatSlotLabel(startIso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BOOKING_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(startIso));
}

export function formatSlotDay(startIso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BOOKING_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(startIso));
}
