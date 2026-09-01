create type public.platform_feature as enum (
  'website','ai_chat_widget','core_engines','payments','admin_dashboard','self_serve_setup','email_automations',
  'customer_portal','specialist_portal',
  'voice_sms_agent','sms_automations','advanced_analytics','partner_network'
);

create type public.addon_kind as enum ('ad_management','white_label_branding');

create table public.plan_tier_features (
  plan_tier public.plan_tier not null,
  feature public.platform_feature not null,
  primary key (plan_tier, feature)
);

grant select on public.plan_tier_features to anon, authenticated;
grant all on public.plan_tier_features to service_role;

alter table public.plan_tier_features enable row level security;

create policy "anyone reads tier feature map" on public.plan_tier_features
for select to anon, authenticated using (true);

insert into public.plan_tier_features (plan_tier, feature) values
  ('basic','website'),('basic','ai_chat_widget'),('basic','core_engines'),('basic','payments'),
  ('basic','admin_dashboard'),('basic','self_serve_setup'),('basic','email_automations'),
  ('growth','website'),('growth','ai_chat_widget'),('growth','core_engines'),('growth','payments'),
  ('growth','admin_dashboard'),('growth','self_serve_setup'),('growth','email_automations'),
  ('growth','customer_portal'),('growth','specialist_portal'),
  ('enterprise','website'),('enterprise','ai_chat_widget'),('enterprise','core_engines'),('enterprise','payments'),
  ('enterprise','admin_dashboard'),('enterprise','self_serve_setup'),('enterprise','email_automations'),
  ('enterprise','customer_portal'),('enterprise','specialist_portal'),
  ('enterprise','voice_sms_agent'),('enterprise','sms_automations'),
  ('enterprise','advanced_analytics'),('enterprise','partner_network');

create table public.business_addons (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  addon public.addon_kind not null,
  is_active boolean not null default true,
  price_cents integer not null,
  currency text not null default 'usd',
  billing_interval text not null default 'monthly',
  activated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, addon)
);

create index business_addons_business_idx on public.business_addons (business_id, addon) where is_active;

grant select on public.business_addons to authenticated;
grant all on public.business_addons to service_role;

alter table public.business_addons enable row level security;

create policy "members read their business addons" on public.business_addons
for select to authenticated
using (public.is_member_of(business_id) or public.is_platform_staff());

create policy "platform staff insert addons" on public.business_addons
for insert to authenticated
with check (public.is_platform_staff());

create policy "platform staff update addons" on public.business_addons
for update to authenticated
using (public.is_platform_staff())
with check (public.is_platform_staff());

create policy "platform staff delete addons" on public.business_addons
for delete to authenticated
using (public.is_platform_staff());

create or replace function public.validate_business_addon()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.price_cents < 0 then
    raise exception 'price_cents must be >= 0';
  end if;
  if new.is_active and new.deactivated_at is not null then
    raise exception 'an active add-on cannot have deactivated_at set';
  end if;
  if not new.is_active and new.deactivated_at is null then
    new.deactivated_at = now();
  end if;
  if new.billing_interval not in ('monthly','quarterly','annual','one_time') then
    raise exception 'invalid billing_interval: %', new.billing_interval;
  end if;
  return new;
end;
$$;

create trigger business_addons_validate
before insert or update on public.business_addons
for each row execute function public.validate_business_addon();

create trigger business_addons_set_updated_at
before update on public.business_addons
for each row execute function public.set_updated_at();

create or replace function public.guard_plan_tier_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.plan_tier is distinct from old.plan_tier and not public.is_platform_staff() then
    raise exception 'plan_tier can only be changed by platform staff';
  end if;
  return new;
end;
$$;

create trigger businesses_guard_plan_tier
before update on public.businesses
for each row execute function public.guard_plan_tier_change();

create or replace function public.business_has_feature(_business_id uuid, _feature public.platform_feature)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.businesses b
    join public.plan_tier_features f on f.plan_tier = b.plan_tier
    where b.id = _business_id and f.feature = _feature
  )
$$;

create or replace function public.business_has_addon(_business_id uuid, _addon public.addon_kind)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_addons
    where business_id = _business_id and addon = _addon and is_active
  )
$$;

revoke execute on function public.business_has_feature(uuid, public.platform_feature) from public, anon;
revoke execute on function public.business_has_addon(uuid, public.addon_kind) from public, anon;
grant execute on function public.business_has_feature(uuid, public.platform_feature) to authenticated, service_role;
grant execute on function public.business_has_addon(uuid, public.addon_kind) to authenticated, service_role;