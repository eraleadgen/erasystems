create policy "own onboarding logo read"
  on storage.objects for select to authenticated
  using (bucket_id = 'onboarding-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own onboarding logo insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'onboarding-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own onboarding logo update"
  on storage.objects for update to authenticated
  using (bucket_id = 'onboarding-logos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'onboarding-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own onboarding logo delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'onboarding-logos' and (storage.foldername(name))[1] = auth.uid()::text);
