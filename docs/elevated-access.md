# Elevated (service-role) access register

`supabaseAdmin` (`src/integrations/supabase/client.server.ts`, generated) uses
`SUPABASE_SERVICE_ROLE_KEY` and **bypasses RLS entirely**. With that client, tenant
scoping is the code's job, not the database's.

## Current call sites

| Function | File | Why elevation is needed | Scoping column | Source of the tenant id |
| --- | --- | --- | --- | --- |
| `completeOnboarding` (`business_site` insert) | `src/lib/onboarding.functions.ts` | Provisioning: the business row and its website content are created before the caller holds any membership, so RLS cannot yet see them | `business_id` | The id of the `businesses` row inserted moments earlier in the same handler, after the caller was authenticated and their own draft verified |

Audited 2026-08-31: a repo-wide search for `supabaseAdmin`, `client.server`, and
`SUPABASE_SERVICE_ROLE_KEY` across `src/` matches only the generated client definition
itself. No application code uses elevated privileges. Both existing server functions
(`resolveTenant`, `getTenantServices`) use the publishable key and are gated by the
narrow `TO anon` public-read policies.

## Rules for any future elevated call site

1. Permitted only for: tenant provisioning, verified webhook writes (e.g. Stripe), and
   platform-staff operations. Never for ordinary reads or public lists.
2. Every query must carry an explicit `.eq('business_id', ...)` (or equivalent scoping
   predicate). Never rely on RLS — it is off for this client.
3. The `business_id` must come from server-resolved request context or a
   signature-verified webhook payload. Never from client-supplied input.
4. Authorize the caller first through the RLS-scoped client
   (`requireSupabaseAuth` + `is_business_manager` / `is_platform_staff`), then
   `const { supabaseAdmin } = await import("@/integrations/supabase/client.server")`
   **inside** the handler.
5. Add a row to the table above in the same change. A call site missing from this
   register is treated as a defect.

## Hostname resolution verification status

**VERIFIED on a genuine external custom domain — 2026-08-31.**

Test domain: `test.eraleadgen.com` (external zone, Google Cloud DNS; A →
185.158.133.1 + `_lovable` TXT proof), mapped to the Apex tenant in
`business_domains`.

Probe results:

| Request | Rendered tenant |
| --- | --- |
| `https://test.eraleadgen.com/` | Apex (correct) |
| same + `X-Forwarded-Host: northwindhvac.example` | Apex (forgery ignored) |
| same + `Forwarded: host=northwindhvac.example` | Apex (forgery ignored) |
| `https://safe-harbor-saas.lovable.app/` | 302 → primary custom domain |

Earlier measurements, which motivated the current logic:

- **Preview host**: `Host` is `localhost:8080`; the visitor hostname arrives only in
  `x-forwarded-host`, which the edge injects and overwrites.
- **Published host (before fix)**: `Host` carries the real visitor hostname, and
  `x-forwarded-host` was passed through from the client **unmodified**. A forged
  `X-Forwarded-Host` was observed selecting a different tenant's public site.

Fix in `src/lib/tenant-hostname.ts`: `Host` (falling back to the request URL) is
authoritative whenever it is a real hostname; forwarded headers are consulted only
when the connection terminated on a loopback/internal name (the preview runtime).
Unknown hostnames still resolve to no tenant — never a default.

Impact of the original bug was confined to *which public site rendered*: no private
data was reachable, because every read stays behind RLS and the narrow `TO anon`
SELECT policies.

Note: connecting `test.eraleadgen.com` made it the project's **primary** domain, so
the `lovable.app` host now 302-redirects to it. Change the primary in project
settings if that is not wanted. `www.test.eraleadgen.com` was not tested — no DNS
record exists for it (a `www.` label under a subdomain was not part of the CNAME).



## Elevated-access register

Every `supabaseAdmin` call site in the app must be listed here. Adding one
without an entry is a review failure.

### 1. Invite preview / redemption — `src/lib/invites.functions.ts`

