# Lifecycle of an unpaid business — findings and proposal

## What happens today (verified in code)

**The row is created and then nothing ever touches it again.** On completion the wizard writes a
`businesses` row with `is_active = false` and `plan_tier` left at its default `basic`, plus an
`owner` membership and the service catalog. There is no payment state on the row, no expiry, and no
cleanup job. A prospect who fills in the wizard and never pays leaves a permanent, invisible
business record.

**Slug squatting is real, name collision is not.** `name` and `legal_name` are free text with no
uniqueness, so two businesses can share a name. `slug` is unique: the first "Apex Detailing" takes
`apex-detailing`, and every later one gets a random suffix (`apex-detailing-k3f9x`). So an abandoned
signup permanently holds the clean address, and a paying client with the same name silently gets a
worse one. That is the concrete harm.

**The post-completion redirect is broken.** The wizard sends the user to `/` on success. `/` is the
public tenant marketing page resolved from hostname — on the platform host with no tenant it renders
"Site not configured". A client who just finished setup is told their site doesn't exist. There is
no dashboard route in the project at all.

## Proposal

### 1. A lifecycle status on the business row, separate from `is_active`

Add `businesses.lifecycle` (new enum `business_lifecycle`: `pending_payment`, `active`,
`suspended`, `expired`), default `pending_payment`, set explicitly by onboarding. Keep `is_active`
as the public-visibility switch it already is (RLS for `anon` reads keys on it) — lifecycle is *why*,
`is_active` is *whether*. Payment flips `pending_payment → active` and sets `is_active = true` in one
step; a lapsed subscription later flips to `suspended` without deleting anything. Like `plan_tier`,
lifecycle gets a trigger so only platform staff (or the elevated payment path) can change it — a
business owner can't self-activate.

This keeps tier, add-ons, and lifecycle orthogonal, as already established: a `basic` business with
Ad Management active can still be `pending_payment`.

### 2. Slug reservation with an expiry window, not row deletion

Add `businesses.slug_reserved_until` (timestamptz, set to `now() + 14 days` at creation, cleared on
payment). Slug uniqueness becomes: a slug is taken if it belongs to a paid business, or to an unpaid
one whose reservation hasn't lapsed. Provisioning checks that before falling back to a suffix, and
an expired unpaid holder gets its slug rewritten to `<slug>-expired-<short id>` when a new signup
claims the clean one.

Nothing is deleted. The prospect's data, catalog and membership survive intact — if they come back
in month three they still have their setup, just at a different address. Deleting the row would
break the owner membership and the completed draft that points at it, and destroy real work for a
slow-moving client.

### 3. Expiry, not cleanup

A scheduled pass (a `/api/public/cron/*` route with the existing cron-secret auth) marks
`pending_payment` businesses older than 30 days as `expired` and releases the slug. `expired` is
reversible: the payment path accepts an `expired` business and reactivates it. No hard deletion in
this phase — a purge policy for genuinely dead records is a separate decision with a retention
question attached, and I'd rather you make it deliberately than inherit it from a cleanup job.

### 4. A real destination after completion

Add `/_authenticated/dashboard`: resolves the caller's business through their membership (RLS
scoped, no admin client) and renders the state honestly.
- `pending_payment` — setup summary, what's already saved, and a clear "not live yet, payment is the
  next step" state with the eventual checkout entry point.
- `expired` — same, plus a note that the address was released and can be reclaimed.
- `active` — the real management surface (grows in later phases).

The wizard's success redirect and the completed-draft branch both point here instead of `/`. This
is what payment will hand back to, so building it now means payment has a defined return target.

## What this gives the payment phase

Payment arrives at a business that is always in exactly one known state — `pending_payment`,
`expired`, `suspended`, or already `active` — and its job reduces to one authorized transition plus
setting `is_active` and clearing the slug reservation. No inference from `is_active = false`, which
today could mean "never paid", "lapsed", or "staff turned it off".

## Technical notes

- One migration: the enum, two columns on `businesses`, backfill of existing rows
  (`is_active = true → active`, else `pending_payment`), the staff-only lifecycle guard trigger, and
  a partial unique index expressing the reservation rule.
- `completeOnboarding` sets `lifecycle` and `slug_reserved_until` and takes the reservation into
  account in its existing suffix-retry loop. No new elevated call site — it's the same registered
  provisioning path in `docs/elevated-access.md`, which I'll update.
- Public `anon` reads still key on `is_active` only; no RLS mechanism changes.
