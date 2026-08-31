-- =====================================================================
-- ERA Systems: multi-tenant foundation
-- Isolation key: business_id, enforced by RLS on every tenant table.
-- =====================================================================

create type public.business_role as enum ('owner','admin','specialist','customer');
create type public.platform_role as enum ('platform_admin','platform_support');
create type public.plan_tier as enum ('basic','growth','enterprise');
create type public.booking_status as enum ('pending','confirmed','completed','cancelled','no_show');

-- ---------- shared updated_at helper ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- businesses (the tenant) ----------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  legal_name text,
  timezone text not null default 'America/New_York',
  plan_tier public.plan_tier not null default 'basic',
  is_active boolean not null default false,
  logo_url text,
  brand_primary text,
  brand_accent text,
  support_email text,
  support_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.businesses to anon;
grant select, insert, update, delete on public.businesses to authenticated;
grant all on public.businesses to service_role;
alter table public.businesses enable row level security;

create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function public.set_updated_at();

-- ---------- membership (roles live in their own table, never on a profile) ----------
create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null,
  role public.business_role not null,
  created_at timestamptz not null default now(),
  unique (business_id, user_id, role)
);
create index business_members_user_idx on public.business_members (user_id);
create index business_members_business_idx on public.business_members (business_id);

grant select, insert, update, delete on public.business_members to authenticated;
grant all on public.business_members to service_role;
alter table public.business_members enable row level security;

-- ---------- ERA internal staff: a separate permission system ----------
create table public.platform_staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.platform_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.platform_staff to authenticated;
grant all on public.platform_staff to service_role;
alter table public.platform_staff enable row level security;

-- ---------- security-definer predicates (no RLS recursion) ----------
create or replace function public.is_member_of(_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = _business_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_business_role(_business_id uuid, _role public.business_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = _business_id and user_id = auth.uid() and role = _role
  );
$$;

create or replace function public.is_business_manager(_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = _business_id and user_id = auth.uid()
      and role in ('owner','admin')
  );
$$;

create or replace function public.is_platform_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.platform_staff where user_id = auth.uid()
  );
$$;

