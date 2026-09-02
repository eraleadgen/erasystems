# eraleadgen.com marketing site

## One thing I need from you
The logo didn't come through — the only upload on file is `ERA_Systems_Master_Document.pdf`. Re-attach the logo (PNG/SVG, transparent preferred) and I'll wire it into the header, footer, and social preview. Until then I'll ship an ERA wordmark placeholder in the same brand colors and swap it in when the file lands.

## Where it lives
`/` currently renders the tenant-isolation demo page (hostname-resolved business + service catalog). That stays useful, so:

- `/` → marketing site when the request resolves to the platform host (eraleadgen.com, preview, custom platform domain).
- A resolved tenant hostname keeps rendering the existing tenant page, unchanged.
- The old `?tenant=` demo links move to `/demo/tenant` so nothing is lost.
- No `/register`, `/auth`, or portal links anywhere in marketing nav or footer. Registration stays invite-only and unadvertised.

## Brand
Replace the placeholder indigo tokens in `src/styles.css` with:

- Primary: deep teal (dark, saturated — used for buttons, headings accents, footer field)
- Accent: metallic silver (gradient token `--gradient-metal`, borders, rules, card edges)
- Neutrals: near-black ink on a warm off-white; dark mode inverts to teal-black surfaces
- Type: one geometric sans for headings, a quieter sans for body. No Inter/Poppins, no purple.

All values as oklch tokens; components use semantic classes only.

## Page structure (single scrolling page + one route)

1. **Header** — logo left, anchor links (Platform, Pricing, Add-ons, FAQ), single CTA button "Book a discovery call". Sticky, silver hairline border.
2. **Hero** — headline about one operating system replacing the patchwork of disconnected tools; subhead naming the patchwork (booking tool, CRM, invoicing, marketing, spreadsheets, phone). Primary CTA → contact form. No signup.
3. **The patchwork problem** — a short before/after: a scattered grid of disconnected tool cards versus one ERA Core block. Visual, not a competitor callout.
4. **What ERA Core is** — 4–6 capability cards drawn from the real feature list: website, AI chat widget, core engines, payments, admin dashboard, self-serve domain/email/phone, email automations.
5. **Pricing — three tiers**
   - Basic $199/mo — website, AI chat widget, core engines, payments, admin dashboard, self-serve domain/email/phone setup, email automations
   - Growth $499/mo — everything in Basic + customer member portal, specialist/employee portal
   - Enterprise $1,499/mo — everything in Growth + AI Voice & SMS agent, SMS automations, advanced analytics, partner/referral network
   Growth marked as the common starting point (not "most popular", which implies volume we don't have). Every tier button says "Book a discovery call".
6. **Add-ons** — two cards: Ad Management, White-Label Branding. Both labeled "Custom pricing — available on any tier", stated plainly as quoted per business on the discovery call, never bundled into a tier.
7. **How onboarding works** — 3 steps: discovery call → invite + guided setup → go live. States plainly that accounts are created by invite only after a call.
8. **Honest status band** — one short, non-apologetic line: ERA is a new platform, and we don't publish customer names or logos we haven't earned. No testimonials, no fake logos, no client counts. Explicitly no mention of Apex Mobile Detailing or Northwind HVAC.
9. **FAQ** — 5–6 items: why no self-signup, what happens on the discovery call, can I change tiers, are add-ons tied to a tier (no), what do I need to bring, who is it for.
10. **Contact / book a discovery call** — the terminal CTA section, form: name, business name, email, phone (optional), business type, message. Server-validated, stored in a new `discovery_requests` table with staff-only RLS and grants (no anon read; anon insert allowed for the public form, rate-limited by IP+email). Success state confirms a human will follow up; no account is created.
11. **Footer** — logo, contact email, legal links, copyright. No sign-in link.

## Technical notes
- New route file for marketing content and sections under `src/components/marketing/*`; `/` picks marketing vs tenant page from the existing server-side hostname resolution — no new resolution mechanism.
- Tier and add-on copy is presentational, sourced from the labels already in `src/lib/entitlements.ts` so the site can't drift from the enforced entitlements.
- Head metadata: ERA-specific title/description, og/twitter tags, JSON-LD `Organization` + `Product` offers for the three tiers. Single H1, semantic sections, alt text on the logo.
- Form submission goes through a server function with zod validation; add-on and tier prices displayed here are marketing figures only and never drive checkout totals (those stay staff-set on the invite).
