CREATE TABLE public.agency_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  description text,
  file_path text,
  link_url text,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_documents TO authenticated;
GRANT ALL ON public.agency_documents TO service_role;

ALTER TABLE public.agency_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform staff manage agency documents"
  ON public.agency_documents FOR ALL TO authenticated
  USING (public.is_platform_staff())
  WITH CHECK (public.is_platform_staff());

CREATE OR REPLACE FUNCTION public.validate_agency_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin
  new.title = btrim(new.title);
  if new.title = '' then
    raise exception 'title is required';
  end if;
  if new.category not in ('legal','contract','sales') then
    raise exception 'invalid category: %', new.category;
  end if;
  if coalesce(new.file_path, '') = '' and coalesce(new.link_url, '') = '' then
    raise exception 'a file or a link is required';
  end if;
  return new;
end;
$$;

CREATE TRIGGER agency_documents_validate
  BEFORE INSERT OR UPDATE ON public.agency_documents
  FOR EACH ROW EXECUTE FUNCTION public.validate_agency_document();

CREATE TRIGGER agency_documents_set_updated_at
  BEFORE UPDATE ON public.agency_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY "Anyone can submit a discovery request" ON public.discovery_requests;
CREATE POLICY "Anyone can submit a discovery request"
  ON public.discovery_requests FOR INSERT TO anon, authenticated
  WITH CHECK (status IN ('new','scheduled'));