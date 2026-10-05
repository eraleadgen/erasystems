import type { PlanTier, PlatformFeature } from "./entitlements";

export const DELIVERY_STATUSES = ["not_started", "in_progress", "blocked", "done"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

export type TaskOwner = "era" | "client";

/**
 * A required step between a client paying and their system being live.
 * `requires` decides whether the step applies to this client at all:
 *  - undefined: every client
 *  - feature: only when the tier entitles that feature
 *  - tier: only for the listed tiers
 */
export type DeliveryTask = {
  key: string;
  label: string;
  detail: string;
  owner: TaskOwner;
  /** Target day inside the 7 day go-live window. */
  day: number;
  requires?:
    | { kind: "feature"; feature: PlatformFeature }
    | { kind: "tier"; tiers: PlanTier[] };
};

export type DeliveryPhase = {
  key: string;
  title: string;
  summary: string;
  tasks: DeliveryTask[];
};

export const DELIVERY_PHASES: DeliveryPhase[] = [
  {
    key: "intake",
    title: "Day 0 — Signed and intake",
    summary: "Money confirmed, account created, everything we need collected in one pass.",
    tasks: [
      {
        key: "payment_confirmed",
        label: "Payment confirmed and subscription active",
        detail:
          "Stripe session verified live, business moved to active, is_active true, slug reservation cleared.",
        owner: "era",
        day: 0,
      },
      {
        key: "tier_locked",
        label: "Tier and pricing locked on the account",
        detail: "Plan tier set with the agreed custom price.",
        owner: "era",
        day: 0,
      },
      {
        key: "kickoff_scheduled",
        label: "Kickoff call scheduled",
        detail: "60 minute build call booked within 24 hours of payment.",
        owner: "era",
        day: 0,
      },
      {
        key: "business_profile",
        label: "Business profile verified",
        detail: "Legal name, display name, service area, address, timezone, hours, contact details.",
        owner: "client",
        day: 1,
      },
      {
        key: "brand_assets",
        label: "Brand assets received",
        detail: "Logo files, colors, photography, and any existing copy or reviews to reuse.",
        owner: "client",
        day: 1,
      },
      {
        key: "service_catalog",
        label: "Service catalog and pricing entered",
        detail: "Every service with duration, base price, deposit rule and add-on options.",
        owner: "era",
        day: 1,
      },
      {
        key: "access_handover",
        label: "Access handed over",
        detail:
          "Domain registrar, existing website, Google Business Profile, phone carrier and current CRM export.",
        owner: "client",
        day: 1,
      },
    ],
  },
  {
    key: "infrastructure",
    title: "Days 1-2 — Infrastructure",
    summary: "Domain, email and phone identity so nothing built later has to be redone.",
    tasks: [
      {
        key: "domain_connected",
        label: "Domain connected and DNS verified",
        detail: "Apex plus www pointed at ERA, SSL issued, redirects from the old site in place.",
        owner: "era",
        day: 2,
      },
      {
        key: "email_domain_verified",
        label: "Sending domain verified",
        detail: "SPF, DKIM and DMARC records published, test send delivered to inbox not spam.",
        owner: "era",
        day: 2,
      },
      {
        key: "phone_number",
        label: "Business number provisioned or ported",
        detail: "Number live, forwarding and voicemail set, call routing confirmed with the owner.",
        owner: "era",
        day: 2,
      },
      {
        key: "a2p_registration",
        label: "A2P 10DLC brand and campaign registered",
        detail:
          "EIN and brand submitted, campaign approved before any SMS sends. Required for texting.",
        owner: "era",
        day: 2,
      },
      {
        key: "stripe_connected",
        label: "Payments connected",
        detail: "Client Stripe account connected, payout details verified, tax settings confirmed.",
        owner: "era",
        day: 2,
        requires: { kind: "feature", feature: "payments" },
      },
      {
        key: "calendar_connected",
        label: "Calendar connected and availability set",
        detail: "Google Calendar linked, working hours, buffers, travel time and blackout dates.",
        owner: "era",
        day: 2,
      },
    ],
  },
  {
    key: "build",
    title: "Days 2-4 — Build",
    summary: "The client-facing system: site, chat, booking flow, portals.",
    tasks: [
      {
        key: "website_built",
        label: "Website built",
        detail: "Home, services, about, contact and booking pages with real copy and photos.",
        owner: "era",
        day: 4,
        requires: { kind: "feature", feature: "website" },
      },
      {
        key: "website_approved",
        label: "Website approved by client",
        detail: "One revision round captured and applied, written sign-off recorded.",
        owner: "client",
        day: 4,
        requires: { kind: "feature", feature: "website" },
      },
      {
        key: "chat_widget",
        label: "AI chat widget trained and installed",
        detail: "Trained on services and pricing, escalation rules set, lead capture writing to CRM.",
        owner: "era",
        day: 4,
        requires: { kind: "feature", feature: "ai_chat_widget" },
      },
      {
        key: "booking_flow",
        label: "Booking flow live end to end",
        detail: "Public booking creates a job, holds the slot, takes the deposit and confirms.",
        owner: "era",
        day: 4,
        requires: { kind: "feature", feature: "core_engines" },
      },
      {
        key: "customer_import",
        label: "Existing customers imported",
        detail: "Past customer list de-duplicated and imported with job history where available.",
        owner: "era",
        day: 3,
      },
      {
        key: "customer_portal",
        label: "Customer member portal configured",
        detail: "Login, upcoming jobs, invoices and rebooking checked with a test customer.",
        owner: "era",
        day: 4,
        requires: { kind: "feature", feature: "customer_portal" },
      },
      {
        key: "specialist_portal",
        label: "Specialist portal configured and staff invited",
        detail: "Employee accounts invited, job assignment and mobile view verified.",
        owner: "era",
        day: 4,
        requires: { kind: "feature", feature: "specialist_portal" },
      },
    ],
  },
  {
    key: "automation",
    title: "Days 4-5 — Automation",
    summary: "The follow-up that earns while the client is on the job.",
    tasks: [
      {
        key: "email_automations",
        label: "Email automations switched on",
        detail: "Quote follow-up, booking confirmation, reminders, invoice chase, review request.",
        owner: "era",
        day: 5,
        requires: { kind: "feature", feature: "email_automations" },
      },
      {
        key: "sms_automations",
        label: "SMS automations switched on",
        detail: "Reminder and confirmation texts live only after A2P approval, opt-out wired.",
        owner: "era",
        day: 5,
        requires: { kind: "feature", feature: "sms_automations" },
      },
      // The AI SMS and voice agents are tracked step by step in their own two
      // checklists, switched on per client. Neither is assumed for Enterprise.
      {
        key: "reactivation",
        label: "Reactivation campaign scheduled",
        detail: "Past customer win-back sequence queued against the imported list.",
        owner: "era",
        day: 5,
      },
      {
        key: "analytics",
        label: "Advanced analytics dashboards enabled",
        detail: "Lead source, conversion, revenue and job margin reporting checked against real data.",
        owner: "era",
        day: 5,
        requires: { kind: "feature", feature: "advanced_analytics" },
      },
      {
        key: "partner_network",
        label: "Partner / referral network enabled",
        detail: "Referral links issued, payout terms confirmed, partner records created.",
        owner: "era",
        day: 5,
        requires: { kind: "feature", feature: "partner_network" },
      },
    ],
  },
  {
    key: "qa",
    title: "Day 6 — Quality pass",
    summary: "Prove it works before the client is told it works.",
    tasks: [
      {
        key: "test_booking",
        label: "Test booking taken end to end",
        detail: "Real booking placed, deposit charged, confirmation and reminder received, then voided.",
        owner: "era",
        day: 6,
      },
      {
        key: "test_payment",
        label: "Test payment and invoice verified",
        detail: "Charge lands in the client account, invoice PDF and receipt copy correct.",
        owner: "era",
        day: 6,
        requires: { kind: "feature", feature: "payments" },
      },
      {
        key: "mobile_qa",
        label: "Mobile and speed pass",
        detail: "Every page checked on a phone, images optimised, no layout breaks.",
        owner: "era",
        day: 6,
      },
      {
        key: "seo_basics",
        label: "SEO and listings pass",
        detail: "Titles, descriptions, sitemap, schema, Google Business Profile updated to match.",
        owner: "era",
        day: 6,
      },
      {
        key: "notifications_routed",
        label: "Owner notifications routed",
        detail: "Lead, booking and payment alerts land on the right phone and inbox.",
        owner: "era",
        day: 6,
      },
    ],
  },
  {
    key: "launch",
    title: "Day 7 — Launch and handoff",
    summary: "Live, trained, and status lights flipped green for the client.",
    tasks: [
      {
        key: "training_call",
        label: "Training and handoff call completed",
        detail: "Owner walked through the dashboard, daily flow and where to get help.",
        owner: "era",
        day: 7,
      },
      {
        key: "status_lights_live",
        label: "Client status lights set to live",
        detail: "Every entitled capability flipped to live on the client dashboard.",
        owner: "era",
        day: 7,
      },
      {
        key: "go_live_announced",
        label: "Go-live confirmed to the client",
        detail: "Launch email sent with the live URL, phone number and support contact.",
        owner: "era",
        day: 7,
      },
      {
        key: "day7_checkin",
        label: "Post-launch check-in booked",
        detail: "Follow-up scheduled for the first week to review leads and fix friction.",
        owner: "era",
        day: 7,
      },
    ],
  },
];

export const ALL_DELIVERY_TASKS: DeliveryTask[] = DELIVERY_PHASES.flatMap((p) => p.tasks);

/** Steps that apply to this specific client, given its tier features. */
export function applicableTasks(
  tier: PlanTier,
  features: PlatformFeature[],
): DeliveryTask[] {
  return ALL_DELIVERY_TASKS.filter((task) => {
    const req = task.requires;
    if (!req) return true;
    if (req.kind === "feature") return features.includes(req.feature);
    return req.tiers.includes(tier);
  });
}

/* ------------------------------------------------------------------ */
/* Automation                                                          */
/* ------------------------------------------------------------------ */

/**
 * How a step gets done:
 *  - auto: derived from data the system already holds. Staff never click it,
 *    unless they override, in which case the override wins forever after.
 *  - assisted: one button performs the work (an email ask, usually).
 *  - manual: genuine per-client judgment. This is the set staff actually work.
 */
export type AutomationMode =
  | { kind: "auto" }
  | { kind: "assisted"; action: AssistedAction }
  | { kind: "manual" };

/** Steps whose status is computed from real account data. */
export const AUTO_TASK_KEYS = [
  "payment_confirmed",
  "tier_locked",
  "kickoff_scheduled",
  "business_profile",
  "brand_assets",
  "service_catalog",
  "domain_connected",
  "a2p_registration",
  "website_built",
  "status_lights_live",
] as const;

export type AutoTaskKey = (typeof AUTO_TASK_KEYS)[number];

export type AssistedAction = {
  /** Button label in the workspace. */
  label: string;
  /** Subject line of the email sent to the client contact. */
  subject: string;
  /** Body sent to the client contact. `{business}` is substituted. */
  body: string;
  /** Status the step moves to once the action has run. */
  resultStatus: DeliveryStatus;
};

/** Steps a single button can perform end to end. */
export const ASSISTED_ACTIONS: Record<string, AssistedAction> = {
  access_handover: {
    label: "Request access",
    subject: "ERA setup: access we need from you",
    body: "To finish building {business} we need access to your domain registrar, current website, Google Business Profile, phone carrier and any existing customer list. Reply to this email with each one and we will take it from there.",
    resultStatus: "in_progress",
  },
  brand_assets: {
    label: "Request brand assets",
    subject: "ERA setup: your logo and brand files",
    body: "Send over your logo files, brand colors and any photography or reviews you would like us to use on the {business} site. Reply with the files attached and we will handle the rest.",
    resultStatus: "in_progress",
  },
  customer_import: {
    label: "Request customer list",
    subject: "ERA setup: your existing customer list",
    body: "Export your current customer list (CSV works best) and reply with it attached. We will de-duplicate and import it into {business} with job history where it exists.",
    resultStatus: "in_progress",
  },
  website_approved: {
    label: "Request approval",
    subject: "Your new {business} website is ready to review",
    body: "Your site is built and ready for review. Take a look and reply with any changes in one message. Once you reply approved we lock it in and move to launch.",
    resultStatus: "in_progress",
  },
  training_call: {
    label: "Send training invite",
    subject: "Book your ERA training and handoff call",
    body: "Your {business} system is nearly live. Reply with two times that work this week and we will walk you through the dashboard, the daily flow and where to get help.",
    resultStatus: "in_progress",
  },
  go_live_announced: {
    label: "Send go-live email",
    subject: "{business} is live on ERA",
    body: "Your system is live. Your website, booking flow, automations and dashboard are all running. Support is support@eraleadgen.com any time you need us.",
    resultStatus: "done",
  },
  day7_checkin: {
    label: "Book check-in",
    subject: "Your first week check-in",
    body: "Let us book a short check-in for the end of your first week on {business} so we can review leads, bookings and anything that feels like friction. Reply with a time that suits you.",
    resultStatus: "in_progress",
  },
};

export function automationFor(taskKey: string): AutomationMode {
  if ((AUTO_TASK_KEYS as readonly string[]).includes(taskKey)) return { kind: "auto" };
  const action = ASSISTED_ACTIONS[taskKey];
  if (action) return { kind: "assisted", action };
  return { kind: "manual" };
}

/** Assisted action available for a step, even when the step is also derived. */
export function assistedActionFor(taskKey: string): AssistedAction | null {
  return ASSISTED_ACTIONS[taskKey] ?? null;
}
