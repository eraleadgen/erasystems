CREATE POLICY "Staff read agency documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'agency-documents' AND public.is_platform_staff());

CREATE POLICY "Staff upload agency documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'agency-documents' AND public.is_platform_staff());

CREATE POLICY "Staff update agency documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'agency-documents' AND public.is_platform_staff())
  WITH CHECK (bucket_id = 'agency-documents' AND public.is_platform_staff());

CREATE POLICY "Staff delete agency documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'agency-documents' AND public.is_platform_staff());