/**
 * VDS Mobile pricing engine, ported from the Base44 build.
 *
 * Pure data + arithmetic, no platform dependencies. The formula is identical to
 * the original engine:
 *
 *   total = round(base services x condition multiplier)
 *         + add-ons at face value
 *         - 20% of the conditioned base when paint protection is selected
 *
 * Services marked `requires_consultation` carry no price; they are quoted after
 * a free consultation.
 */

export interface VdsTier {
  tier: string;
  duration_minutes: number;
  price: number;
}

export interface VdsService {
  key: string;
  label: string;
  category: "detail" | "addon" | "coating" | "correction" | "membership";
  description: string | null;
  requires_consultation: boolean;
  tiers: VdsTier[];
}

export interface VdsConditionMultiplier {
  label: string;
  key: string;
  multiplier: number;
  duration_add_minutes: number;
}

export interface VdsConfig {
  business_name: string;
  classification_to_pricing_group: Record<string, string>;
  pricing_rules: { condition_multipliers: VdsConditionMultiplier[] };
  vehicle_classifications: { key: string; label: string }[];
  pricing_groups: { key: string; label: string; stripe_price_id: string }[];
  services: VdsService[];
  scheduling_rules: {
    booking_buffer_hours: number;
    min_notice_hours: number;
    cancellation_hours: number;
    slot_interval_minutes: number;
    max_bookings_per_day: number;
  };
  website_links: Record<string, string>;
}