-- ---------- hostname -> business mapping ----------
create table public.business_domains (
  hostname text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index business_domains_business_idx on public.business_domains (business_id);
create unique index business_domains_one_primary
  on public.business_domains (business_id) where is_primary;

grant select on public.business_domains to anon;
grant select, insert, update, delete on public.business_domains to authenticated;
grant all on public.business_domains to service_role;
alter table public.business_domains enable row level security;

-- hostnames are normalized before storage; enforce it at the database too
create or replace function public.normalize_hostname()
returns trigger language plpgsql set search_path = public as $$
begin
  new.hostname = lower(btrim(rtrim(new.hostname, '.')));
  if new.hostname !~ '^[a-z0-9.-]+$' then
    raise exception 'invalid hostname: %', new.hostname;
  end if;
  return new;
end;
$$;

create trigger business_domains_normalize
before insert or update on public.business_domains
for each row execute function public.normalize_hostname();

-- ---------- catalog ----------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  base_price_cents integer not null default 0,
  duration_minutes integer not null default 60,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_business_idx on public.services (business_id, is_active);

grant select on public.services to anon;
grant select, insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;

create trigger services_set_updated_at
before update on public.services
for each row execute function public.set_updated_at();

-- ---------- bookings ----------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  customer_id uuid,
  specialist_id uuid,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status public.booking_status not null default 'pending',
  total_cents integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_business_time_idx on public.bookings (business_id, starts_at);
create index bookings_customer_idx on public.bookings (customer_id);

grant select, insert, update, delete on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

-- =====================================================================
-- Policies
-- =====================================================================

-- businesses: public sees only active businesses (public site needs branding)
create policy "public reads active businesses" on public.businesses
for select to anon using (is_active);

create policy "members read their business" on public.businesses
for select to authenticated
using (public.is_member_of(id) or public.is_platform_staff() or is_active);

create policy "managers update their business" on public.businesses
for update to authenticated
using (public.is_business_manager(id))
with check (public.is_business_manager(id));

-- business_domains: public read is required to resolve a hostname before render
create policy "public reads domain mapping" on public.business_domains
for select to anon using (true);

create policy "authenticated reads domain mapping" on public.business_domains
for select to authenticated using (true);

create policy "managers add domains" on public.business_domains
for insert to authenticated
with check (public.is_business_manager(business_id));

create policy "managers update domains" on public.business_domains
for update to authenticated
using (public.is_business_manager(business_id))
with check (public.is_business_manager(business_id));

create policy "managers remove domains" on public.business_domains
for delete to authenticated
using (public.is_business_manager(business_id));

-- business_members
create policy "read own membership rows" on public.business_members
for select to authenticated
using (user_id = auth.uid() or public.is_business_manager(business_id) or public.is_platform_staff());

create policy "managers add members" on public.business_members
for insert to authenticated
with check (public.is_business_manager(business_id));

create policy "managers update members" on public.business_members
for update to authenticated
using (public.is_business_manager(business_id))
with check (public.is_business_manager(business_id));

create policy "managers remove members" on public.business_members
for delete to authenticated
using (public.is_business_manager(business_id));

-- platform_staff: readable only by platform staff themselves; writes are service_role only
create policy "staff read staff roster" on public.platform_staff
for select to authenticated
using (user_id = auth.uid() or public.is_platform_staff());

-- services
create policy "public reads active services" on public.services
for select to anon using (is_active);

create policy "members read business services" on public.services
for select to authenticated
using (public.is_member_of(business_id) or public.is_platform_staff() or is_active);

create policy "managers insert services" on public.services
for insert to authenticated
with check (public.is_business_manager(business_id));

create policy "managers update services" on public.services
for update to authenticated
using (public.is_business_manager(business_id))
with check (public.is_business_manager(business_id));

create policy "managers delete services" on public.services
for delete to authenticated
using (public.is_business_manager(business_id));

-- bookings
create policy "staff read business bookings" on public.bookings
for select to authenticated
using (public.is_member_of(business_id) or public.is_platform_staff());

create policy "customer reads own bookings" on public.bookings
for select to authenticated
using (customer_id = auth.uid());

create policy "staff insert business bookings" on public.bookings
for insert to authenticated
with check (public.is_member_of(business_id));

create policy "staff update business bookings" on public.bookings
for update to authenticated
using (public.is_member_of(business_id))
with check (public.is_member_of(business_id));

create policy "customer updates own booking" on public.bookings
for update to authenticated
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

create policy "owners delete business bookings" on public.bookings
for delete to authenticated
using (public.has_business_role(business_id, 'owner'));

-- =====================================================================
-- Two demo tenants, so cross-tenant isolation is testable immediately
-- =====================================================================
insert into public.businesses (id, slug, name, timezone, plan_tier, is_active, brand_primary, brand_accent, support_email)
values
  ('11111111-1111-4111-8111-111111111111','apex-detail','Apex Mobile Detailing','America/New_York','growth',true,'#0F3D2E','#C9A227','hello@apexdetail.example'),
  ('22222222-2222-4222-8222-222222222222','northwind-hvac','Northwind HVAC','America/Chicago','enterprise',true,'#12263A','#F26419','service@northwindhvac.example');

insert into public.business_domains (hostname, business_id, is_primary, verified_at) values
  ('apexdetail.example','11111111-1111-4111-8111-111111111111',true, now()),
  ('www.apexdetail.example','11111111-1111-4111-8111-111111111111',false, now()),
  ('northwindhvac.example','22222222-2222-4222-8222-222222222222',true, now()),
  ('www.northwindhvac.example','22222222-2222-4222-8222-222222222222',false, now());

insert into public.services (business_id, name, description, base_price_cents, duration_minutes, sort_order) values
  ('11111111-1111-4111-8111-111111111111','Full Interior Detail','Deep clean, shampoo, conditioning.',19900,180,1),
  ('11111111-1111-4111-8111-111111111111','Ceramic Coating','Multi-year paint protection.',89900,480,2),
  ('22222222-2222-4222-8222-222222222222','Furnace Tune-Up','Seasonal inspection and service.',14900,90,1),
  ('22222222-2222-4222-8222-222222222222','AC System Install','Full replacement, permit included.',549900,720,2);
