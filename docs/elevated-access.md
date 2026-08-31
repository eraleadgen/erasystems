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

Retested on the published host 2026-08-31, and it found a real bug:

- **Preview host**: `Host` is `localhost:8080`; the visitor hostname arrives only in
  `x-forwarded-host`, which the edge injects and overwrites.
- **Published host**: `Host` carries the real visitor hostname, and
  `x-forwarded-host` is passed through from the client **unmodified**. A forged
  `X-Forwarded-Host` was observed selecting a different tenant's public site.

Fix applied in `src/lib/tenant-hostname.ts`: `Host` (falling back to the request URL)
is authoritative whenever it is a real hostname; forwarded headers are consulted only
when the connection terminated on a loopback/internal name (the preview runtime).
Unknown hostnames still resolve to no tenant — never a default.

Impact of the original bug was confined to *which public site rendered*: no private
data was reachable, because every read stays behind RLS and the narrow `TO anon`
SELECT policies. Still outstanding: the same probe against an actual connected custom
domain, which requires a tenant domain to be connected to this project.