export const VDS_CONFIG: VdsConfig = {
  business_name: "VDS Mobile",
  classification_to_pricing_group: {
    coupe: "sedan_coupe",
    sedan: "sedan_coupe",
    hatchback: "sedan_coupe",
    mid_size_suv: "truck_suv",
    truck_3_row_suv: "truck_suv",
    other: "sedan_coupe",
  },
  pricing_rules: {
    condition_multipliers: [
      { label: "Light Wear", key: "light", multiplier: 1, duration_add_minutes: 0 },
      { label: "Moderate Wear", key: "moderate", multiplier: 1.2, duration_add_minutes: 30 },
      { label: "Heavy Wear", key: "heavy", multiplier: 1.4, duration_add_minutes: 60 },
    ],
  },
  vehicle_classifications: [
    { key: "coupe", label: "Coupe" },
    { key: "sedan", label: "Sedan" },
    { key: "mid_size_suv", label: "Mid Size SUV" },
    { key: "truck_3_row_suv", label: "Truck / 3 Row SUV" },
    { key: "hatchback", label: "Hatchback" },
    { key: "other", label: "Other" },
  ],
  pricing_groups: [
    { key: "sedan_coupe", label: "Sedan / Coupe", stripe_price_id: "price_1TuJVK2MUlDjgwKfac7ADwFt" },
    { key: "truck_suv", label: "Truck / SUV", stripe_price_id: "price_1TuJVK2MUlDjgwKfECnrClRv" },
  ],
  services: [
    {
      key: "full_detail",
      label: "Full Detail",
      category: "detail",
      description: "Interior & exterior restoration",
      requires_consultation: false,
      tiers: [
        { tier: "coupe", duration_minutes: 120, price: 150 },
        { tier: "sedan", duration_minutes: 120, price: 175 },
        { tier: "mid_size_suv", duration_minutes: 150, price: 200 },
        { tier: "truck_3_row_suv", duration_minutes: 150, price: 250 },
        { tier: "hatchback", duration_minutes: 120, price: 150 },
      ],
    },
    {
      key: "exterior_detail",
      label: "Exterior Detail",
      category: "detail",
      description: "Hand wash, rims, sealant",
      requires_consultation: false,
      tiers: [
        { tier: "sedan_coupe", duration_minutes: 60, price: 100 },
        { tier: "truck_suv", duration_minutes: 60, price: 115 },
      ],
    },
    {
      key: "interior_detail",
      label: "Interior Detail",
      category: "detail",
      description: "Steam clean, deep vacuum",
      requires_consultation: false,
      tiers: [
        { tier: "sedan_coupe", duration_minutes: 90, price: 120 },
        { tier: "truck_suv", duration_minutes: 90, price: 150 },
      ],
    },
    {
      key: "ceramic_sealant",
      label: "Ceramic Sealant (3 Month)",
      category: "addon",
      description: "Optional add-on sealant",
      requires_consultation: false,
      tiers: [
        { tier: "sedan_coupe", duration_minutes: 30, price: 50 },
        { tier: "truck_suv", duration_minutes: 45, price: 50 },
      ],
    },
    {
      key: "engine_bay",
      label: "Engine Bay Detail",
      category: "addon",
      description: "Optional add-on",
      requires_consultation: false,
      tiers: [
        { tier: "sedan_coupe", duration_minutes: 30, price: 50 },
        { tier: "truck_suv", duration_minutes: 30, price: 50 },
      ],
    },
    {
      key: "headlight_restoration",
      label: "Headlight Restoration",
      category: "addon",
      description: "Optional add-on",
      requires_consultation: false,
      tiers: [
        { tier: "sedan_coupe", duration_minutes: 60, price: 100 },
        { tier: "truck_suv", duration_minutes: 60, price: 100 },
      ],
    },
    {
      key: "pet_hair_removal",
      label: "Pet Hair Removal",
      category: "addon",
      description: null,
      requires_consultation: false,
      tiers: [
        { tier: "sedan_coupe", duration_minutes: 30, price: 50 },
        { tier: "truck_suv", duration_minutes: 30, price: 50 },
      ],
    },
    {
      key: "ceramic_coating_2yr",
      label: "Ceramic Coating",
      category: "coating",
      description: "Long-term paint protection",
      requires_consultation: true,
      tiers: [
        { tier: "sedan_coupe", duration_minutes: 30, price: 900 },
        { tier: "truck_suv", duration_minutes: 30, price: 900 },
      ],
    },
    {
      key: "ceramic_coating_3yr",
      label: "Ceramic Coating (3 Year)",
      category: "coating",
      description: "Long-term paint protection",
      requires_consultation: true,
      tiers: [
        { tier: "sedan_coupe", duration_minutes: 30, price: 1000 },
        { tier: "truck_suv", duration_minutes: 30, price: 1000 },
      ],
    },
    {
      key: "ceramic_coating_5yr",
      label: "Ceramic Coating (5 Year)",
      category: "coating",
      description: "Long-term paint protection",
      requires_consultation: true,
      tiers: [
        { tier: "sedan_coupe", duration_minutes: 30, price: 1300 },
        { tier: "truck_suv", duration_minutes: 30, price: 1300 },
      ],
    },
    {
      key: "ceramic_coating_7yr",
      label: "Ceramic Coating (7 Year)",
      category: "coating",
      description: "Long-term paint protection",
      requires_consultation: true,
      tiers: [
        { tier: "sedan_coupe", duration_minutes: 30, price: 1500 },
        { tier: "truck_suv", duration_minutes: 30, price: 1500 },
      ],
    },
    {
      key: "paint_correction_stage1",
      label: "Paint Correction",
      category: "correction",
      description: "Swirl & scratch removal",
      requires_consultation: true,
      tiers: [
        { tier: "sedan_coupe", duration_minutes: 30, price: 600 },
        { tier: "truck_suv", duration_minutes: 30, price: 600 },
      ],
    },
    {
      key: "paint_correction_stage2",
      label: "Paint Correction (Stage 2)",
      category: "correction",
      description: "Deeper defect removal",
      requires_consultation: true,
      tiers: [
        { tier: "sedan_coupe", duration_minutes: 30, price: 900 },
        { tier: "truck_suv", duration_minutes: 30, price: 900 },
      ],
    },
    {
      key: "paint_correction_stage3",
      label: "Paint Correction (Stage 3)",
      category: "correction",
      description: "Full correction",
      requires_consultation: true,
      tiers: [
        { tier: "sedan_coupe", duration_minutes: 30, price: 1100 },
        { tier: "truck_suv", duration_minutes: 30, price: 1100 },
      ],
    },
    {
      key: "vds_gold",
      label: "VDS Gold Membership",
      category: "membership",
      description: "Monthly membership per vehicle",
      requires_consultation: false,
      tiers: [
        { tier: "sedan_coupe", duration_minutes: 0, price: 250 },
        { tier: "truck_suv", duration_minutes: 0, price: 300 },
      ],
    },
  ],
  scheduling_rules: {
    booking_buffer_hours: 24,
    min_notice_hours: 24,
    cancellation_hours: 48,
    slot_interval_minutes: 60,
    max_bookings_per_day: 4,
  },
  website_links: {
    booking_url: "https://vdsmobile.com/book",
    gold_signup_url: "https://vdsmobile.com/vds-gold",
    gallery_url: "https://vdsmobile.com/gallery",
    google_review_url: "https://g.page/r/Ccmdnzs_a305EBM/review",
  },
};

