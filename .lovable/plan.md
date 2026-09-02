# Payment phase

Payment does exactly one authorized thing: move a business from `pending_payment` (or
`expired`) to `active`, set `is_active = true`, clear `slug_reserved_until`. It keeps
whatever slug the business currently holds — no reclaim of a clean address that was
bumped by another signup. That stays a deliberate one-way decision.

## 1. How a business gets its tier and add-on pricing

Your instinct is right, with one adjustment: the invite carries the **commercial terms**,
and onboarding completion **copies** them onto the business row.

Why the invite is the right home:
- It's already staff-only, already created right after the discovery call, already bound
  to one named prospect, and already the only door into the platform. The tier is a
  discovery-call outcome, so it belongs on the artifact the discovery call produces.
- It means the terms exist *before* the account does, so there is never a window where a
  business exists with no agreed tier and a staff member has to remember to set it.
- No new access mechanism: `invites` is already platform-staff-only under RLS, no `anon`
  privileges at all.

The adjustment: an invite is consumed at registration and the business isn't created until
onboarding completes, possibly days later. So the terms have to survive that gap. They do,
because the invite row survives redemption (status flips to `accepted`, row stays) and
already records `accepted_user_id`. Onboarding completion looks up the accepted invite for
the provisioning user and reads the terms off it.

### Schema

On `invites`:

| column | meaning |
|---|---|
| `plan_tier plan_tier not null default 'basic'` | staff-set at issue time |
| `setup_fee_cents integer not null default 0` | one-time, optional |
| `subscription_price_cents integer not null` | the agreed per-interval tier price for this client |
| `billing_interval text not null default 'monthly'` | monthly / quarterly / annual |

New table `invite_addons` (mirrors `business_addons`, same shape, keyed on invite):

```sql
create table public.invite_addons (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.invites(id) on delete cascade,
  addon addon_kind not null,
  price_cents integer not null,
  billing_interval text not null default 'monthly',
  notes text,
  created_at timestamptz not null default now(),
  unique (invite_id, addon)
);
grant select, insert, update, delete on public.invite_addons to authenticated;
grant all on public.invite_addons to service_role;
alter table public.invite_addons enable row level security;
create policy "platform staff manage invite addons" on public.invite_addons
  for all to authenticated
  using (public.is_platform_staff()) with check (public.is_platform_staff());
```

No `anon` grant. Amounts are never public — same rule as `business_addons`.

Prices stay per-client integers with no platform-wide fallback, exactly as the add-on phase
established. Tier and add-ons stay orthogonal: `plan_tier` on the invite and `invite_addons`
rows never read each other, and `business_has_addon()` still reads only `business_addons`.

### Carry-over at onboarding completion

Inside the existing `completeOnboarding` elevated path (no new call site), after the
business row is inserted:
- set `plan_tier` from the accepted invite (the existing `guard_plan_tier_change` trigger
  allows it because the provisioning path runs with no end-user JWT, same as the lifecycle
  guard),
- insert one `business_addons` row per `invite_addons` row, copying `price_cents`,
  `billing_interval` and `notes`, with `is_active = false` until payment lands,
- record `invite_id` on the business (`businesses.origin_invite_id`) so checkout can prove
  which agreed terms it is charging, without trusting anything the client sent.

If no accepted invite is found (bootstrap accounts), tier stays `basic` and there are no
add-ons — the client still cannot choose either.

Staff can still change tier and add-on pricing afterwards through the existing
`/admin/addons` console; the invite is the default, not a lock.

### Staff UI

`/admin/invites` gains a terms block on the create form: tier select, subscription price,
billing interval, optional setup fee, and per-add-on price rows. The register list shows the
agreed terms alongside each invite.

## 2. Checkout

Provider: **Stripe**, enabled through Lovable's built-in payments integration (I'll open the
setup card when you approve; nothing in the flow below depends on which provider, only the
verification call changes).

- `createCheckoutSession` (authenticated server fn): resolves the caller's business through
  their membership row on the RLS-scoped client, rejects anything not in `pending_payment`
  or `expired`, reads the amount **from the business's own tier price and active-agreed
  add-on rows on the server** — never from the request body — and creates a Stripe Checkout
  Session with `client_reference_id = business.id` and metadata `{ business_id }`.
- The session id is recorded in a new `payments` table before redirect, so an inbound webhook
  always has a local row to match.
- Success URL returns to `/dashboard?session=…`. That redirect **displays nothing
  authoritative** — the dashboard just polls the payment row's status. A frontend redirect
  never transitions anything.

### `payments` table

