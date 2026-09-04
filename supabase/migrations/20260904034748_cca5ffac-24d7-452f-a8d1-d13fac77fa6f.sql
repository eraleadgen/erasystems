drop policy "public reads domain mapping" on public.business_domains;

create policy "public reads verified active domain mapping"
on public.business_domains
for select
to anon
using (
  verified_at is not null
  and exists (
    select 1 from public.businesses b
    where b.id = business_domains.business_id
      and b.is_active
      and b.lifecycle = 'active'
  )
);