/** Resolve the pricing group ("sedan_coupe" / "truck_suv") for a classification. */
export function resolvePricingGroup(config: VdsConfig, classification?: string | null): string {
  const map = config.classification_to_pricing_group || {};
  if (classification && map[classification]) return map[classification]!;
  return "sedan_coupe";
}

/** Per-classification tier first, then pricing group, then the first tier listed. */
export function lookupTier(
  svc: VdsService,
  classification?: string | null,
  pricingGroup?: string | null,
): VdsTier | null {
  const tiers = svc.tiers || [];
  return (
    tiers.find((t) => t.tier === classification) ??
    tiers.find((t) => t.tier === pricingGroup) ??
    tiers[0] ??
    null
  );
}

export function formatDuration(mins: number): string {
  if (!mins || mins <= 0) return "0 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export interface VdsQuoteLine {
  key: string;
  label: string;
  price?: number;
  duration?: number;
  isAddOn?: boolean;
  consultation?: boolean;
}

export interface VdsQuote {
  lineItems: VdsQuoteLine[];
  basePrice: number;
  conditionedBase: number;
  addOnTotal: number;
  paintProtectionDiscount: number;
  total: number;
  totalMins: number;
  pricingGroup: string | null;
  conditionMultiplier: number;
  conditionEntry: VdsConditionMultiplier | null;
  summary: string;
}

/**
 * Live quote for display. The server recomputes the charge on submit; this is
 * the same arithmetic so the two always agree.
 */
export function computeQuote({
  config = VDS_CONFIG,
  classification,
  condition,
  selected,
  addOns = [],
  consultations = [],
  paintProtection = "none",
}: {
  config?: VdsConfig;
  classification?: string | null;
  condition?: string | null;
  selected: string[];
  addOns?: string[];
  consultations?: string[];
  paintProtection?: string;
}): VdsQuote {
  const pricingGroup = classification ? resolvePricingGroup(config, classification) : null;
  const conditions = config.pricing_rules?.condition_multipliers ?? [];
  const conditionEntry = conditions.find((c) => c.key === condition) ?? null;
  const conditionMultiplier = conditionEntry?.multiplier ?? 1;
  const conditionDurationAdd = conditionEntry?.duration_add_minutes ?? 0;
  const allServices = config.services ?? [];

  let basePrice = 0;
  let baseMins = 0;
  const lineItems: VdsQuoteLine[] = [];

  for (const key of selected) {
    const svc = allServices.find((s) => s.key === key);
    if (!svc) continue;
    if (svc.requires_consultation) {
      lineItems.push({ key, label: svc.label, consultation: true });
      continue;
    }
    const tier = lookupTier(svc, classification, pricingGroup);
    basePrice += tier?.price ?? 0;
    baseMins += tier?.duration_minutes ?? 0;
    lineItems.push({
      key,
      label: svc.label,
      price: tier?.price ?? 0,
      duration: tier?.duration_minutes ?? 0,
    });
  }

  // Add-ons are charged at face value, never multiplied by condition.
  let addOnTotal = 0;
  let addOnMins = 0;
  for (const key of addOns) {
    const svc = allServices.find((s) => s.key === key);
    if (!svc) continue;
    const tier = lookupTier(svc, classification, pricingGroup);
    addOnTotal += tier?.price ?? 0;
    addOnMins += tier?.duration_minutes ?? 0;
    lineItems.push({
      key,
      label: svc.label,
      price: tier?.price ?? 0,
      duration: tier?.duration_minutes ?? 0,
      isAddOn: true,
    });
  }

  for (const key of consultations) {
    const svc = allServices.find((s) => s.key === key);
    if (!svc) continue;
    lineItems.push({ key, label: svc.label, consultation: true });
  }

  const conditionedBase = Math.round(basePrice * conditionMultiplier);
  const hasProtection = Boolean(paintProtection) && paintProtection !== "none" && basePrice > 0;
  const paintProtectionDiscount = hasProtection ? Math.round(conditionedBase * 0.2) : 0;
  const total = conditionedBase + addOnTotal - paintProtectionDiscount;
  const totalMins = baseMins + addOnMins + (basePrice > 0 ? conditionDurationAdd : 0);

  const summary =
    lineItems
      .map((i) => (i.consultation ? `${i.label} — Consultation` : `${i.label} — $${i.price}`))
      .join(" | ") +
    (hasProtection ? " | Paint Protection (PPF or Ceramic Coating) (-20%)" : "");

  return {
    lineItems,
    basePrice,
    conditionedBase,
    addOnTotal,
    paintProtectionDiscount,
    total,
    totalMins,
    pricingGroup,
    conditionMultiplier,
    conditionEntry,
    summary,
  };
}
