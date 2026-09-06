# Headline change + honest answer on what a second client actually gets

## 1. Headline (small change)

Home page hero currently reads:

> Bringing home service businesses to a new era of efficiency

Change to:

> Bringing Service Businesses to a New ERA of Efficiency

One edit, in the hero of the marketing home page. Nothing else on the page changes.

## 2. The direct answer

Mixed. Roughly: **the private side is generic, the public side is not.**

### Genuinely shared and business_id-scoped today (a new Basic client gets these on day one)

- **Admin dashboard** — one dashboard, driven by whichever business the signed-in person belongs to. Not VDS-specific.
- **Service catalog editor** — add/edit/price/order services, scoped to the client's own business.
- **Business profile / branding editing** — name, logo, colors, contact info.
- **Bookings list, customers, team, billing, setup progress, go-live checklist** — all read through the same membership-scoped rules.
- **Tier and add-on gating** — the tier table decides which of those tabs light up; add-ons are separate per-business rows. Nothing about it is hardcoded to one client.
- **Onboarding wizard, payment, activation, domain attach, delivery workspace** — all generic.

### Built for VDS specifically, or not built at all

- **Public customer-facing website.** There is exactly one real one, and it is the VDS site. The code literally checks "is this business VDS?" and, if not, falls back to a *diagnostic page* that prints the business name, its ID, the hostname and a plain list of services. A second client's domain would today serve that engineering page, not a sellable website.
- **Public booking flow.** The server side that saves a booking is generic and re-prices from the client's own catalog — good. But the only booking *screen* that exists lives inside the VDS site, and it is shaped around vehicle detailing (vehicle field, vehicle-condition price multiplier). A second client has no booking form on their public site at all.
- **AI chat widget.** Not built. It exists as a tier feature label and marketing copy only — there is no widget anywhere in the code. Basic tier advertises it, so this is the biggest gap between what is sold and what ships.
- **Pricing engine.** Per-service price and duration exist and are used correctly. There is no add-on/upsell/tax/deposit/discount logic beyond VDS's condition multiplier.

### Tier by tier, for a brand-new Basic client onboarded today

| Sold | Reality on day one |
| --- | --- |
| Website | Placeholder diagnostic page, not a real site |
| AI chat widget | Missing entirely |
| Admin dashboard | Works |
| Self-serve setup | Works |
| Core engines (catalog, bookings record, customers) | Works in admin; no public booking form |

Growth adds customer portal and specialist portal — those pages exist and are tenant-branded, but are thin. Enterprise adds AI voice/SMS, advanced analytics and partner network — those are tier flags only; none of the three is built.

So: a second Basic client today gets a **real working back office and a broken storefront**. Onboarding + payment + admin would carry them; the thing their customers see would need real engineering.

## 3. What I'd propose next (not part of this change — for your call)

1. A generic tenant website template driven purely by the client's own catalog, branding and copy, with VDS kept as a themed variant of it rather than the only real implementation.
2. A generic booking form on that template (industry-neutral: service picker, date/time, contact, notes), reusing the existing booking server logic; keep the vehicle-condition multiplier as VDS-only.
3. The AI chat widget, since Basic advertises it.

## Technical notes

- Hero copy: `src/components/marketing/marketing-site.tsx`.
- Tenant branch: `src/routes/index.tsx` hardcodes `tenant.slug === "vds"` → `VdsSite`, else `TenantHome` (`src/components/tenant-home.tsx`, the diagnostic page).
- Booking: `src/lib/tenant-booking.functions.ts` is generic and re-prices server-side; only caller is `src/components/vds/vds-site.tsx`.
- Chat widget: only `ai_chat_widget` in `src/lib/entitlements.ts`; no component.
- Admin surfaces under `src/routes/_authenticated/*` all resolve the business from membership — no per-client code.
