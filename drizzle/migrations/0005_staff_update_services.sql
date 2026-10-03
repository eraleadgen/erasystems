CREATE POLICY "platform staff update services" ON public.services
  FOR UPDATE TO authenticated USING (private.is_platform_staff()) WITH CHECK (private.is_platform_staff());