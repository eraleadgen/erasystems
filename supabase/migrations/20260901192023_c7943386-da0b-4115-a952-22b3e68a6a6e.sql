create table public.invite_attempts (
  ip text primary key,
  failures integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

grant all on public.invite_attempts to service_role;

alter table public.invite_attempts enable row level security;
-- No policies and no grants for anon/authenticated: unreachable via the Data API.

create or replace function public.invite_throttle_check(_ip text)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.invite_attempts
    where ip = _ip and blocked_until is not null and blocked_until > now()
  );
$$;

create or replace function public.invite_throttle_record(_ip text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _failures integer;
begin
  insert into public.invite_attempts (ip, failures, window_started_at, updated_at)
  values (_ip, 1, now(), now())
  on conflict (ip) do update
    set failures = case
          when public.invite_attempts.window_started_at < now() - interval '15 minutes' then 1
          else public.invite_attempts.failures + 1
        end,
        window_started_at = case
          when public.invite_attempts.window_started_at < now() - interval '15 minutes' then now()
          else public.invite_attempts.window_started_at
        end,
        updated_at = now()
  returning failures into _failures;

  if _failures >= 10 then
    update public.invite_attempts
       set blocked_until = now() + interval '1 hour'
     where ip = _ip;
  end if;
end;
$$;

revoke execute on function public.invite_throttle_check(text) from public, anon, authenticated;
revoke execute on function public.invite_throttle_record(text) from public, anon, authenticated;