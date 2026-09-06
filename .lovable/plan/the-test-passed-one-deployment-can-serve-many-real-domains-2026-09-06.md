# The test passed — one deployment can serve many real domains

With the Primary flag off, I re-requested all three addresses immediately. Measured just now:

```text
https://eraleadgen.com       -> 200, serves the site
https://www.eraleadgen.com   -> 200, serves the site   (was 302 before)
https://test.eraleadgen.com  -> 200, serves the site   (was 302 before)
```

No redirects, no errors, valid certificates on all three. So the "one public address per
project" ceiling was never a platform limit — it was the Primary flag, and it is off now.
The multi-tenant premise of the rebuild holds: one system, many client addresses.

Leave Primary unset. Do not re-set it.

Two things I also observed in the same check:

- A forged host header sent to `test.eraleadgen.com` changed nothing — the app ignored it, as
  designed.
- `test.eraleadgen.com` currently shows the ERA marketing site. That is correct-ish but not
  ideal: it is an address with no client attached, and the intended behaviour for an unknown
  address is "nothing found", not "fall back to ERA". Fixing that is step 2 below.

## Step 1 — prove isolation across two real addresses (before building on this)

Right now only ERA's addresses are live; `vdsmobile.com` still has broken DNS, so there is no
second real client address to test against. Rather than wait on DNS, borrow one:

1. Temporarily attach `test.eraleadgen.com` to the VDS client record.
2. Re-check, in this order, and record each result:
   - `eraleadgen.com` serves the ERA marketing site — no VDS branding, services or content.
   - `test.eraleadgen.com` serves the VDS site — black/gold branding, the 9 VDS services,
     the VDS booking flow.
   - Neither page contains a single element belonging to the other.
   - A forged host header naming the other client changes nothing on either address.
   - An address attached to nobody (e.g. a made-up subdomain) returns nothing, not a client site.
   - Signed in as an ERA account, reads of VDS records come back empty, and vice versa — from
     the public site, the client portal, and background functions alike.
3. Detach `test.eraleadgen.com` from VDS afterwards, leaving it as a spare test address.

If any check fails, nothing gets built on top until it passes.

## Step 2 — unknown-address behaviour

An address with no client attached should render a plain "site not found" page rather than the
ERA marketing site. ERA's own addresses stay explicitly mapped to the marketing site, so this
change cannot affect them.

## Step 3 — `www` handling, now that Primary is gone

The platform's built-in "www folds into the root address" behaviour was a side effect of the
Primary flag. With it off, each client's `www` address is handled inside the app: if a `www`
address is attached to a client, redirect it to that client's main address. ERA's own `www`
gets the same treatment.

## Step 4 — repair the VDS addresses

Unchanged and still outstanding regardless of the above: `vdsmobile.com` failed provisioning and
`www.vdsmobile.com` still points at the old host with its verification record missing. Both need
DNS corrections at the registrar before VDS can go live on its own address.

## Technical notes

- Hostname resolution already reads the real `Host` on published traffic and deliberately ignores
  forwarded headers there (`src/lib/tenant-hostname.ts`); the measurement above is consistent
  with that.
- Step 2 changes the null-tenant branch in `src/lib/tenant.functions.ts` / the root route so a
  non-platform hostname with no `business_domains` row renders a 404 surface, while
  `eraleadgen.com` and `www.eraleadgen.com` stay on the marketing path.
- Step 3 is an app-level redirect keyed on `business_domains.is_primary`, evaluated server-side
  before render.
- Resolution stays a routing decision only; RLS keyed on `business_id` remains the actual gate.
