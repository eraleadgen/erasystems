ALTER TABLE public.business_billing
  ADD COLUMN IF NOT EXISTS grace_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspend_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_suspended boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.business_billing.billing_suspended IS 'True only when the business was suspended automatically for non-payment or an ended subscription; paying again reactivates it.';

CREATE OR REPLACE FUNCTION public.tenant_site_is_live(_business_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.client_provisioning p
    JOIN public.businesses b ON b.id = p.business_id
    WHERE p.business_id = _business_id
      AND p.website_status = 'live'
      AND b.lifecycle = 'active'
      AND b.is_active
  );
$function$;