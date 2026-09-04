# Lock down private pages, then launch VDS as ERA's first client

Two pieces of work. Part 1 is a security/SEO hardening pass. Part 2 rebuilds VDS on ERA.

## Part 1 — Private areas stay private and out of search

Current state, verified in the code:

- Client pages under `/dashboard`, `/catalog`, `/bookings`, `/customers`, `/team`, `/billing`, `/analytics`, `/business`, `/onboarding` already sit behind the sign-in gate.
- The agency console routes (`/admin/invites`, `/admin/clients`, `/admin/delivery`, `/admin/calendar`, `/admin/documents`, `/admin/sales`, `/admin/addons`) are **not** behind the sign-in gate. Their data is safe (every staff server function checks platform-staff status in the database), but the page shells render for anyone who types the URL.
- Most private routes already carry a `noindex` tag, but `/dashboard`, `/portal`, and `/specialists` do not.
- `robots.txt` currently says "allow everything".
- The sitemap already lists marketing pages only.

Changes:

1. Move every `/admin/*` route into the authenticated subtree so a signed-out visitor is redirected to sign-in before the page renders, and add a staff check so a signed-in client who guesses `/admin/clients` gets a plain "not authorized" screen instead of the console shell.
2. Add `noindex, nofollow` to `/dashboard`, `/portal`, `/specialists`, and any other private route still missing it.
3. Rewrite `robots.txt` to disallow `/admin`, `/dashboard`, `/auth`, `/register`, `/onboarding`, `/portal`, `/specialists`, `/business`, `/billing`, `/catalog`, `/bookings`, `/customers`, `/team`, `/analytics`, and `/api`, while keeping the marketing pages crawlable and the sitemap line intact.
4. Confirm the sitemap keeps listing only the seven public marketing pages.

Login model stays exactly as it is: one login page, your staff account lands in the agency console, each client account lands in their own portal, and clients can only ever read their own business (enforced by the per-business database policies already in place).

## Part 2 — VDS on ERA (full operations, Enterprise, clean data)

VDS is already seeded as an active Enterprise business with the downloadable-app add-on. So this is not a data migration; it is standing up the real thing on `vdsmobile.com` and using it as the first live proof that the platform runs a business end to end.

Order of work:

1. **Domain** — connect `vdsmobile.com` and `www.vdsmobile.com` to this project through Lovable's domain flow, then register both as verified domains for the VDS business so hostname resolution serves the VDS tenant site there. (`eraleadgen.com` keeps serving the ERA marketing site.)
2. **Business profile** — real VDS name, legal name, timezone, support email/phone, brand colors, logo.
3. **Catalog** — enter the real detailing services with prices and durations through the Catalog tab. These publish straight to the customer-facing VDS site.
4. **Public VDS site** — the tenant site at `vdsmobile.com`: services, pricing, booking entry point, contact, and VDS branding rather than ERA's. This needs a real design pass, not the current bare tenant page.
5. **Booking** — customer booking flow on the VDS site writing into the same bookings the portal reads, with confirmation email to the customer and to VDS.
6. **Enterprise features on** — customer portal, specialist portal, analytics, and the rest already flow from the Enterprise tier; verify each tab works with real VDS data.
7. **Go-live checklist** — run VDS through the delivery workspace in the agency console so the status lights and the seven-day process are exercised on a real client.

### What I need from you along the way

- VDS logo file and brand colors.
- The real service list with prices.
- Support email and phone for VDS.
- Access to change DNS for `vdsmobile.com`.

### Technical notes

- No changes to tier/add-on entitlements, payment, lifecycle, or the per-business isolation rules.
- Admin routes move into the existing `_authenticated` subtree; the staff check reuses the existing `is_platform_staff` database function through an RLS-scoped read, no elevated access added.
- VDS domains are inserted into the domain mapping table with `verified_at` set, which is what the public read policy requires.
- The VDS public site is a tenant-scoped surface reading only active services for that business id.

Given credits are limited, I'd do Part 1 in one pass (it's small), then Part 2 in the order above, stopping after the public VDS site is live so the most visible piece lands first.
