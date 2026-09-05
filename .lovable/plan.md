# Is "one public domain per project" really a hard limit?

Short answer: **no — and there is a third path.** What I measured earlier was not a platform
ceiling on domains. It was one setting: the **Primary domain** flag.

## What I verified just now

All three connected addresses are fully live and healthy on this one project:

```text
https://test.eraleadgen.com  -> 302 redirect to https://eraleadgen.com/
https://www.eraleadgen.com   -> 302 redirect to https://eraleadgen.com/
https://eraleadgen.com       -> 200, serves the app   (this one is marked Primary)
```

So the hosting layer already accepts many custom domains on a single deployment, terminates SSL
for each, and routes each to this project. The only reason the other two do not serve content is
that one domain is flagged Primary, and the platform's documented behaviour is: *when a primary
domain is set, every other connected domain 302-redirects to it.* The documentation also states
the primary flag is **optional and can be unset at any time**. There is no documented limit on
how many domains a project may connect.

That reframes the problem completely: the question is not "can one deployment serve many
tenant domains" (it clearly can reach them), it is "does unsetting Primary make the other
domains serve content instead of redirecting?" That single unverified fact decides everything,
and it is a two-minute, fully reversible test.

## Step 1 — the decisive test (reversible, ~2 minutes)

1. In Project Settings → Domains, unset the Primary flag (leave all three domains connected).
2. Re-request all three addresses and read the status codes.
3. Interpretation:
   - **All three return 200** → the third path is real. One deployment, many tenant domains,
     the multi-tenant premise of the rebuild holds, and neither of the two costly options is
     needed. The app's hostname resolution already reads the real `Host` on published traffic
     (measured previously), so tenant routing works the moment the redirect stops.
   - **They still redirect, or start failing** → the redirect is structural, not the flag, and
     we fall back to the options below.
4. If the test fails, re-set `eraleadgen.com` as Primary — the state is exactly as it is now.

Cost of the test window: while Primary is unset, `www.eraleadgen.com` stops folding into the
root domain. For a few minutes on a site with no live traffic depending on that, this is
negligible.

## Step 2 — if the test passes

- Add each client's domain to this project and mark it verified in the Agency Console.
- Do **not** re-set a Primary domain — that flag is what breaks multi-tenancy here.
- Handle `www` → root per tenant inside the app with our own redirect, since the platform's
  built-in `www` folding depends on the Primary flag we are giving up.
- Re-run the tenant isolation pass across two real domains (VDS + ERA) to confirm each serves
  only its own content.

## Step 3 — fallbacks, in order of preference, only if the test fails

1. **External routing layer in front of the project.** Point each tenant domain at a
   Cloudflare (or similar) worker/proxy that we control, and have it forward to this project's
   stable `project--<id>.lovable.app` host while carrying the visitor hostname in a header the
   edge cannot be tricked on. This preserves one deployment and one database. Cost: an extra
   infrastructure piece to own, and the hostname-trust rules in `src/lib/tenant-hostname.ts`
   must be re-measured against it, because a self-managed proxy changes which header is
   authoritative. The platform documents a "proxy mode" for customer-managed proxies, so this
   is a supported shape, not a hack.
2. **A separate project per client.** Genuinely works, but it is the expensive option: each
   client's site becomes its own deployment to publish and maintain, and either each carries its
   own backend or every one of them reads the shared one across projects. This is the last
   resort, not the default.
3. **Subdomains of eraleadgen.com per client.** Cheap and immediate, but every client site
   would live under our brand rather than their own domain — acceptable as a launch stopgap,
   not as the model.

## Technical notes

- Hostname resolution in the app is already correct for this: on published traffic `Host`
  carries the real visitor hostname and forwarded headers are deliberately ignored
  (`src/lib/tenant-hostname.ts`), and `resolveTenant` maps hostname → `business_id` through
  `business_domains` before render, with unknown hostnames resolving to nothing.
- Resolution stays a routing decision only; RLS keyed on `business_id` remains the actual gate.
- Unrelated but still outstanding for VDS: `vdsmobile.com` is in `provisioning_failed` and
  `www.vdsmobile.com` still points at the old host (`216.24.57.x`) with the verification record
  missing. Those DNS repairs are needed regardless of which path we take.