| | |
| --- | --- |
| Functions | `previewInvite`, `redeemInvite` |
| Why elevated | The caller is anonymous **by definition** — they have no account yet, and creating an auth user requires the Auth Admin API. `anon` has zero privileges on `invites`, so an RLS-scoped client cannot see the row either. |
| Caller authorization | Not a session — the possession of a 256-bit invite token, verified by SHA-256 hash lookup, plus a per-IP throttle. `redeemInvite` claims the row through `consume_invite`, an atomic conditional update; zero rows returned aborts the request before any user is created. |
| Tenant scoping | **None required and none performed.** Invites are pre-tenant identity: the table has no `business_id`, and neither function reads or writes any tenant-scoped table. |
| Client input trusted | None. The account email comes from the invite row, not the submitted form; the submitted email is only compared against it (constant-time). Passwords are the sole client-supplied value. |
| Failure handling | If user creation fails after the claim, `release_invite` returns the row to `pending` so a genuine prospect is not locked out. |
| Leakage | Both functions return a uniform failure (`null` / generic message) with a fixed delay, so unknown / used / expired / revoked / wrong-email are indistinguishable. No invite column other than `email` and `full_name` is ever returned, and only for a live invite. |

### 2. Invite guessing throttle — `src/lib/invite-throttle.server.ts`

| | |
| --- | --- |
| Functions | `isThrottled`, `recordAttempt` |
| Why elevated | Same anonymous caller; `invite_attempts` has no grants and no policies for `anon`/`authenticated` and is unreachable via the Data API. |
| Tenant scoping | Not applicable — the table is keyed by request IP and holds no tenant or user data. |
| Client input trusted | None. The IP comes from `getRequestIP({ xForwardedFor: false })`, i.e. the connection, not a client-settable header. |
| Fail mode | Fails **open** on counter errors: the throttle is defence in depth over a 256-bit token, and must not become a denial-of-service on genuine prospects. |

### 3. Tenant provisioning at onboarding completion — `src/lib/onboarding.functions.ts`

| | |
| --- | --- |
| Function | `completeOnboarding` |
| Why elevated | `businesses` denies client inserts by design (no `INSERT` policy for `authenticated`), and the first `business_members` row cannot be written by the RLS policy that requires an existing manager. This is tenant provisioning — the permitted category. |
| Caller authorization | Performed **first**, through the RLS-scoped client from `requireSupabaseAuth`: the caller must own an `in_progress` `onboarding_drafts` row, which only their own invite-created account can hold. The admin client is imported inside the handler only after that check. |
| Tenant scoping | The `business_id` is generated by this handler's own insert and passed explicitly to every dependent write (`business_members`, `services`, the draft stamp). No elevated query reads or writes another tenant's rows; the draft writes are additionally scoped by `user_id`. |
| Client input trusted | Business content only (name, address, colors, catalog), all Zod-validated. The owner is `context.userId` from the verified session, never form input. `plan_tier` and `is_active` are **not** client-settable: the tier stays at its default and the business is created inactive, so onboarding cannot grant itself entitlements or go live before payment. |
| Double-submit | The draft is claimed atomically (`status in_progress -> completed`) before any tenant row is written. A second concurrent submit claims nothing and returns the existing `business_id`. On failure the claim is released so the client can retry. |


## Registration is invite-only

Open signup is **disabled at the auth provider**. `supabase.auth.signUp()` from a
browser fails regardless of what the UI offers, so `redeemInvite` is the only path
that can create an account. Removing the invite check would not silently reopen
registration — signup would simply stay closed until someone deliberately re-enabled
it in auth settings.

Token properties: 32 CSPRNG bytes, base64url; only the SHA-256 hash is stored;
bound to one normalized email; single-use via atomic claim; 7-day expiry; staff
revocable; plaintext displayed exactly once at issue time.

### One-time staff bootstrap (2026-09-01)

The very first platform-staff account was bootstrapped by inserting a single
`invites` row directly (`support@eraleadgen.com`), plus the matching
`platform_staff` row once that account existed. This is a **one-time chicken-and-egg
fix**: `/admin/invites` requires an existing staff member, and there was none.
It is not a repeatable pattern. Every subsequent staff account is issued through
`createInvite` from `/admin/invites`, identically to a client invite, and any
further direct insert into `invites` or `platform_staff` is a review failure.

**Completed 2026-09-01 22:37 UTC.** The invite was redeemed normally through
`/register`, and the single `platform_staff` row (`platform_admin`, user
`cf0462b3-a6e1-4300-902f-6c53641964e5` = `support@eraleadgen.com`) was inserted
directly. That closes the bootstrap: **no further direct database writes to
`invites` or `platform_staff` are permitted** — the staff console is now
self-sufficient and every future staff or client account goes through
`createInvite`.



### Business lifecycle expiry cron (2026-09-02)