```sql
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null default 'stripe',
  provider_session_id text unique,
  provider_event_id text unique,          -- idempotency key for webhook retries
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'pending', -- pending | paid | failed
  webhook_verified_at timestamptz,
  api_verified_at timestamptz,
  activated_at timestamptz,
  raw_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "members read their business payments" on public.payments
  for select to authenticated
  using (public.is_member_of(business_id) or public.is_platform_staff());
```

No client write policy at all — only the verified server path writes here.

## 3. Webhook verification flow (the exact order)

`POST /api/public/webhooks/stripe` — public prefix, so it authenticates itself:

1. Read the **raw body text** before any parsing.
2. **Signature check** — recompute the HMAC-SHA256 over `t.payload` using the Stripe
   webhook signing secret, compare with `timingSafeEqual`, and reject a timestamp older
   than five minutes (replay window). Failure → `401`, nothing else runs.
3. Parse. Ignore every event type except `checkout.session.completed`.
4. **Idempotency claim** — attempt to write the Stripe `event.id` into
   `payments.provider_event_id` for the row matching `client_reference_id`, conditional on
   `provider_event_id is null` (or rely on the unique index). Zero rows updated means this
   event was already processed → return `200 OK` immediately and do nothing else. Retries
   and duplicate deliveries land here. The unique index makes this safe even against two
   concurrent deliveries: exactly one wins.
5. **Independent live API verification** — do *not* trust the payload's amounts or status.
   Re-fetch the session directly from Stripe's API by id
   (`GET /v1/checkout_sessions/{id}`) using the secret key, and require:
   `payment_status === 'paid'`, `amount_total` equal to the amount recorded locally at
   checkout, currency match, and `client_reference_id` equal to the business id on the
   local row. Any mismatch → mark the payment `failed`, log, return `200` (so Stripe stops
   retrying a permanently bad event) and **do not transition**.
6. Only with both checks passed — signature-verified webhook *and* live API confirmation —
   stamp `webhook_verified_at`, `api_verified_at`, `status = 'paid'`, then perform the
   single lifecycle transition.

### The transition

One conditional update, scoped by business id, guarded on the state it expects:

```sql
update public.businesses
   set lifecycle = 'active',
       is_active = true,
       slug_reserved_until = null
 where id = $1
   and lifecycle in ('pending_payment', 'expired');
```

- `slug` is not in the SET list. Whatever address the business currently holds is what it
  keeps.
- Zero rows updated = already active. That's the second idempotency layer: even if step 4
  were somehow bypassed, the transition itself cannot fire twice.
- Add-on rows for the business flip to `is_active = true` in the same pass, scoped by
  `business_id`.
- Runs through `supabaseAdmin` (no user session on a webhook). Registered in
  `docs/elevated-access.md` in the same change, with the tenant id taken from the
  **API-verified** session, never from the request body.

### Reconciliation fallback

A missed webhook shouldn't strand a paying client. `verifyMyPayment` (authenticated, called
by the dashboard while a payment is pending) runs steps 5 and 6 on demand for the caller's
own pending payment row — same live API check, same conditional transition, same
idempotency. It cannot invent a payment: it only ever re-reads a session id the server
itself created.

## 4. Dashboard

`pending_payment` gains a real "Complete setup — <tier> · $X/mo (+ add-ons)" action showing
the staff-agreed terms read-only, and a pending-verification state while the two checks
resolve. `expired` gets the same, with a note that the current address is kept as-is.

## 5. Verification before I call it done

- Frontend redirect alone (hitting `/dashboard?session=…` with a fabricated id) transitions
  nothing.
- Replayed webhook body with a valid old signature is rejected on the timestamp window.
- The same event delivered twice produces one transition and one paid row; concurrent
  duplicate deliveries produce one winner.
- A webhook whose payload claims `paid` while the live API says `unpaid` transitions nothing.
- An amount tampered with in the payload is caught by the API amount comparison.
- A business that was bumped to `slug-expired-abc123` keeps that slug through activation.
- A second activation attempt on an already-active business is a no-op.
- Business A's payment rows are unreadable by business B.

## Technical notes

Files touched: one migration (invite terms columns, `invite_addons`, `payments`,
`businesses.origin_invite_id`), `src/lib/invites.functions.ts` + `invites.ts`,
`src/routes/admin.invites.tsx`, `src/lib/onboarding.functions.ts` (carry-over),
`src/lib/payments.functions.ts` + `payments.server.ts` (new),
`src/routes/api/public/webhooks/stripe.ts` (new),
`src/routes/_authenticated/dashboard.tsx`, `docs/elevated-access.md`.
