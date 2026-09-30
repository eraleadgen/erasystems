/**
 * ERA Systems Client Services & Purchase Agreement.
 * Single source of truth for agreement text: the checkout checkbox, the
 * per-client download and the blank template all render from this file.
 * Bump AGREEMENT_VERSION whenever wording changes.
 */
import {
  ADDON_LABELS,
  FEATURE_LABELS,
  type AddonKind,
  type PlanTier,
  type PlatformFeature,
} from "./entitlements";

export const AGREEMENT_VERSION = "2026-09-30b";

const TIER_FEATURES: Record<PlanTier, PlatformFeature[]> = {
  basic: ["website", "ai_chat_widget", "core_engines", "payments", "admin_dashboard", "self_serve_setup", "email_automations"],
  growth: ["website", "ai_chat_widget", "core_engines", "payments", "admin_dashboard", "self_serve_setup", "email_automations", "customer_portal", "specialist_portal"],
  enterprise: ["website", "ai_chat_widget", "core_engines", "payments", "admin_dashboard", "self_serve_setup", "email_automations", "customer_portal", "specialist_portal", "voice_sms_agent", "sms_automations", "advanced_analytics", "partner_network"],
};

export type AgreementInput = {
  clientName: string | null;
  planTier: PlanTier | null;
  subscriptionPriceCents: number | null;
  setupFeeCents: number | null;
  billingInterval: string | null;
  addons: { addon: AddonKind; priceCents: number; billingInterval: string }[] | null;
};

export type AgreementBlock =
  | { kind: "heading"; text: string }
  | { kind: "para"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "table"; rows: [string, string][] };

const BLANK = "______________________";

