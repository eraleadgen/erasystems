create type public.onboarding_status as enum ('in_progress','completed');

create table public.onboarding_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  status public.onboarding_status not null default 'in_progress',
  current_step integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  business_id uuid references public.businesses(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.onboarding_drafts to authenticated;
grant all on public.onboarding_drafts to service_role;

alter table public.onboarding_drafts enable row level security;

create policy "owner reads own draft"
  on public.onboarding_drafts for select to authenticated
  using (user_id = auth.uid() or public.is_platform_staff());

create policy "owner creates own draft"
  on public.onboarding_drafts for insert to authenticated
  with check (user_id = auth.uid());

create policy "owner updates own draft"
  on public.onboarding_drafts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger onboarding_drafts_set_updated_at
  before update on public.onboarding_drafts
  for each row execute function public.set_updated_at();

create index onboarding_drafts_status_idx on public.onboarding_drafts (status);
