-- 1. Commercial terms on invites
ALTER TABLE public.invites
  ADD COLUMN plan_tier public.plan_tier NOT NULL DEFAULT 'basic',
  ADD COLUMN subscription_price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN setup_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN billing_interval text NOT NULL DEFAULT 'monthly';

CREATE OR REPLACE FUNCTION public.validate_invite_terms()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin
  if new.subscription_price_cents < 0 or new.setup_fee_cents < 0 then
    raise exception 'prices must be >= 0';
  end if;
  if new.billing_interval not in ('monthly','quarterly','annual','one_time') then
    raise exception 'invalid billing_interval: %', new.billing_interval;
  end if;
  return new;
end;
$$;

CREATE TRIGGER invites_validate_terms
  BEFORE INSERT OR UPDATE ON public.invites
  FOR EACH ROW EXECUTE FUNCTION public.validate_invite_terms();

-- 2. Per-invite add-on pricing (staff only, mirrors business_addons)
CREATE TABLE public.invite_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  addon public.addon_kind NOT NULL,
  price_cents integer NOT NULL,
  billing_interval text NOT NULL DEFAULT 'monthly',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invite_id, addon)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invite_addons TO authenticated;
GRANT ALL ON public.invite_addons TO service_role;

ALTER TABLE public.invite_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform staff manage invite addons" ON public.invite_addons
  FOR ALL TO authenticated
  USING (public.is_platform_staff())
  WITH CHECK (public.is_platform_staff());

CREATE OR REPLACE FUNCTION public.validate_invite_addon()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin
  if new.price_cents < 0 then
    raise exception 'price_cents must be >= 0';
  end if;
  if new.billing_interval not in ('monthly','quarterly','annual','one_time') then
    raise exception 'invalid billing_interval: %', new.billing_interval;
  end if;
  return new;
end;
$$;

CREATE TRIGGER invite_addons_validate
  BEFORE INSERT OR UPDATE ON public.invite_addons
  FOR EACH ROW EXECUTE FUNCTION public.validate_invite_addon();

-- 3. Which invite a business came from
ALTER TABLE public.businesses
  ADD COLUMN origin_invite_id uuid REFERENCES public.invites(id) ON DELETE SET NULL;

-- 4. The trusted server-side provisioning/payment path (no end-user JWT) may set the
--    agreed plan, exactly as it already may set lifecycle.
CREATE OR REPLACE FUNCTION public.guard_plan_tier_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin
  if new.plan_tier is distinct from old.plan_tier
     and auth.uid() is not null
     and not public.is_platform_staff() then
    raise exception 'plan_tier can only be changed by platform staff';
  end if;
  return new;
end;
$$;

-- 5. Payment records
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stripe',
  provider_session_id text UNIQUE,
  provider_event_id text UNIQUE,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending',
  webhook_verified_at timestamptz,
  api_verified_at timestamptz,
  activated_at timestamptz,
  failure_reason text,
  raw_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payments_business_id_idx ON public.payments (business_id);

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read their business payments" ON public.payments
  FOR SELECT TO authenticated
  USING (public.is_member_of(business_id) OR public.is_platform_staff());

CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Single-transition activation: guarded, id-scoped, slug untouched.
CREATE OR REPLACE FUNCTION public.activate_paid_business(_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  _changed integer;
begin
  update public.businesses
     set lifecycle = 'active',
         is_active = true,
         slug_reserved_until = null
   where id = _business_id
     and lifecycle in ('pending_payment', 'expired');
  get diagnostics _changed = row_count;

  if _changed > 0 then
    update public.business_addons
       set is_active = true, deactivated_at = null
     where business_id = _business_id and not is_active;
  end if;

  return _changed > 0;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_paid_business(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_paid_business(uuid) TO service_role;