# ERA Systems — Tenant Isolation Architecture (no code yet)

This is an architecture answer, not an implementation. Everything below is written against
what is actually in this project today: a TanStack Start v1 app running SSR in a Cloudflare
Worker (`src/server.ts` is the worker entry, wired through `vite.config.ts`), with
`src/start.ts` holding request middleware. There is **no backend yet** — no
`src/integrations/supabase`, no migrations. Lovable Cloud (Postgres + RLS) would need to be
enabled before any of the database work below exists.

## 1. Database isolation: RLS keyed on business_id

Every tenant-scoped table carries a non-nullable `business_id uuid`. Isolation is enforced by
RLS in Postgres, so a missed `.eq('business_id', ...)` in application code cannot leak data.

Membership lives in its own table (never a column on a profile), and policies call a
`SECURITY DEFINER` function so policy evaluation does not recurse into RLS.

```sql
-- who belongs to which business, and in what capacity
create type public.business_role as enum ('owner','admin','specialist','customer');

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.business_role not null,
  unique (business_id, user_id, role)
);

grant select on public.business_members to authenticated;
grant all on public.business_members to service_role;
alter table public.business_members enable row level security;

-- SECURITY DEFINER: bypasses RLS inside the check, so policies don't recurse
create or replace function public.is_member_of(_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = _business_id and user_id = auth.uid()
  )
$$;

create or replace function public.has_business_role(_business_id uuid, _role public.business_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = _business_id and user_id = auth.uid() and role = _role
  )
$$;
```

A real policy set for a tenant-scoped table:

```sql
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references auth.users(id),
  starts_at timestamptz not null,
  status text not null default 'pending',
  total_cents integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.bookings (business_id, starts_at);

grant select, insert, update, delete on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;

-- staff of that business see everything for that business
create policy "staff read business bookings" on public.bookings
for select to authenticated
using (public.is_member_of(business_id));

-- a customer sees only their own booking, and only within that business
create policy "customer reads own booking" on public.bookings
for select to authenticated
using (customer_id = auth.uid());

-- writes: the business_id being written must be one the caller belongs to.
-- WITH CHECK is the half people forget; without it a member of business A can
-- INSERT a row stamped business_id = B.
create policy "staff write business bookings" on public.bookings
for insert to authenticated
with check (public.is_member_of(business_id));

create policy "staff update business bookings" on public.bookings
for update to authenticated
using (public.is_member_of(business_id))
with check (public.is_member_of(business_id));

create policy "owners delete business bookings" on public.bookings
for delete to authenticated
using (public.has_business_role(business_id, 'owner'));
```

Rules that follow from this pattern and apply to every table:

- `business_id` is `not null` — a nullable tenant key produces orphan rows no policy covers.
- Every write policy needs `WITH CHECK`, not just `USING`.
- ERA staff cross-business access is a **separate** table/enum (`platform_staff`), never a role
  inside `business_members`, matching the master document's separation requirement.
- The service-role key bypasses RLS entirely. It is used only for provisioning and Stripe
  webhook writes, loaded inside a handler after the caller is verified — never for ordinary reads.

### The public-website hole, stated plainly

An anonymous visitor on a client's site must read that business's catalog, hours and branding.
That means narrow `TO anon` SELECT policies on exactly those tables, projecting only safe
columns, and no `anon` grant anywhere else. The public read path must never be the same query
path as the admin dashboard.

## 2. Hostname-based tenant resolution

Table:

```sql
create table public.business_domains (
  hostname text primary key,          -- stored lowercase, no port, no trailing dot
  business_id uuid not null references public.businesses(id) on delete cascade,
  is_primary boolean not null default false,
  verified_at timestamptz
);
grant select on public.business_domains to anon, authenticated;
```

Where the logic runs: in the **Cloudflare Worker, during SSR**, before React renders — as
request middleware in `src/start.ts` (or in the `__root` `beforeLoad`, which also runs
server-side on the first request). Order per request:

1. Worker receives the request, reads the hostname from the request object server-side.
2. Normalize (lowercase, strip port, strip trailing dot).
3. Look up `business_domains` → `business_id`, using a server publishable client.
4. Put `business_id` into router context. Every loader and server function reads it from
   context; nothing accepts a tenant id from a query param, body, or client-set header.
5. Unknown hostname → render a neutral 404, never a fallback tenant.

Critical: hostname resolution decides **which** tenant, RLS decides **whether** the caller may
read it. Resolution is not an authorization mechanism. For a signed-in user, the authoritative
tenant check is still `business_members` under RLS — a user on business B's domain must not
reach business A's dashboard even if they typed the URL.

## 3. The hostname-rewriting risk — direct answer

Yes, this is a real risk on this platform, and it is worth treating as unverified until probed.

What is certain from the project setup: the app runs on Cloudflare Workers, and Lovable custom
domains sit behind Lovable's edge (A record to `185.158.133.1`, with an explicit Cloudflare
"proxy mode" option documented for customer-managed proxies). So there is at least one proxy
hop between the visitor's browser and the code doing resolution. Concretely that means:

- `request.url` inside a Worker is not guaranteed to carry the visitor-facing hostname; a proxy
  can normalize the origin URL while the real hostname survives only in a forwarded header.
- The preview host (`id-preview--<uuid>.lovable.app`) and the stable
  `project--<id>.lovable.app` / `-dev.lovable.app` hosts are *different* hostnames from the
  client's custom domain, so any resolver must handle "platform hostname" as a first-class case
  or preview breaks while production works (or worse, the reverse).
- `X-Forwarded-Host` / `X-Forwarded-Proto` are client-forgeable unless a trusted layer
  overwrites them. Trusting them blindly is a tenant-spoofing vector: attacker sends
  `X-Forwarded-Host: bigclient.com` and, if that header wins over the real Host, resolution
  picks the wrong tenant. This is exactly the class of bug you hit before, and it is the reason
  RLS-by-membership must remain the real gate — a wrong resolution should yield empty data for
  an unauthorized user, not another tenant's records.

I will not assert which header actually carries the truth here without measuring it. That
measurement is step one of implementation, before any tenant logic is written.

### Step 1 of implementation: the header probe

A temporary diagnostic route (`src/routes/api/public/whoami.ts`) that returns the full inbound
header set plus `request.url`, then hit it on:

1. the preview URL, 2. the published `project--<id>.lovable.app` URL, 3. a real custom domain,
4. a `www.` variant, and 5. a request with a forged `X-Forwarded-Host` to see whether the edge
overwrites or passes it through.

The resolver is then written against whichever header is demonstrably edge-controlled, with a
documented precedence order, a hard allowlist of platform hostnames, and forged values rejected
rather than trusted. The probe route is removed before launch. Until that probe runs, any claim
about which header is authoritative here would be a guess.

## Sequencing

1. Enable Lovable Cloud (Postgres, auth, storage).
2. Run the header probe; document the real hostname source.
3. Schema + RLS: `businesses`, `business_members`, `business_domains`, `platform_staff`, then
   per-domain tables (catalog, bookings, quotes, invoices, customers, specialists).
4. Server-side tenant resolution middleware feeding router context.
5. Application surfaces (public site, admin, portals) on top of that context.
6. An isolation test pass: two seeded businesses, and an attempt to read/write across them from
   every surface including background/server functions — the master document's requirement that
   every backend function is individually audited.
