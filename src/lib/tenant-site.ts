/** Browser-safe types and helpers for a tenant's public website content. */

import { z } from "zod";

import { WEEK_DAYS, DAY_LABELS, type DayKey } from "./onboarding";

export type DayHours = { closed: boolean; open: string; close: string };
export type WeekHours = Partial<Record<DayKey, DayHours>>;

export type TenantSiteContent = {
  tagline: string;
  about: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  serviceArea: string;
  hours: WeekHours;
  bookingEnabled: boolean;
  /** Where the work happens; decides whether the booking form asks for an address. */
  serviceLocation: "at_business" | "at_customer";
};

export const dayHoursSchema = z.object({
  closed: z.boolean(),
  open: z.string().max(5),
  close: z.string().max(5),
});

export const weekHoursSchema = z.record(z.enum(WEEK_DAYS), dayHoursSchema);

export const siteContentSchema = z.object({
  tagline: z.string().trim().max(200).default(""),
  about: z.string().trim().max(4000).default(""),
  serviceArea: z.string().trim().max(200).default(""),
  addressLine1: z.string().trim().max(200).default(""),
  addressLine2: z.string().trim().max(200).default(""),
  city: z.string().trim().max(120).default(""),
  region: z.string().trim().max(120).default(""),
  postalCode: z.string().trim().max(40).default(""),
  country: z.string().trim().max(120).default(""),
  hours: weekHoursSchema.default({}),
  bookingEnabled: z.boolean().default(true),
  serviceLocation: z.enum(["at_business", "at_customer"]).default("at_business"),
});

export const emptySiteContent = (): TenantSiteContent => ({
  tagline: "",
  about: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  serviceArea: "",
  hours: {},
  bookingEnabled: true,
  serviceLocation: "at_business",
});

export function formatAddress(site: TenantSiteContent): string {
  const cityLine = [site.city, site.region].filter(Boolean).join(", ");
  return [
    site.addressLine1,
    site.addressLine2,
    [cityLine, site.postalCode].filter(Boolean).join(" "),
    site.country,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function hasHours(hours: WeekHours): boolean {
  return WEEK_DAYS.some((day) => hours[day]);
}

export function hoursRows(hours: WeekHours): { label: string; value: string }[] {
  return WEEK_DAYS.filter((day) => hours[day]).map((day) => {
    const entry = hours[day]!;
    return {
      label: DAY_LABELS[day],
      value: entry.closed ? "Closed" : `${entry.open} – ${entry.close}`,
    };
  });
}

/**
 * A tenant that has not written its own tagline still needs a real sentence on
 * its home page. Built from the business's own name and catalog — never from
 * ERA copy or any other tenant's content.
 */
/** Names like "Smith & Sons Inc." already end in a period — don't add a second. */
const asSentenceEnd = (name: string) => (/[.!?]$/.test(name.trim()) ? name.trim() : `${name.trim()}.`);

export function fallbackTagline(businessName: string, serviceNames: string[]): string {
  if (serviceNames.length === 0) return `Professional service from ${asSentenceEnd(businessName)}`;
  const list =
    serviceNames.length === 1
      ? serviceNames[0]
      : `${serviceNames.slice(0, 2).join(", ")}${serviceNames.length > 2 ? " and more" : ""}`;
  return `${list} from ${asSentenceEnd(businessName)} Book online in under a minute.`;
}

export function fallbackAbout(
  businessName: string,
  serviceNames: string[],
  serviceArea: string,
): string {
  const where = serviceArea ? ` serving ${serviceArea}` : "";
  const what =
    serviceNames.length > 0
      ? ` We handle ${serviceNames.slice(0, 4).join(", ")} — with clear pricing shown up front.`
      : "";
  return `${asSentenceEnd(`${businessName} is a local service business${where}`)}${what} Pick what you need, choose a time that works, and we'll confirm your booking.`;
}
