drop function if exists public.consume_invite(text, uuid);

create or replace function public.consume_invite(_token_hash text)
returns table (id uuid, email text, full_name text)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return query
  update public.invites i
     set status = 'accepted',
         accepted_at = now()
   where i.token_hash = _token_hash
     and i.status = 'pending'
     and i.expires_at > now()
  returning i.id, i.email, i.full_name;
end;
$$;

revoke execute on function public.consume_invite(text) from public, anon, authenticated;