`src/routes/api/public/cron/expire-businesses.ts` — `POST`, authenticated by the
platform cron secret (`authenticateCronRequest`) before any elevated import. There
is no user session, so this is a platform-operations caller, not a tenant one.

- Reads only `businesses` rows with `lifecycle = 'pending_payment'` older than 30 days.
- Every write is `.eq("id", row.id)` plus a `lifecycle = 'pending_payment'` guard, so a
  business that was paid between read and write is never touched.
- Writes exactly two columns: `lifecycle -> 'expired'` and `slug_reserved_until -> null`.
  No deletion, no tier change, no `is_active` change.

### Onboarding slug reclaim (2026-09-02)

Inside the already-registered `completeOnboarding` provisioning path. When the clean
web address is held by a business that never paid and whose 14-day reservation has
lapsed, that holder is renamed to `<slug>-expired-<short id>` and marked `expired`,
scoped by the holder's own `id`. Its data, membership and catalog are untouched. Only
the single base-slug attempt can reclaim, and only once per submission.


## Known-and-accepted linter findings

- `invite_attempts`: RLS enabled with **no policies and no grants** — intentional.
  The table is server-internal; "no policy" is the lock, not an oversight.
- Six `SECURITY DEFINER` functions executable by `authenticated`
  (`is_member_of`, `is_business_manager`, `is_platform_staff`, `has_business_role`,
  `business_has_addon`, `business_has_feature`) — required, since RLS policies are
  evaluated as the calling role. The invite functions (`consume_invite`,
  `release_invite`, `invite_throttle_*`) have `EXECUTE` revoked from `public`,
  `anon` and `authenticated`.

### Agreed-terms resolution (2026-09-02)

`src/lib/terms.server.ts` — `resolveAgreedTerms(businessId, planTier, originInviteId)`.
The tier price lives on the originating invite, which is platform-staff-only under
RLS, so it is read with the elevated client.

- Caller authorized first: the calling server function resolves the business through
  the caller's **own membership row** on the RLS-scoped client. This helper is never
  reached with a business id taken from the request.
- The invite id comes from `businesses.origin_invite_id`, never from the client.
- Reads only: one `.eq("id", originInviteId)` on `invites` (three price columns) and
  one `.eq("business_id", businessId)` on `business_addons`. No listing, no writes.

### Checkout session recording (2026-09-02)

`src/lib/payments.functions.ts` → `createCheckoutSession`. Insert into `payments`,
which deliberately has no client write policy, so the row must be written with the
elevated client.

- Caller authorized first through the RLS-scoped client: must be `owner`/`admin` of
  the business, and the business must be `pending_payment` or `expired`.
- `business_id` is the id from that membership row; the amount is computed
  server-side from the agreed terms. Nothing about price or tenant comes from the
  request body.

### Payment verification and activation (2026-09-02)

`src/lib/payments.server.ts` → `verifyAndActivate(sessionId)`, reached from the
webhook route and from the authenticated reconciliation fallback.

- The webhook authenticates itself by HMAC signature + 5-minute replay window before
  any elevated import; the reconciliation path is session-authenticated and confirms
  the payment row is visible to the caller under RLS first.
- The tenant is derived from the local `payments` row keyed by
  `provider_session_id` — never from the webhook payload.
- Live provider verification is an independent second check: amount, currency,
  `payment_status` and `client_reference_id` must all match the stored row.
- Idempotency: the event id is claimed with a conditional update
  (`.is("provider_event_id", null)`); zero rows claimed means already processed.
- Activation is one guarded statement, `activate_paid_business(business_id)`, which
  is `EXECUTE`-revoked from `authenticated`/`anon` and transitions only from
  `pending_payment`/`expired`. Running it twice is a no-op.

### Onboarding invite carry-over (2026-09-02)

Inside the already-registered `completeOnboarding` path. Looks up the accepted invite
by `accepted_user_id = context.userId` (verified session user, not payload), stamps
`plan_tier` and `origin_invite_id` on the new business, and copies the invite's
add-on rows onto that `business_id` **inactive** — only payment activation turns them on.

### Client plan selection (2026-09-03)

`src/lib/plan-selection.functions.ts` → `selectMyPlan`. `businesses.plan_tier` and
`business_addons` are staff-guarded under RLS, but a client must be able to pick
their own tier before paying.

- Caller authorized first through the RLS-scoped client: must be `owner`/`admin` of
  the business, and the business must still be `pending_payment` or `expired`.
