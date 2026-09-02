CREATE TABLE public.discovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  business_name text NOT NULL,
  email text NOT NULL,
  phone text,
  business_type text,
  message text,
  source_hostname text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.discovery_requests TO authenticated;
GRANT ALL ON public.discovery_requests TO service_role;

ALTER TABLE public.discovery_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform staff can read discovery requests"
  ON public.discovery_requests FOR SELECT TO authenticated
  USING (public.is_platform_staff());

CREATE POLICY "Platform staff can update discovery requests"
  ON public.discovery_requests FOR UPDATE TO authenticated
  USING (public.is_platform_staff())
  WITH CHECK (public.is_platform_staff());

CREATE INDEX discovery_requests_created_at_idx ON public.discovery_requests (created_at DESC);