function money(cents: number | null): string {
  if (cents === null) return "$__________";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function per(interval: string | null): string {
  switch (interval) {
    case "monthly": return "per month";
    case "quarterly": return "per quarter";
    case "annual": return "per year";
    case "one_time": return "one-time";
    default: return "per __________";
  }
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildAgreement(input: AgreementInput): AgreementBlock[] {
  const client = input.clientName ?? BLANK;
  const tier = input.planTier;
  const features = tier ? TIER_FEATURES[tier] : null;
  const hasSms = !!features?.includes("voice_sms_agent") || !!features?.includes("sms_automations");
  const b: AgreementBlock[] = [];
  const h = (text: string) => b.push({ kind: "heading", text });
  const p = (text: string) => b.push({ kind: "para", text });
  const li = (text: string) => b.push({ kind: "bullet", text });

  p(`This Client Services and Purchase Agreement (the "Agreement") is entered into between ERA Systems LLC, a Georgia limited liability company ("ERA", "we", "us"), and ${client} ("Client", "you"). It takes effect on the date Client accepts it electronically or signs it (the "Effective Date"). Version ${AGREEMENT_VERSION}.`);

  h("1. Services Purchased");
  p(`ERA will provide the hosted software platform, setup and support services described below (the "Services"). Client is purchasing the ${tier ? cap(tier) : BLANK} plan, which includes:`);
  if (features) for (const f of features) li(FEATURE_LABELS[f]);
  else { li(BLANK); li(BLANK); li(BLANK); }
  const addons = input.addons;
  if (addons === null) {
    p("Optional add-ons purchased (if none, write \"None\"): " + BLANK);
  } else if (addons.length) {
    p("Client is also purchasing the following add-ons, which are separate from the plan and priced individually:");
    for (const a of addons) li(`${ADDON_LABELS[a.addon]} (${money(a.priceCents)} ${per(a.billingInterval)})`);
  } else {
    p("No add-ons are purchased. Add-ons are never included in a plan and require a separate written order.");
  }
  p("Any service not listed above is not included. Additional work, custom development, or new add-ons require a written change order or updated agreement and may carry additional fees. ERA may improve, modify or replace features of the platform over time, provided the overall functionality of the purchased plan is not materially reduced.");

  h("2. Fees and Payment");
  const rows: [string, string][] = [
    ["Plan", tier ? `${cap(tier)} plan` : BLANK],
    ["Recurring subscription fee", `${money(input.subscriptionPriceCents)} ${per(input.billingInterval)}`],
    ["One-time setup fee", money(input.setupFeeCents)],
  ];
  if (addons) for (const a of addons) rows.push([ADDON_LABELS[a.addon], `${money(a.priceCents)} ${per(a.billingInterval)}`]);
  if (input.subscriptionPriceCents !== null && input.setupFeeCents !== null && addons) {
    rows.push(["Total due at signing", money(input.subscriptionPriceCents + input.setupFeeCents + addons.reduce((s, a) => s + a.priceCents, 0))]);
  } else rows.push(["Total due at signing", "$__________"]);
  b.push({ kind: "table", rows });
  li("The setup fee reflects the complexity of Client's build and is due in full before work begins. The setup fee is NON-REFUNDABLE once paid, regardless of whether Client later cancels.");
  li("The first recurring period is charged at signing. Recurring fees then renew automatically each billing period on the same calendar day, charged to the payment method on file, until cancelled under Section 4.");
  li("Payments are processed by a third-party processor (currently Stripe). Client authorizes ERA and its processor to charge the payment method on file for all fees due under this Agreement.");
  li("Fees exclude taxes. Client is responsible for all applicable sales, use and similar taxes, other than taxes on ERA's income.");
  li("If a payment fails or is more than ten (10) days late, ERA may suspend the Services (including Client's website, booking pages, chat, portals and automations) until the balance is paid. Suspension does not pause fees. Accounts unpaid for thirty (30) days may be terminated.");
  li("ERA may change recurring fees on at least thirty (30) days' written notice, effective at the next billing period. Client may cancel before the change takes effect.");
  li("Client agrees to contact ERA before initiating a chargeback. Chargebacks for services rendered may result in immediate suspension and Client remains liable for the amount plus any processor fees.");

  h("3. Term");
  p("This Agreement is month-to-month (or per the billing period stated above). It begins on the Effective Date and renews automatically for successive billing periods until cancelled by either party under Section 4 or terminated under Section 12.");

  h("4. Cancellation and Refunds");
  li("Client may cancel at any time by written notice to support@eraleadgen.com or through any cancellation method ERA provides. No long-term commitment or cancellation penalty applies.");
  li("When Client cancels, no further recurring fees will be charged. Client keeps full access to the Services until the end of the billing period already paid for, after which access ends.");
  li("Fees already paid are not refunded or prorated, including for partial periods, unused features, or periods of non-use. The setup fee is non-refundable in all cases.");
  li("After access ends, ERA will make Client's business data available for export on request for thirty (30) days, then may permanently delete it, except as required by law or retained in routine backups that expire on their normal schedule.");

  h("5. Setup, Delivery and Client Responsibilities");
  p("ERA requests seven (7) days after payment to complete Client's profile and system setup before it is fully live. The launch timeline begins once ERA has received everything it needs from Client. Timelines are good-faith estimates, not guarantees, and depend on Client's timely cooperation and on third parties (such as domain registrars, telecom carriers and messaging registries). Client agrees to:");
  li("Provide accurate, complete and lawful business information, service descriptions, prices, hours, logos, photos and other content (\"Client Content\"), and keep it up to date.");
  li("Review its website, catalog, prices, AI chat answers and automated messages before and after launch, and promptly report any errors. Client is responsible for the accuracy of prices and service information shown to its customers.");
  li("Hold all rights, licenses and permissions needed for Client Content, including images, trademarks and testimonials, and obtain all customer consents required by law.");
  li("Keep account credentials secure, restrict access to authorized personnel, and notify ERA promptly of any suspected unauthorized access. Client is responsible for all activity under its accounts.");
  li("Use the Services only for lawful purposes and not to send spam, deceptive content, or unlawful, infringing or harmful material.");
  li("Honor bookings, quotes and commitments its customers make through the Services, and handle its own customer service, refunds and disputes with its customers.");

  h("6. Domains");
  p("Any domain name Client requests is subject to availability and third-party registrar rules at the time of registration. ERA does not guarantee that any specific domain name can be obtained, and the final domain will be confirmed with Client. Domain registration or renewal fees charged by registrars are not included unless stated in Section 2. Where ERA registers a domain for Client, it will be held for Client's benefit and, provided Client's account is paid in full, transferred to Client on written request. ERA is not responsible for domain loss caused by registrar actions, Client-controlled DNS changes, or non-renewal after cancellation.");

  h("7. AI Features");
  p("The Services may include AI-powered features such as a website chat assistant" + (features?.includes("voice_sms_agent") ? ", AI SMS and, where enabled, AI voice agents" : "") + ". Client acknowledges that:");
  li("AI output is generated automatically and may occasionally be inaccurate, incomplete or unexpected. AI features are designed to answer from Client's own business data, but ERA does not guarantee any specific AI response.");
  li("AI features are not a substitute for professional, medical, legal, financial or safety advice, and Client must not configure them to give such advice.");
  li("Prices, availability and bookings are confirmed through Client's live system. Client remains responsible for honoring or correcting any quote or booking and for monitoring AI interactions.");
  li("Reasonable usage limits apply to AI features to control cost and abuse. ERA may throttle or pause AI features that exceed these limits.");
  li("Where required by law, Client will disclose to its customers that they are interacting with an automated system.");

  h("8. Messaging, Email and Calls");
  p("Client is the sender of record for all emails, text messages and calls sent to its customers through the Services, and is solely responsible for complying with applicable laws, including the Telephone Consumer Protection Act (TCPA), the CAN-SPAM Act, carrier and messaging registry rules (including A2P 10DLC registration), and state telemarketing and privacy laws. Client will obtain and keep records of all required consents, honor opt-out requests, and not upload contact lists it lacks permission to message.");
  if (hasSms || !features) p("Text messaging and voice features depend on carrier and registry approval. ERA will assist with registration but does not guarantee approval, delivery rates or timing, and is not liable for messages blocked, filtered or delayed by carriers. Features that are not yet approved or activated are not considered delivered until they are live.");

  h("9. Data, Privacy and Security");
  li("As between the parties, Client owns Client Content and the data about Client's customers and bookings (\"Client Data\"). Client grants ERA a limited license to host, process, display and transmit Client Data solely to provide, secure, support and improve the Services.");
  li("ERA uses commercially reasonable administrative, technical and physical safeguards, including per-business data isolation, to protect Client Data. No system is completely secure, and ERA does not guarantee that unauthorized access will never occur. ERA will notify Client without undue delay of a confirmed breach affecting Client Data, as required by law.");
  li("ERA may use aggregated, de-identified data that does not identify Client or its customers to operate and improve the platform.");
  li("The Services are not designed to store protected health information (PHI), payment card numbers, Social Security numbers or other highly sensitive data. Client must not enter such data, and ERA does not sign HIPAA Business Associate Agreements unless separately agreed in writing.");
  li("Client is responsible for publishing a privacy policy appropriate for its business and for its own legal obligations to its customers.");

  h("10. Intellectual Property");
  p("ERA and its licensors own the platform, software, templates, designs, workflows, and all improvements to them, including anything developed while providing the Services, excluding Client Content. During the term and while Client's account is in good standing, ERA grants Client a non-exclusive, non-transferable right to use the Services for Client's own business. Client may not resell, copy, reverse engineer or build a competing product from the Services. Feedback Client provides may be used by ERA without obligation.");

  h("11. Third-Party Services");
  p("The Services rely on third-party providers. As of the date of this Agreement, these include Lovable (application hosting, database and development platform), Twilio (SMS and telephony), the OpenAI API (AI chat and language models), Google Workspace (email, calendar and business productivity), Retell (AI voice agents, where included), Squarespace (domain registration and DNS), and Stripe (payment processing), as well as email delivery and mapping services. Their services are governed by their own terms. ERA is not responsible for outages, errors, fee changes, policy changes, account holds or discontinuation by third parties, and ERA may substitute providers with comparable functionality.");

  h("12. Suspension and Termination for Cause");
  p("ERA may suspend or terminate the Services immediately, without refund, if Client (a) fails to pay as described in Section 2, (b) materially breaches this Agreement and does not cure within ten (10) days after notice, (c) uses the Services unlawfully, fraudulently, or in a way that threatens the security, integrity or reputation of ERA, its providers, or other clients, or (d) becomes insolvent. Either party may terminate for the other's uncured material breach. Sections 2 (amounts owed), 4, 9, 10, 13, 14, 15, 16 and 18 survive termination.");

  h("13. Disclaimer of Warranties");
  p("ERA will perform the Services in a professional and workmanlike manner. EXCEPT AS EXPRESSLY STATED IN THIS AGREEMENT, THE SERVICES ARE PROVIDED \"AS IS\" AND \"AS AVAILABLE\". TO THE MAXIMUM EXTENT PERMITTED BY LAW, ERA DISCLAIMS ALL OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT. ERA DOES NOT GUARANTEE UNINTERRUPTED OR ERROR-FREE OPERATION, ANY SPECIFIC UPTIME, SEARCH RANKINGS, WEBSITE TRAFFIC, LEADS, BOOKINGS, REVENUE, OR OTHER BUSINESS RESULTS.");

  h("14. Limitation of Liability");
  p("TO THE MAXIMUM EXTENT PERMITTED BY LAW: (a) NEITHER PARTY WILL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, BOOKINGS, GOODWILL OR DATA, EVEN IF ADVISED OF THEIR POSSIBILITY; AND (b) ERA'S TOTAL LIABILITY ARISING OUT OF OR RELATING TO THIS AGREEMENT OR THE SERVICES WILL NOT EXCEED THE FEES CLIENT ACTUALLY PAID TO ERA IN THE THREE (3) MONTHS IMMEDIATELY BEFORE THE EVENT GIVING RISE TO THE CLAIM. These limits apply regardless of the legal theory and are an essential part of the bargain between the parties. They do not limit Client's payment obligations or either party's liability for fraud or willful misconduct.");

  h("15. Indemnification");
  p("Client will defend, indemnify and hold harmless ERA and its members, employees and contractors from any third-party claims, fines, damages and costs (including reasonable attorneys' fees) arising from (a) Client Content or Client Data, (b) Client's products, services, pricing or dealings with its customers, (c) messages, emails or calls sent on Client's behalf, including under the TCPA, CAN-SPAM or carrier rules, (d) Client's violation of law or this Agreement, or (e) Client's negligence or misconduct. ERA will give Client prompt notice of the claim and reasonable cooperation.");

  h("16. Governing Law and Disputes");
  p("This Agreement is governed by the laws of the State of Georgia, USA, without regard to conflict-of-laws rules. Before filing any claim, the parties will try in good faith to resolve the dispute by written notice and discussion for thirty (30) days. Any unresolved dispute will be brought exclusively in the state or federal courts located in the State of Georgia, and each party consents to their jurisdiction. The prevailing party in any action to collect unpaid fees is entitled to reasonable attorneys' fees and costs. Any claim must be brought within one (1) year after it arises.");

  h("17. Force Majeure");
  p("Neither party is liable for delay or failure to perform (other than payment obligations) caused by events beyond its reasonable control, including natural disasters, power or internet failures, third-party provider outages, cyberattacks, labor disputes, government action, or pandemics.");

  h("18. General");
  li("Entire agreement: This Agreement, including any written order referencing it, is the entire agreement on its subject and supersedes prior proposals, discussions and marketing materials. If there is a conflict, a signed written order controls for pricing only.");
  li("Changes: ERA may update these terms for future billing periods on thirty (30) days' notice; continued use after the effective date constitutes acceptance. Other amendments must be in writing and accepted by both parties.");
  li("Assignment: Client may not assign this Agreement without ERA's written consent. ERA may assign it in connection with a merger, acquisition or sale of assets.");
  li("Independent contractors: The parties are independent contractors. Nothing creates a partnership, joint venture, agency or employment relationship.");
  li("Notices: Notices to ERA must be sent to support@eraleadgen.com. Notices to Client may be sent to the email address on Client's account.");
  li("Severability and waiver: If any provision is unenforceable, it will be enforced to the maximum extent permitted and the rest remains in effect. Failure to enforce a provision is not a waiver.");
  li("Publicity: ERA may identify Client by name and logo as a customer unless Client opts out in writing.");
  li("Electronic acceptance: This Agreement may be accepted by checking an acceptance box, clicking to purchase, or signing electronically, each of which is binding under the federal E-SIGN Act and the Georgia Uniform Electronic Transactions Act (O.C.G.A. § 10-12-1 et seq.).");

  h("Acceptance");
  p("By signing below, or by checking the acceptance box at checkout, each party agrees to this Agreement.");
  return b;
}
