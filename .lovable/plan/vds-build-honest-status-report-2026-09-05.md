# VDS build: honest status report

## What is actually working

- **VDS exists as a real client record**, same as any other: active, Enterprise tier, Eastern timezone, black/gold branding, support email and AI phone number set. 9 live services in the catalog, 1 owner login attached, 1 active add-on (the downloadable app), no payment row (it was granted, not purchased).
- **The VDS website itself is built and renders correctly** — logo, services and prices pulled from the catalog, reviews, membership, quote/book form, FAQ, footer, SMS button.
- **Booking from the VDS site works**: a visitor's request is saved against VDS only, with the price recalculated on the server so it can't be tampered with.
- **The address-to-client matching logic is correct.** Tested safely (no traffic to the live vdsmobile.com): requesting the site as `vdsmobile.com` returns the VDS site; as `eraleadgen.com` or `test.eraleadgen.com` it returns the ERA site. Unknown addresses fall back to ERA marketing rather than to some random client. So the app code is not the bug.

## What is actually broken

**1. The hosting layer never lets vdsmobile.com reach the app.** Two separate problems:

- `vdsmobile.com` is in a *failed setup* state on the hosting side (7+ hours).
- `www.vdsmobile.com` still points at the old Base44 host (`216.24.57.x`) and the ownership record was never added, so it reads as "drifted".

**2. Even with DNS fixed, this project can only serve one public address.** I confirmed this on the safe subdomain: `test.eraleadgen.com` returns a redirect straight to `eraleadgen.com`. Every non-primary address attached to this project is redirected to the primary one before any of our code runs. Since `eraleadgen.com` is the primary, `vdsmobile.com` would land on the ERA site even after DNS is corrected. This is the real root cause of what you saw, and it is not fixable from inside the app.

**3. Delivery/status tracking for VDS is empty.** Zero launch-status lights and zero go-live checklist rows exist for VDS, so the portal shows nothing as live and the Agency Console workspace has nothing to check off.

## Agency Console: same system or separate?

Same system, no duplication. The Agency Console reads the same `businesses` rows, the same `business_id`, and the same lifecycle values (`pending_payment` / `active` / `suspended` / `expired`) created by onboarding. Client profiles, delivery tasks, launch status, domains, members, payments and add-ons are all keyed to that one `business_id` and scoped by the same tenant rules. Nothing about the Agency Console is a parallel or shadow record set.

## What I recommend next (in order)

1. **Decide the domain model.** Either (a) each client website gets its own Lovable project with their domain as primary, while all operations stay in the ERA portal here, or (b) client sites live on subdomains of eraleadgen.com. Option (a) matches what you want VDS to be; option (b) works today with no hosting change but is not a client-branded address.
2. **Repair VDS DNS** — the `www` record still points at Base44, and the ownership record is missing. Needed under either option.
3. **Seed VDS's status lights and go-live checklist** so the portal and Agency Console reflect reality instead of an empty board.
4. **Per-client domain management in the Agency Console** — add, verify, remove and mark-primary an address per client, so this is a workflow instead of a manual database edit.

Nothing else should be built on top until step 1 is decided, because it changes how every future client site is served.
