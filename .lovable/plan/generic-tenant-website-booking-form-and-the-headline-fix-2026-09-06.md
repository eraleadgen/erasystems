# Generic tenant website + booking form (and the headline fix)

Approved scope. VDS keeps its vehicle-specific extras as a variant on top of the generic template, not as the default.

## 1. Headline

Home page hero becomes:

> Bringing Service Businesses to a New ERA of Efficiency

## 2. The gap this closes

Today a client's public site only exists for VDS. Every other client's address falls through to a diagnostic page (business name, ID, hostname, bare service list) with no booking form. The booking *save* logic is already generic and re-prices from the client's own catalog; only the form is missing, and the one that exists is shaped around vehicle detailing.

## 3. Where the site content comes from

Onboarding already collects address, weekly hours, logo, brand colors, support email/phone, and the full service catalog — but address and hours are thrown away at the end of the wizard. So:

**New table `business_site`** (one row per business): tagline, about, address, service area, weekly hours, whether bookings are on, and whether the work happens at the shop or at the customer's location. Public visitors can read it for a live client; only that client's owners/admins (and platform staff) can change it. Onboarding writes this row automatically at completion from what the wizard already collected, so a new client needs to type nothing extra.

## 4. Generic tenant website template

One template, rendered for any client whose address resolves to them:

- Header: their logo (or name), their brand colors, phone/email, "Book now".
- Hero: business name, tagline (auto-written from their name and services if they haven't set one), primary call to action.
- Services: every active catalog item with its own price and duration.
- About / service area, drawn from their own content.
- Hours table, from onboarding.
- Booking section (below).
- Contact + footer with their address, phone, email — no ERA branding anywhere.

Branding is applied from `brand_primary` / `brand_accent` as CSS variables, so two clients with different colors look genuinely different with zero code.

## 5. Generic booking form

Industry-neutral: pick one or more services (running total and duration shown), date and time, name, phone, email, notes, plus a service address only when the client's work happens at the customer's location. Submits through the existing booking server function, which recomputes price from the catalog server-side.

The vehicle field and the vehicle-condition price multiplier become VDS-only extras layered on the same form, not part of the default.

## 6. Client can edit their site

The existing Business tab in the client portal gains tagline, about, service area, hours, and booking on/off — scoped to their own business through the same membership rules.

## 7. Acceptance test (before this is called done)

1. Create a brand-new test client of a clearly different type than VDS (e.g. a residential cleaning company), through the real invite → register → onboarding wizard path, entering only what the wizard asks for.
2. With zero code changes, confirm their public site renders complete: their name, colors, hours, services with their prices, about, contact.
3. Submit a real booking through their public form and confirm it lands on their business with the correct server-computed price and duration, and appears in their own admin bookings list.
4. Confirm no ERA or VDS content appears anywhere on their site, and that VDS's own site is unchanged.
5. Report the end-to-end result screen by screen, then remove the test client.

## Technical notes

- Migration: `public.business_site` with grants for anon/authenticated/service_role, RLS using the existing `private.is_member_of` / `is_business_manager` / `is_platform_staff` predicates, plus the standard updated-at trigger.
- `src/lib/onboarding.functions.ts`: write the `business_site` row alongside the business at completion.
- New `src/lib/tenant-site.functions.ts`: anon-safe read of site content by `business_id`.
- New `src/components/tenant/tenant-site.tsx` + `booking-form.tsx`; `src/components/tenant-home.tsx` (the diagnostic page) is retired as the fallback.
- `src/lib/tenant-booking.functions.ts`: `conditionMultiplier` defaults to 1 and `address` becomes optional so non-detailing businesses validate.
- `src/routes/index.tsx`: generic template is the default; `slug === "vds"` keeps rendering `VdsSite`.
- `src/components/vds/vds-site.tsx` keeps the vehicle fields as a variant of the shared booking form.
