# Elevated (service-role) access register

`supabaseAdmin` (`src/integrations/supabase/client.server.ts`, generated) uses
`SUPABASE_SERVICE_ROLE_KEY` and **bypasses RLS entirely**. With that client, tenant
scoping is the code's job, not the database's.

## Current call sites

| Function | File | Why elevation is needed | Scoping column | Source of the tenant id |
| --- | --- | --- | --- | --- |
| _(none)_ | — | — | — | — |

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



## Known-and-accepted linter findings

- `invite_attempts`: RLS enabled with **no policies and no grants** — intentional.
  The table is server-internal; "no policy" is the lock, not an oversight.
- Six `SECURITY DEFINER` functions executable by `authenticated`
  (`is_member_of`, `is_business_manager`, `is_platform_staff`, `has_business_role`,
  `business_has_addon`, `business_has_feature`) — required, since RLS policies are
  evaluated as the calling role. The invite functions (`consume_invite`,
  `release_invite`, `invite_throttle_*`) have `EXECUTE` revoked from `public`,
  `anon` and `authenticated`.
