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

Preview-verified only. On the preview host, the visitor hostname arrives solely in
`x-forwarded-host`; a client-forged value was observed being overwritten by the edge.
This is **not** yet confirmed on a real tenant domain — the project is unpublished and
no custom domain is connected. To complete verification: publish, connect a tenant
domain, insert its hostname into `business_domains`, then re-probe the live domain, its
`www.` variant, the published platform host, and a forged `x-forwarded-host` naming a
different tenant. Until then, resolution stays labelled preview-verified.
