/**
 * Marketing copy, shared by the summary home page and the full section pages.
 * Presentational only: nothing here drives entitlements or billing.
 */

export const CTA_ROUTE = "/contact" as const;

export const outcomes = [
  {
    stat: "Hours back",
    title: "Admin stops being a second job",
    body: "Bookings, customer records, quotes and invoices write themselves from one shared record instead of being re-typed across six tools every evening.",
  },
  {
    stat: "24/7",
    title: "Leads answered while you work",
    body: "The AI chat widget replies, qualifies, and captures the lead on the page, so the enquiry that arrives mid-job is still there as a booking, not a missed call.",
  },
  {
    stat: "Faster cash",
    title: "Money moves without chasing",
    body: "Deposits, invoices and reminders fire off the job itself. Fewer unpaid jobs sitting in someone's head and fewer awkward follow-up texts.",
  },
  {
    stat: "Repeat work",
    title: "Follow-up that never forgets",
    body: "Automations bring past customers back on schedule and ask for the review at the right moment, turning one job into the next one automatically.",
  },
];

export const coreCapabilities = [
  {
    title: "A website that actually sells",
    body: "The public site, service catalog and booking flow are one system, so a visitor can go from reading to booked without leaving, and it never drifts out of date.",
  },
  {
    title: "AI chat widget",
    body: "Answers questions and captures the lead on the page instead of losing it to a contact form nobody checks.",
  },
  {
    title: "One record for the work",
    body: "Scheduling, jobs, customers and quotes share the same record, so nothing is retyped and nothing quietly falls through.",
  },
  {
    title: "Payments that close themselves",
    body: "Deposits, invoices and paid jobs settle against the same customer and job, so you can see what's owed without building a spreadsheet.",
  },
  {
    title: "Admin dashboard",
    body: "One place to see the day, the pipeline, and what money is outstanding, in about a minute, not an hour.",
  },
  {
    title: "Self-serve domain, email & phone",
    body: "Connect your own domain, sending address, and business number from inside the platform.",
  },
];

export const tiers = [
  {
    name: "Basic",
    price: "$199",
    tagline: "The full operating system for a single-location business.",
    inherits: undefined as string | undefined,
    features: [
      "Website",
      "AI chat widget",
      "Core engines",
      "Payments",
      "Admin dashboard",
      "Self-serve domain, email & phone setup",
      "Email automations",
    ],
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$499",
    tagline: "Adds portals for the people around the work: customers and staff.",
    inherits: "Everything in Basic, plus:",
    features: ["Customer member portal", "Specialist / employee portal"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "$1,499",
    tagline: "Voice, SMS, analytics, and a referral network on top of the whole platform.",
    inherits: "Everything in Growth, plus:",
    features: [
      "AI Voice & SMS agent",
      "SMS automations",
      "Advanced analytics",
      "Partner / referral network",
    ],
    highlighted: false,
  },
];

export const addons = [
  {
    name: "Ad Management",
    body: "We run and maintain your paid acquisition against the same pipeline the platform tracks, so spend is measured against booked jobs rather than clicks.",
  },
  {
    name: "Downloadable Apps",
    body: "Two branded apps under your name. A customer app that carries your website, booking and accounts into a download your clients keep on their phone, and a business operations app your team runs the day from. Scoped on a call before anything is built.",
  },
];

export const steps = [
  {
    title: "Discovery call",
    body: "We look at what you run today and whether ERA is actually a fit. If it isn't, we say so.",
  },
  {
    title: "Invite & guided setup",
    body: "If it is, we send you a private invite link. That's the only way an account gets created here. There is no public sign-up. You then walk through a guided setup: business details, branding, services and pricing, your team.",
  },
  {
    title: "Go live",
    body: "Your tier and any add-ons are set from the call, you complete payment, and the platform goes live on your domain.",
  },
];

export const faqs = [
  {
    q: "Why can't I just sign up?",
    a: "Because setup isn't self-explanatory and a half-configured operating system is worse than the patchwork it replaced. Accounts are created by invite after a discovery call, so every business that goes live has been walked through it.",
  },
  {
    q: "What happens on the discovery call?",
    a: "We go through the tools you're running now, what breaks between them, and what your week actually looks like. You leave knowing the tier, the add-ons if any, and the real number.",
  },
  {
    q: "Are add-ons tied to a tier?",
    a: "No. Ad Management and Downloadable Apps are available on any tier, including Basic, and are never bundled into a higher plan. They're quoted per business.",
  },
  {
    q: "Can I change tiers later?",
    a: "Yes. Tiers are set by us from the discovery call and can be changed as the business changes. Nothing about your data is tied to the plan you started on.",
  },
  {
    q: "Who is ERA for?",
    a: "Local service businesses (trades, home services, mobile services, appointment-based shops) that are running six disconnected tools and a spreadsheet.",
  },
  {
    q: "What do I need to bring?",
    a: "Your service list and pricing, your domain if you already have one, and a rough idea of who on your team needs access.",
  },
];
