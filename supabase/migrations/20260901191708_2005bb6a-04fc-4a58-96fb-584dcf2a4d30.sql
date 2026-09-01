create type public.invite_status as enum ('pending','accepted','revoked');

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  email text not null,
  full_name text not null,
  notes text,
  status public.invite_status not null default 'pending',
  expires_at timestamptz not null,
  invited_by uuid,
  accepted_at timestamptz,
  accepted_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invites_email_idx on public.invites (email);
create index invites_status_idx on public.invites (status);

grant select, insert, update on public.invites to authenticated;
grant all on public.invites to service_role;

alter table public.invites enable row level security;

create policy "platform staff read invites"
  on public.invites for select to authenticated
  using (public.is_platform_staff());

create policy "platform staff create invites"
  on public.invites for insert to authenticated
  with check (public.is_platform_staff());

create policy "platform staff update invites"
  on public.invites for update to authenticated
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create trigger invites_set_updated_at
  before update on public.invites
  for each row execute function public.set_updated_at();

create or replace function public.normalize_invite()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.email = lower(btrim(new.email));
  if new.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email: %', new.email;
  end if;
  new.full_name = btrim(new.full_name);
  if new.full_name = '' then
    raise exception 'full_name is required';
  end if;
  return new;
end;
$$;

create trigger invites_normalize
  before insert or update on public.invites
  for each row execute function public.normalize_invite();

-- Atomically consume a pending, unexpired invite. Returns the invite row
-- only when the conditional update actually claimed it.
create or replace function public.consume_invite(_token_hash text, _user_id uuid)
returns table (id uuid, email text, full_name text)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return query
  update public.invites i
     set status = 'accepted',
         accepted_at = now(),
         accepted_user_id = _user_id
   where i.token_hash = _token_hash
     and i.status = 'pending'
     and i.expires_at > now()
  returning i.id, i.email, i.full_name;
end;
$$;

-- Release a consumed invite if downstream account creation failed.
create or replace function public.release_invite(_invite_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.invites
     set status = 'pending', accepted_at = null, accepted_user_id = null
   where id = _invite_id and status = 'accepted';
$$;

revoke execute on function public.consume_invite(text, uuid) from public, anon, authenticated;
revoke execute on function public.release_invite(uuid) from public, anon, authenticated;