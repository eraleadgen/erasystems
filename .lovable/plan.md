# Elevated-privilege audit, whoami removal, and the custom-domain retest

## 1. The custom-domain retest cannot run yet — here is why, and what unblocks it

I checked the project's domain state directly: **no custom domain is connected, and the project is not published.** There is no real tenant hostname in existence to test against, so any claim that hostname resolution is "verified on a real domain" would be fabricated. What is verified today is narrower and I will keep describing it that way: on the preview host, the visitor hostname arrives only in `x-forwarded-host`, and a client-forged `x-forwarded-host` was observed being overwritten by the edge.

Unblocking sequence (needs your action at step 1-2):

1. Publish the project.
2. Connect a real tenant domain (e.g. `apexdetail.example`) and let DNS verify.
3. Insert that hostname into `business_domains` for the Apex tenant.
4. Re-run the probe against the live domain, `www.` variant, the published `project--<id>.lovable.app` host, and a request carrying a forged `x-forwarded-host` naming the *other* tenant — confirming the edge overwrites it rather than passing it through.
5. Only then mark resolution verified, and record the measured behaviour in the header comment of `src/lib/tenant-hostname.ts`.

Because step 4 needs the probe endpoint, and you also want it deleted: I will delete `src/routes/api/public/whoami.ts` now (below) and re-add a probe temporarily at step 4 if you want, rather than leaving a public diagnostic endpoint standing.

## 2. Yes, this platform has a service-role equivalent — and the real scope here is one file, zero call sites

The equivalent is `SUPABASE_SERVICE_ROLE_KEY`, exposed through `supabaseAdmin` in `src/integrations/supabase/client.server.ts` (auto-generated). It bypasses RLS entirely.

Full audit of every use, by search across `src/`:

```text
src/integrations/supabase/client.server.ts   the client definition itself (generated, not a call site)
<no other file references supabaseAdmin, client.server, or the service role key>
```

So today **nothing in this app uses elevated privileges.** Both current server functions (`resolveTenant`, `getTenantServices`) use the publishable/anon key and are gated by the `TO anon` public-read policies. That is the desired posture, and the audit burden you are bracing for is not smaller by luck — it is small because no admin path has been written yet. It grows the moment one is, which is what the rest of this plan prevents.

## 3. Standing rules so this stays auditable as the app grows

Add `docs/elevated-access.md` as the single register, and enforce these rules on every future admin path:

- Elevated access is permitted only for: tenant provisioning, Stripe/webhook writes, and platform-staff operations. Never for ordinary reads.
- Every `supabaseAdmin` query must carry an explicit `.eq('business_id', ...)` (or equivalent scoping) — RLS is off for that client, so scoping is the code's job, not the database's.
- The `business_id` used must come from server-resolved context or a verified webhook payload, never from client-supplied input.
- Caller authorization is checked first via the RLS-scoped client (`requireSupabaseAuth` + `is_business_manager` / `is_platform_staff`), then `supabaseAdmin` is dynamically imported inside the handler.
- Every new admin call site gets a row in `docs/elevated-access.md`: function, why elevation is needed, which column scopes it, where the tenant id came from.

## 4. Deletion

`rm src/routes/api/public/whoami.ts` — it is under `/api/public/*`, which bypasses site auth on a published site, so it should not exist by default.

## Technical notes

- Files changed: delete `src/routes/api/public/whoami.ts`; add `docs/elevated-access.md`; append the audit rules to `AGENTS.md` so future work inherits them.
- No database migration and no behaviour change to tenant resolution in this step.
- Nothing here can substitute for step 1 above: until a domain is connected and published, hostname resolution stays labelled preview-verified only.
