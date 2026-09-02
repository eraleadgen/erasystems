GRANT INSERT ON public.discovery_requests TO anon;
GRANT INSERT ON public.discovery_requests TO authenticated;

CREATE POLICY "Anyone can submit a discovery request"
  ON public.discovery_requests FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'new');