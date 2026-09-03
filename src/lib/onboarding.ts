/** Shared, browser-safe onboarding types and schemas. No server imports, no secrets. */

import { z } from "zod";

export const ONBOARDING_STEPS = [
  "basics",
  "branding",
  "catalog",
  "team",
  "integrations",
  "review",
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number];

export const STEP_LABELS: Record<OnboardingStepKey, string> = {
  basics: "Business basics",
  branding: "Branding",
  catalog: "Services & pricing",
  team: "Team",
  integrations: "Integrations",
  review: "Review",
};

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAYS)[number];
export const WEEK_DAYS = DAYS;

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const hourSchema = z.object({
  closed: z.boolean(),
  open: z.string().max(5),
  close: z.string().max(5),
});

export const basicsSchema = z.object({
  legalName: z.string().min(1).max(160),
  displayName: z.string().min(1).max(160),
  addressLine1: z.string().max(200).default(""),
  addressLine2: z.string().max(200).default(""),
  city: z.string().max(120).default(""),
  region: z.string().max(120).default(""),
  postalCode: z.string().max(40).default(""),
  country: z.string().max(120).default(""),
  timezone: z.string().min(1).max(64).default("America/New_York"),
  supportEmail: z.string().email().max(254).or(z.literal("")).default(""),
  supportPhone: z.string().max(40).default(""),
  hours: z.record(z.enum(DAYS), hourSchema),
});

export const brandingSchema = z.object({
  logoPath: z.string().max(400).nullable().default(null),
  brandPrimary: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .or(z.literal(""))
    .default(""),
  brandAccent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .or(z.literal(""))
    .default(""),
});

export const serviceSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2000).default(""),
  durationMinutes: z.number().int().min(5).max(1440),
  priceCents: z.number().int().min(0).max(100_000_000),
});

export const catalogSchema = z.object({ services: z.array(serviceSchema).max(100) });

/** Half-typed rows are normal mid-wizard; completion still uses the strict schemas. */
const draftServiceSchema = z.object({
  name: z.string().max(160).default(""),
  description: z.string().max(2000).default(""),
  durationMinutes: z.number().int().min(0).max(1440).default(30),
  priceCents: z.number().int().min(0).max(100_000_000).default(0),
});

export const draftCatalogSchema = z.object({ services: z.array(draftServiceSchema).max(100) });

export const teamMemberSchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email().max(254),
  title: z.string().max(120).default(""),
});

export const teamSchema = z.object({ members: z.array(teamMemberSchema).max(100) });

const draftTeamMemberSchema = z.object({
  fullName: z.string().max(120).default(""),
  email: z.string().max(254).default(""),
  title: z.string().max(120).default(""),
});

export const draftTeamSchema = z.object({ members: z.array(draftTeamMemberSchema).max(100) });

export const integrationsSchema = z.object({
  desiredDomain: z.string().max(253).default(""),
  desiredEmail: z.string().max(254).default(""),
  desiredPhone: z.string().max(40).default(""),
  existingWebsite: z.string().max(400).default(""),
  notes: z.string().max(2000).default(""),
});

export const draftDataSchema = z.object({
  basics: basicsSchema.partial().optional(),
  branding: brandingSchema.partial().optional(),
  catalog: draftCatalogSchema.partial().optional(),
  team: draftTeamSchema.partial().optional(),
  integrations: integrationsSchema.partial().optional(),
});


export type Basics = z.infer<typeof basicsSchema>;
export type Branding = z.infer<typeof brandingSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export type Team = z.infer<typeof teamSchema>;
export type Integrations = z.infer<typeof integrationsSchema>;
export type DraftData = z.infer<typeof draftDataSchema>;

export interface OnboardingDraft {
  id: string;
  status: "in_progress" | "completed";
  currentStep: number;
  data: DraftData;
  businessId: string | null;
  /** Pre-fill only. The account this draft belongs to is resolved server-side. */
  accountEmail: string;
}

export const defaultHours = (): Record<DayKey, { closed: boolean; open: string; close: string }> =>
  Object.fromEntries(
    DAYS.map((day) => [
      day,
      day === "sat" || day === "sun"
        ? { closed: true, open: "09:00", close: "17:00" }
        : { closed: false, open: "09:00", close: "17:00" },
    ]),
  ) as Record<DayKey, { closed: boolean; open: string; close: string }>;

export function emptyBasics(email: string): Basics {
  return {
    legalName: "",
    displayName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "",
    timezone: "America/New_York",
    supportEmail: email,
    supportPhone: "",
    hours: defaultHours(),
  };
}

/** URL-safe slug candidate. The server owns uniqueness. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
