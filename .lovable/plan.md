# Tier and add-on gating

Tier and add-ons stay in two separate places. Nothing derives one from the other.

## Data model

**1. Tier stays where it is: `businesses.plan_tier`** (`basic | growth | enterprise`), already
in the schema. No change needed except a lookup table that says what each tier includes.

**2. Features become rows, not booleans.** A new enum `platform_feature` lists every gateable
capability:

```
website, ai_chat_widget, core_engines, payments, admin_dashboard,
self_serve_setup, email_automations,          -- basic
customer_portal, specialist_portal,           -- growth
voice_sms_agent, sms_automations,
advanced_analytics, partner_network           -- enterprise
```

`plan_tier_features (plan_tier, feature)` is a static mapping table, seeded in the migration:
basic gets its seven, growth gets those plus two, enterprise gets all thirteen. Cumulative by
seeding, not by comparing tiers with `>=` — there is no tier ordering anywhere in SQL, so a
future tier can drop a feature without breaking the model.

**3. Add-ons are their own table, keyed on the business, never on the tier:**

```sql
create type public.addon_kind as enum ('ad_management', 'white_label_branding');

create table public.business_addons (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  addon addon_kind not null,
  is_active boolean not null default true,
  price_cents integer not null,          -- per-client dollar amount, staff-entered
  currency text not null default 'usd',
  billing_interval text not null default 'monthly',
  activated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, addon)
);
```

`price_cents` is per row, so two businesses on the same add-on carry different amounts. There
is no platform-wide rate column anywhere — nothing to fall back to. A validation trigger
(not a CHECK, per project rules) rejects `price_cents < 0` and requires `deactivated_at` to be
null while `is_active`.

Orthogonality is structural: `business_addons` has no `plan_tier` column, and
`plan_tier_features` has no add-on rows. Basic + Ad Management is just a `basic` business with
one active add-on row. Enterprise without Ad Management is an enterprise business with no such
row. Neither table can see the other.

## Enforcement — the same business_id-scoped RLS pattern

No new mechanism. Two `SECURITY DEFINER` predicates alongside the existing
`is_member_of` / `is_business_manager` / `is_platform_staff`:

```sql
create or replace function public.business_has_feature(_business_id uuid, _feature platform_feature)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.businesses b
    join public.plan_tier_features f on f.plan_tier = b.plan_tier
    where b.id = _business_id and f.feature = _feature
  )
$$;

create or replace function public.business_has_addon(_business_id uuid, _addon addon_kind)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_addons
    where business_id = _business_id and addon = _addon and is_active
  )
$$;
```

`business_has_addon` reads only `business_addons`. It never joins `businesses`, never reads
`plan_tier`. There is no code path by which a tier can satisfy an add-on check — a higher tier
grants nothing extra because the query it would have to influence does not reference it.
The reverse also holds: `business_has_feature` never reads `business_addons`.

RLS on the two new tables follows the proven pattern exactly:

```sql
grant select on public.plan_tier_features to anon, authenticated;   -- static price-list data
grant all on public.plan_tier_features to service_role;
-- business_addons: no anon grant. Dollar amounts are never public.
grant select on public.business_addons to authenticated;
grant all on public.business_addons to service_role;

alter table public.business_addons enable row level security;

create policy "members read their business addons" on public.business_addons
for select to authenticated
using (public.is_member_of(business_id) or public.is_platform_staff());

create policy "platform staff manage addons" on public.business_addons
for all to authenticated
using (public.is_platform_staff())
with check (public.is_platform_staff());
```

Client-side managers get **no** insert/update policy — pricing is staff-entered, so business
owners can read their add-on and its amount but cannot create one or change the number. Every
policy is keyed on `business_id` through the same predicates already in place, and every write
policy carries `WITH CHECK` so a staff row cannot be stamped with the wrong business.

`plan_tier` itself stays writable only by platform staff — the existing
"managers update their business" policy would let an owner set their own tier to `enterprise`.
That gets tightened in the same migration with a trigger that rejects a `plan_tier` change
unless `is_platform_staff()`.

## Application layer

- One server function returns the resolved entitlement set for the current tenant:
  `{ tier, features: platform_feature[], addons: { addon, isActive }[] }` — features and
  add-ons as two separate arrays, merged nowhere.
- UI gating reads that payload; route-level gating for portals (`/portal`, `/staff`) checks
  the feature and 404s otherwise. UI gating is UX; the RLS policies on each feature's own
  tables remain the security boundary, same as the foundation phase.
- No `supabaseAdmin` in any of this. Staff writes go through the RLS-scoped client under the
  `is_platform_staff()` policy, so nothing new gets added to the elevated-access register.

## Order of work

1. Migration: enums, `plan_tier_features` + seed, `business_addons`, grants, RLS, predicates,
   tier-change trigger, `updated_at` trigger.
2. Entitlements server function + typed helpers.
3. Staff add-on management UI (activate/deactivate, per-client amount).
4. Feature gating applied to portals and Enterprise surfaces.
5. Isolation test pass: business A cannot read business B's add-on rows or amounts; an
   enterprise tenant with no add-on row fails `business_has_addon`.