- `business_id` is the id from that membership row; the tier is validated against a
  fixed enum and the amount is read from the server's `PLAN_PRICING` table, never
  from the request body.
- Writes: one `.eq("id", business.id)` update on `businesses` (also re-guarded with
  `.in("lifecycle", [...])`), and one `business_id`-scoped upsert/delete on
  `business_addons`. Add-ons are written `is_active: false`; only verified payment
  activates them.
- Refuses when the originating invite already carries staff-agreed pricing.

### Purchase notification (2026-09-03)

`src/lib/purchase-notification.server.ts` → `notifyTierPurchased`, called only from
`verifyAndActivate` after a payment transitioned a business to active.

- No end-user session exists on the webhook path; the tenant is the `business_id`
  from the local `payments` row, never from the provider payload.
- Reads only, each one `.eq("business_id", businessId)` / `.eq("id", businessId)`:
  business row, its add-ons, its service count, its owner membership, and that
  owner's auth email. No listing, no writes.
- The email goes to the fixed internal address `support@eraleadgen.com`; a send
  failure is logged and never fails the payment.

### Monthly statement send (2026-09-07)

`src/routes/api/public/cron/monthly-statements.ts` — `POST`, authenticated by the
cron secret before any elevated import.

- No user session exists on this path. The job reads only `business_site` rows whose
  `statement_email_enabled` is true, then handles each business one at a time.
- Every read for a statement goes through `sendStatementEmail(client, businessId)`,
  which filters on that explicit `business_id`; there is no cross-tenant query and
  no write to tenant data.
- A business is skipped unless it is active and on Enterprise, and the recipient is
  the business's own configured address — never anything from the request.

### Scheduled-job run log (2026-09-08)

Both cron routes (`expire-businesses`, `monthly-statements`) additionally insert and
update one row in `scheduled_job_runs`, keyed by that run's own id. The table holds no
tenant data and is readable only by platform staff. It exists so an unattended firing
of the scheduler can be observed after the fact rather than assumed.

### Partner / referral network (2026-09-08)

No elevated access. Two guarded database functions instead:

- `request_tenant_booking` now resolves an optional referral code itself. A code that
  is unknown, switched off, belongs to a non-Enterprise or inactive business, or
  belongs to the receiving business simply yields an unattributed booking.
- `referrals_sent(business_id)` is `SECURITY DEFINER` because the referrer is not a
  member of the business that served the job. It returns only the receiving business
  name, date, status and value — never customer name, email or phone — and its body
  requires `private.is_member_of(_business_id)` or platform staff. `EXECUTE` is
  revoked from `public`/`anon`.
- `bookings.referred_by_business_id` is write-once: `guard_booking_referrer` rejects
  any later change.

### Customer-facing booking emails (2026-09-08)

`src/lib/customer-emails.server.ts` plus the `booking-reminders` and
`review-requests` cron routes, and `src/lib/owner-welcome.server.ts`.

- Callers are either the public booking path (the customer is anonymous, there is no
  session) or a scheduled job authenticated by the cron secret.
- Every send resolves one booking by id, then reads that booking's own `business_id`
  for name, timezone, brand colour and support contacts. Nothing cross-tenant is read.
- The recipient always comes from the stored booking row (or, for the owner welcome,
  from the owner membership on that business). No caller may name a recipient or a
  template.
- Sends are claimed before dispatch (`confirmation_sent_at`, `reminder_sent_at`,
  `review_request_sent_at`, `businesses.welcome_email_sent_at`) so overlapping runs or
  webhook retries can never double-email; the claim is released if the send errors.
- Nothing else in tenant data is written.

### App icons (2026-09-09)

`src/routes/app-icon/$businessId/$variant.ts`.

- Public, unauthenticated route: a home-screen icon must be fetchable by the phone
  installing the app, and by anyone the client shares their site with.
- Entitlement is resolved first through `appIdentityById`, which only returns a row
  for an active business holding the downloadable-app add-on. A business without it
  gets a 404 and no elevated call is made.
- Elevation is used for exactly one thing: reading the logo object out of the private
  `onboarding-logos` bucket. The storage path comes from that business's own
  `logo_url` column, resolved server-side from the validated `businessId` in the URL;
  no caller-supplied path is ever passed to storage.
- No table is written and nothing but the image bytes is returned. If the object is
  missing or unreadable, the route falls back to a generated monogram.
